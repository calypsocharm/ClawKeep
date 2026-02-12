
import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap, Mic, MicOff, Brain, Paperclip, Eye, EyeOff, Trash2, RotateCcw, Activity, UploadCloud, X, Sparkles, LayoutGrid, BarChart3, FileText, Globe, Mail, Search, ListTodo, BookOpen, Volume2, Minus, Plus, Type } from 'lucide-react';
import { ChatMessage, SystemAlert, ThinkingDepth, TelemetryState } from '../types';
import { agentService } from '../services/agentService';
import { activityService } from '../services/activityService';
import { userScopeService } from '../services/userScopeService';
import { gatewayService } from '../services/gatewayService';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { getApiKey, geminiService } from '../services/geminiService';
import SmartSuggestions from './SmartSuggestions';

interface OpenClawAgentProps {
  contextData: string;
  onAction?: (action: any) => Promise<string | void>;
  systemAlerts?: SystemAlert[];
  telemetry: TelemetryState;
  setTelemetry: React.Dispatch<React.SetStateAction<TelemetryState>>;
}

const ClawMini = ({ isThinking }: { isThinking?: boolean }) => (
  <div className={`flex items-center gap-2 px-2 py-1 bg-white/5 border border-white/10 rounded-xl transition-all duration-500 ${isThinking ? 'border-rose-500/50 shadow-glow-lobster' : ''}`}>
    <div className={`w-5 h-5 bg-rose-600 rounded-full relative overflow-hidden flex items-center justify-center border border-white/20 ${isThinking ? 'animate-pulse' : ''}`}>
      <div className="flex gap-1 items-center">
        <div className="w-1 h-1 bg-white rounded-full"></div>
        <div className="w-1 h-1 bg-white rounded-full"></div>
      </div>
    </div>
    <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Claw</span>
  </div>
);

const COMPACT_THRESHOLD = 12000; // ~60% of 20K limit — trigger compaction here
const COMPACT_KEEP_RECENT = 6;   // Keep last N message pairs (user+model)

const ContextHealthGauge = ({ messages, compacted }: { messages: ChatMessage[]; compacted?: boolean }) => {
  const charCount = JSON.stringify(messages).length;
  const tokenCount = Math.ceil(charCount / 4);
  const limit = 20000;
  const percentage = Math.min(100, (tokenCount / limit) * 100);
  const compactPct = (COMPACT_THRESHOLD / limit) * 100;

  let color = 'bg-emerald-500';
  if (percentage > 50) color = 'bg-amber-500';
  if (percentage > 85) color = 'bg-rose-500';

  return (
    <div className="flex flex-col gap-1 w-24 ml-2" title={`${tokenCount} est. tokens${compacted ? ' (compacted)' : ''}`}>
      <div className="flex justify-between items-end">
        <span className="text-[7px] font-black uppercase tracking-widest text-white/30">
          {compacted ? '♻️ Compact' : 'Context'}
        </span>
        <span className={`text-[7px] font-mono font-bold ${percentage > 85 ? 'text-rose-400' : 'text-white/40'}`}>
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5 relative">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
        <div className="absolute top-0 h-full w-px bg-amber-400/40" style={{ left: `${compactPct}%` }} title="Auto-compact threshold" />
      </div>
    </div>
  );
};

const NeuralReadinessGauge = ({ progress, status }: { progress: number, status: string }) => (
  <div className="flex items-center gap-4 py-3 px-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-300">
    <div className="relative w-8 h-8 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/5" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="16" fill="none"
          className="stroke-rose-500 transition-all duration-500 ease-out"
          strokeWidth="3"
          strokeDasharray="100"
          strokeDashoffset={100 - progress}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[7px] font-black text-white font-mono">{Math.round(progress)}%</span>
      </div>
    </div>
    <div className="min-w-0">
      <p className="text-[9px] text-white/60 font-mono italic truncate uppercase tracking-tighter">{status}</p>
    </div>
  </div>
);

const VOICE_PROFILES = [
  { id: 'claw', name: 'Claw', voiceName: 'Kore', emoji: '🦞', desc: 'Sharp & confident', gender: 'Female', color: 'rose' },
  { id: 'coral', name: 'Coral', voiceName: 'Aoede', emoji: '🌊', desc: 'Warm & melodic', gender: 'Female', color: 'cyan' },
  { id: 'anchor', name: 'Anchor', voiceName: 'Orus', emoji: '⚓', desc: 'Deep & steady', gender: 'Male', color: 'amber' },
];

const OpenClawAgent: React.FC<OpenClawAgentProps> = ({ contextData, onAction, systemAlerts, telemetry, setTelemetry }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wasCompacted, setWasCompacted] = useState(false);
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>('MEDIUM');
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [neuralLoad, setNeuralLoad] = useState(0);
  const [readiness, setReadiness] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('Syncing...');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; data: string; size: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCreativeMenu, setShowCreativeMenu] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    const saved = userScopeService.scopedGet('voice_profile');
    return VOICE_PROFILES.find(v => v.id === saved) || VOICE_PROFILES[0];
  });
  const micLongPressTimer = useRef<any>(null);

  // --- Resizable panel width ---
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = userScopeService.scopedGet('panel_width');
    return saved ? parseInt(saved) : 400;
  });
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleResizeMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - ev.clientX; // dragging left = wider
      const newWidth = Math.min(800, Math.max(250, startWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleResizeEnd = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save on release
      setPanelWidth(prev => { userScopeService.scopedSet('panel_width', String(prev)); return prev; });
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // --- Font size control ---
  const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18];
  const [fontSize, setFontSize] = useState(() => {
    const saved = userScopeService.scopedGet('font_size');
    return saved ? parseInt(saved) : 13;
  });
  const adjustFont = (dir: 1 | -1) => {
    const idx = FONT_SIZES.indexOf(fontSize);
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, idx + dir))];
    setFontSize(next);
    userScopeService.scopedSet('font_size', String(next));
  };

  const CREATIVE_COMMANDS = [
    { icon: LayoutGrid, label: 'Create a New Tab', prompt: 'Create a new custom tab for me. Ask me what I want it to be called and what it should contain.', color: 'from-violet-500 to-purple-600' },
    { icon: BarChart3, label: 'Build a Chart', prompt: 'Build me a visual chart or infographic. Ask me what data I want to visualize.', color: 'from-cyan-500 to-blue-600' },
    { icon: FileText, label: 'Generate a Report', prompt: 'Generate a professional report based on my current data. Analyze everything you have access to and give me a comprehensive summary.', color: 'from-emerald-500 to-green-600' },
    { icon: Globe, label: 'Browse the Web', prompt: 'I need you to browse the web for me. What should I search for?', color: 'from-orange-500 to-amber-600' },
    { icon: Mail, label: 'Draft an Email', prompt: 'Help me draft a professional email. Ask me who it\'s for and what it\'s about.', color: 'from-pink-500 to-rose-600' },
    { icon: Search, label: 'Analyze a Document', prompt: 'Analyze a document for me. I\'ll attach a file — look for key insights, summaries, and action items.', color: 'from-teal-500 to-cyan-600' },
    { icon: ListTodo, label: 'Create a Task', prompt: 'Create a new task for me. Ask me what needs to be done, the priority, and the deadline.', color: 'from-yellow-500 to-orange-600' },
    { icon: BookOpen, label: 'Summarize Everything', prompt: 'Give me a full summary of all my current data — tasks, events, documents, contacts, and anything else you can see. What\'s the big picture?', color: 'from-indigo-500 to-violet-600' },
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const statusMessages = [
    "Thinking...", "Scanning Hub...", "Checking Truths...", "Analyzing Data...", "Processing..."
  ];

  let activeView = 'DASHBOARD';
  try { activeView = JSON.parse(contextData).activeView; } catch (e) { }

  useEffect(() => {
    const saved = userScopeService.scopedGet('chat_history');
    if (saved) {
      setMessages(JSON.parse(saved, (k, v) => k === 'timestamp' ? new Date(v) : v));
    } else {
      setMessages([{
        id: 'welcome',
        role: 'model',
        content: 'Hello! 🦀 I\'m Claw, your ClawKeep assistant. I\'m ready to help you get things done. What\'s on your mind?',
        timestamp: new Date()
      }]);
    }

    // Load persistent memory from VPS (compacted context archive)
    gatewayService.readFileFromServer('OPERATIONS/context_archive.md')
      .then(data => {
        if (data?.content && data.content.trim().length > 50) {
          const memoryMsg: ChatMessage = {
            id: 'vps_memory_' + Date.now(),
            role: 'model',
            content: `🧠 **Persistent Memory Loaded** — Previous session context from VPS:\n\n> ${data.content.slice(0, 2000)}`,
            timestamp: new Date()
          };
          setMessages(prev => {
            // Only prepend if not already loaded
            if (prev.some(m => m.id.startsWith('vps_memory_'))) return prev;
            return [memoryMsg, ...prev];
          });
          activityService.log('IDLE', `🧠 Loaded persistent memory from VPS (${Math.ceil(data.content.length / 4)} tokens)`);
        }
      })
      .catch(() => { /* VPS offline or no archive yet */ });

    const unsubscribeLoad = activityService.subscribeLoad(setNeuralLoad);
    return () => unsubscribeLoad();
  }, []);

  useEffect(() => {
    userScopeService.scopedSet('chat_history', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let interval: any;
    let statusInterval: any;
    if (isProcessing) {
      setReadiness(0);
      setCurrentStatus(statusMessages[0]);
      interval = setInterval(() => {
        setReadiness(prev => (prev >= 98 ? 98 : prev + Math.random() * 5));
      }, 800);
      statusInterval = setInterval(() => {
        setCurrentStatus(prev => statusMessages[(statusMessages.indexOf(prev) + 1) % statusMessages.length]);
      }, 2000);
    } else {
      setReadiness(0);
      clearInterval(interval);
      clearInterval(statusInterval);
    }
    return () => { clearInterval(interval); clearInterval(statusInterval); };
  }, [isProcessing]);

  function encode(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function decode(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }

  const toggleMic = async () => {
    setShowVoicePicker(false);
    if (isMicActive) {
      if (sessionRef.current) sessionRef.current.close();
      setIsMicActive(false);
      return;
    }

    // Surface a connecting message
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `🎙️ Connecting voice link (${selectedVoice.emoji} ${selectedVoice.name})...`, timestamp: new Date() }]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const apiKey = getApiKey();
      if (!apiKey) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: '🎙️ No API key found. Add a Gemini key in Vault → Secrets.', timestamp: new Date() }]);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      // Try models in order — native audio may not be available on free tier
      const LIVE_MODELS = [
        'gemini-2.0-flash-live-001',
        'gemini-live-2.5-flash-native-audio',
      ];

      let session: any = null;
      let lastError: any = null;

      for (const modelId of LIVE_MODELS) {
        try {
          console.log(`[Voice] Trying model: ${modelId}`);
          session = await ai.live.connect({
            model: modelId,
            callbacks: {
              onopen: () => {
                console.log(`[Voice] Connected via ${modelId}`);
                setIsMicActive(true);
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `🎙️ Voice link active! (${selectedVoice.emoji} ${selectedVoice.name} via ${modelId})\nSpeak now — I'm listening.`, timestamp: new Date() }]);
                const source = inputCtx.createMediaStreamSource(stream);
                const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                scriptProcessor.onaudioprocess = (e) => {
                  const inputData = e.inputBuffer.getChannelData(0);
                  const l = inputData.length;
                  const int16 = new Int16Array(l);
                  for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                  const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                  if (session) session.sendRealtimeInput({ media: pcmBlob });
                };
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputCtx.destination);
              },
              onmessage: async (message: LiveServerMessage) => {
                try {
                  const parts = message.serverContent?.modelTurn?.parts;
                  if (parts && parts.length > 0) {
                    const audioData = parts[0]?.inlineData?.data;
                    if (audioData) {
                      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                      const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                      const source = outputCtx.createBufferSource();
                      source.buffer = buffer;
                      source.connect(outputCtx.destination);
                      source.start(nextStartTimeRef.current);
                      nextStartTimeRef.current += buffer.duration;
                      sourcesRef.current.add(source);
                      source.onended = () => sourcesRef.current.delete(source);
                    }
                    // Handle text responses (non-native-audio models respond with text)
                    const textPart = parts.find((p: any) => p.text);
                    if (textPart?.text) {
                      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `🎙️ ${textPart.text}`, timestamp: new Date() }]);
                    }
                  }
                  if (message.serverContent?.interrupted) {
                    sourcesRef.current.forEach(s => s.stop());
                    sourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                  }
                } catch (msgErr: any) {
                  console.warn('[Voice] Message handling error (non-fatal):', msgErr.message);
                  // Don't kill the session for message parsing errors
                }
              },
              onclose: (e: any) => {
                setIsMicActive(false);
                const reason = e?.reason || e?.code || 'unknown';
                console.log('[Voice] Session closed:', reason);
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `🎙️ Voice link ended. ${typeof reason === 'string' && reason !== 'unknown' ? `(${reason})` : ''}`, timestamp: new Date() }]);
              },
              onerror: (e: any) => {
                console.error('[Voice] Session error:', e);
                // Don't immediately kill — some errors are recoverable
                const msg = e?.message || e?.reason || 'Unknown error';
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `🎙️ Voice error: ${msg}`, timestamp: new Date() }]);
              }
            },
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice.voiceName } } },
              systemInstruction: `You are Claw, the ClawKeep assistant. Talk to the operator with precision. Be concise. CURRENT DATE AND TIME: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. CURRENT YEAR: ${new Date().getFullYear()}. IMPORTANT: Use this timestamp for ALL date references, do NOT hallucinate the date. Context: ${contextData}`
            }
          });
          sessionRef.current = session;
          break; // Success — stop trying models
        } catch (modelErr: any) {
          console.warn(`[Voice] Model ${modelId} failed:`, modelErr.message);
          lastError = modelErr;
          continue; // Try next model
        }
      }

      if (!session) {
        throw lastError || new Error('All Live API models failed');
      }
    } catch (e: any) {
      console.error("[Voice] Mic access failed:", e);
      const detail = e.message || 'Unknown error';
      let hint = '';
      if (detail.includes('Permission') || detail.includes('NotAllowed')) {
        hint = '\n💡 Allow microphone access in your browser settings.';
      } else if (detail.includes('model') || detail.includes('404') || detail.includes('not found')) {
        hint = '\n💡 The Live API model may not be available with your API key. Check if billing is enabled on your Google Cloud project.';
      } else if (detail.includes('WebSocket') || detail.includes('network')) {
        hint = '\n💡 WebSocket connection failed — check your network. Some firewalls block WebSocket connections.';
      }
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `🎙️ Voice link failed: ${detail}${hint}`, timestamp: new Date() }]);
      setIsMicActive(false);
    }
  };

  const toggleVisualLink = async () => {
    if (telemetry.isVisualActive) {
      if (telemetry.visualStream) telemetry.visualStream.getTracks().forEach(track => track.stop());
      setTelemetry(prev => ({ ...prev, isVisualActive: false, visualStream: null }));
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setTelemetry(prev => ({ ...prev, isVisualActive: true, visualStream: stream, isActive: true }));
        stream.getVideoTracks()[0].onended = () => setTelemetry(prev => ({ ...prev, isVisualActive: false, visualStream: null }));
      } catch (err) { console.error("Screen capture failed", err); }
    }
  };

  const captureFrame = async (): Promise<string | null> => {
    if (!canvasRef.current || !telemetry.visualStream) return null;
    const video = document.createElement('video');
    video.srcObject = telemetry.visualStream;
    await new Promise(r => video.onloadedmetadata = r);
    await video.play();
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    video.pause();
    return base64;
  };

  const handlePurgeHistory = () => {
    setMessages([]);
    userScopeService.scopedRemove('chat_history');
    activityService.resetNeuralLoad();
    handleSend("Session reset. Context flushed.");
    setShowClearConfirm(false);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        data: (ev.target?.result as string).split(',')[1],
        size: (file.size / 1024).toFixed(1) + ' KB'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  // ─── Auto-Compaction ─────────────────────────────────
  const compactHistory = async (msgs: ChatMessage[]): Promise<ChatMessage[]> => {
    const charCount = JSON.stringify(msgs).length;
    const tokenEstimate = Math.ceil(charCount / 4);

    if (tokenEstimate < COMPACT_THRESHOLD || msgs.length <= COMPACT_KEEP_RECENT * 2 + 2) {
      return msgs; // No compaction needed
    }

    // Split into old (to summarize) and recent (to keep)
    const keepCount = COMPACT_KEEP_RECENT * 2; // pairs of user+model
    const oldMessages = msgs.slice(0, msgs.length - keepCount);
    const recentMessages = msgs.slice(msgs.length - keepCount);

    // Build a digest of old messages for summarization
    const digest = oldMessages.map(m => `[${m.role}]: ${m.content}`).join('\n').slice(0, 8000);

    try {
      const summaryResponse = await geminiService.sendMessage(
        [],
        `SYSTEM TASK: Compress the following conversation history into a concise summary (max 300 words). Preserve key facts, decisions, action items, and any important context. Do NOT add commentary — just the compressed summary.\n\n---\n${digest}`,
        '',
        'LOW'
      );

      const summaryText = summaryResponse.text || 'Previous conversation context was compacted.';

      const compactedMsg: ChatMessage = {
        id: 'compact_' + Date.now(),
        role: 'model',
        content: `♻️ **Context Compacted** — ${oldMessages.length} older messages summarized to save tokens:\n\n> ${summaryText}`,
        timestamp: new Date()
      };

      setWasCompacted(true);
      setTimeout(() => setWasCompacted(false), 10000);
      activityService.log('IDLE', `♻️ Compacted ${oldMessages.length} messages → saved ~${Math.round((tokenEstimate - Math.ceil(JSON.stringify([compactedMsg, ...recentMessages]).length / 4)))} tokens`);

      // Persist compacted summary to VPS for cross-session memory
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const existingArchive = userScopeService.scopedGet('memory_archive') || '';
        const newArchive = `${existingArchive}\n\n---\n**[${new Date().toLocaleString()}]** ${oldMessages.length} messages compacted:\n${summaryText}`.trim();
        userScopeService.scopedSet('memory_archive', newArchive);

        // Save to VPS as persistent file
        gatewayService.saveFileToServer({
          id: 'context_archive',
          name: 'context_archive.md',
          type: 'OTHER' as any,
          category: 'OPERATIONS' as any,
          size: `${newArchive.length}`,
          lastModified: new Date().toISOString(),
          status: 'ACTIVE' as any,
          content: `# 🧠 Claw Persistent Memory\n\nAuto-compacted conversation context. Loaded on each session to maintain continuity.\n\n${newArchive}`
        });
        activityService.log('IDLE', `💾 Memory archive saved to VPS (${Math.ceil(newArchive.length / 4)} tokens)`);
      } catch (e) {
        console.warn('[Compaction] VPS save failed:', e);
      }

      return [compactedMsg, ...recentMessages];
    } catch (e) {
      console.error('[Compaction] Failed:', e);
      // Fallback: just trim old messages without AI summary
      const fallbackMsg: ChatMessage = {
        id: 'compact_' + Date.now(),
        role: 'model',
        content: `♻️ **Context Compacted** — ${oldMessages.length} older messages trimmed to free up token space.`,
        timestamp: new Date()
      };
      return [fallbackMsg, ...recentMessages];
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const finalInput = overrideInput || input;
    if ((!finalInput.trim() && !selectedFile && !telemetry.isVisualActive) || isProcessing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: finalInput + (selectedFile ? `\n\n[FILE: ${selectedFile.name}]` : '') + (telemetry.isVisualActive ? '\n\n[VISUAL LINK: ACTIVE]' : ''),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    let visualFrame: any = null;
    if (telemetry.isVisualActive) {
      const frame = await captureFrame();
      if (frame) visualFrame = { name: 'telemetry_shot.jpg', type: 'image/jpeg', data: frame };
    }

    try {
      // Auto-compact if context is getting large
      let allMessages = [...messages, userMsg];
      const compacted = await compactHistory(allMessages);
      if (compacted.length < allMessages.length) {
        // Compaction happened — update state with compacted history
        setMessages(compacted);
        allMessages = compacted;
      }
      let currentMessages = allMessages;
      let response = await agentService.executeCommand(finalInput || "Scanning...", currentMessages, contextData, {
        thinking: thinkingDepth, channel: 'WEB', sessionId: 'default', agentId: 'OPS'
      }, selectedFile || visualFrame);

      setSelectedFile(null);

      // --- Function Call Feedback Loop ---
      // When Claw calls tools like browseWeb, we execute them and feed results
      // back to Gemini so it can chain actions (NAVIGATE → SCRAPE → CLICK → etc.)
      let loopCount = 0;
      const MAX_LOOPS = 8;

      while (response.functionCalls && response.functionCalls.length > 0 && onAction && loopCount < MAX_LOOPS) {
        loopCount++;

        // Show Claw's text if any (e.g. "Navigating to...")
        if (response.text) {
          const modelMsg: ChatMessage = { id: Date.now().toString() + `_m${loopCount}`, role: 'model', content: response.text, timestamp: new Date() };
          setMessages(prev => [...prev, modelMsg]);
          currentMessages = [...currentMessages, { role: 'model', content: response.text }];
        }

        // Execute all function calls and collect results
        const toolResults: string[] = [];
        for (const fc of response.functionCalls) {
          const res = await onAction(fc);
          if (res) {
            toolResults.push(`[${fc.name}]: ${res}`);
            // Show intermediate results so user can see progress
            setMessages(prev => [...prev, { id: Date.now().toString() + `_t${loopCount}`, role: 'model', content: res as string, timestamp: new Date() }]);
          }
        }

        // Feed tool results back to Gemini so it can decide the next step
        const toolFeedback = toolResults.join('\n\n');
        const feedbackMsg = { role: 'user', content: `[TOOL RESULTS]:\n${toolFeedback}\n\nContinue with the next step if needed. If the task is complete, summarize what you found.` };
        currentMessages = [...currentMessages, feedbackMsg];

        // Send follow-up to Gemini
        response = await agentService.executeCommand(feedbackMsg.content, currentMessages, contextData, {
          thinking: thinkingDepth, channel: 'WEB', sessionId: 'default', agentId: 'OPS'
        });
      }

      // Show final response text
      const finalText = response.text || "I'm listening. What should we do next?";
      setMessages(prev => [...prev, { id: Date.now().toString() + '_final', role: 'model', content: finalText, timestamp: new Date() }]);

      // Handle any remaining non-browser function calls from the final response
      if (response.functionCalls && onAction) {
        for (const fc of response.functionCalls) {
          if (fc.name !== 'browseWeb') {
            const res = await onAction(fc);
            if (res) setMessages(prev => [...prev, { id: Date.now().toString() + '_r', role: 'model', content: res as string, timestamp: new Date() }]);
          }
        }
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); activityService.setIdle(); }
  };

  return (
    <div
      className="shrink-0 border-l border-white/10 glass-panel flex flex-col h-full relative z-10 shadow-2xl overflow-hidden min-w-0"
      style={{ width: `${panelWidth}px` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-rose-500/20 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-rose-500">
          <UploadCloud className="w-16 h-16 text-rose-500 animate-bounce mb-4" />
          <p className="text-white font-bold uppercase tracking-widest text-sm">Drop to Analyze</p>
        </div>
      )}
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group"
        onMouseDown={handleResizeStart}
      >
        <div className="w-0.5 h-full mx-auto bg-white/5 group-hover:bg-rose-500/50 transition-colors" />
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/[0.02] shrink-0">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClawMini isThinking={isProcessing || isMicActive} />
            <ContextHealthGauge messages={messages} compacted={wasCompacted} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-2 rounded-xl bg-white/5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-white/5 hover:border-rose-500/30"
              title="Reset Session Context"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={toggleVisualLink} className={`p-1.5 rounded-lg transition-all border ${telemetry.isVisualActive ? 'bg-rose-600 text-white border-rose-400' : 'bg-white/5 text-white/30 border-white/5'}`}>{telemetry.isVisualActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
              <button onClick={() => setThinkingDepth('LOW')} className={`p-1.5 rounded-md transition-all ${thinkingDepth === 'LOW' ? 'bg-rose-600 text-white' : 'text-white/30'}`}><Zap className="w-3 h-3" /></button>
              <button onClick={() => setThinkingDepth('HIGH')} className={`p-1.5 rounded-md transition-all ${thinkingDepth === 'HIGH' ? 'bg-rose-600 text-white' : 'text-white/30'}`}><Brain className="w-3 h-3" /></button>
            </div>
            {/* Font size controls */}
            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5 items-center gap-0.5">
              <button onClick={() => adjustFont(-1)} className="p-1.5 rounded-md text-white/30 hover:text-white transition-all" title="Smaller text"><Minus className="w-3 h-3" /></button>
              <span className="text-[8px] font-mono text-white/40 w-4 text-center">{fontSize}</span>
              <button onClick={() => adjustFont(1)} className="p-1.5 rounded-md text-white/30 hover:text-white transition-all" title="Larger text"><Plus className="w-3 h-3" /></button>
            </div>
          </div>
        </div>
        {/* Active Model Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.03] rounded-lg border border-white/5">
          <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[7px] font-mono text-white/30 uppercase tracking-widest truncate">
            {(() => {
              const m = userScopeService.scopedGet('preferred_model');
              if (!m || m === 'DYNAMIC') return 'Dynamic (Auto)';
              // Shorten OpenRouter model names: 'anthropic/claude-sonnet-4-20250514' → 'claude-sonnet-4'
              if (m.includes('/')) {
                const short = m.split('/').pop()!;
                return short.replace(/-\d{8}$/, '');  // strip date suffix
              }
              return m;
            })()}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col max-w-[90%] min-w-0 ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
            <div className={`rounded-2xl p-3.5 relative backdrop-blur-md shadow-lg break-words w-full ${msg.role === 'user' ? 'bg-rose-600/80 text-white rounded-br-sm' : 'bg-white/[0.05] text-slate-100 rounded-bl-sm border border-white/[0.06]'}`} style={{ fontSize: `${fontSize}px` }}>
              <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</div>
              <div className="mt-1.5 text-[8px] opacity-30 font-semibold tracking-wide">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="px-2 pb-4">
            <NeuralReadinessGauge progress={readiness} status={currentStatus} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip className="w-3 h-3 text-rose-400" />
            <span className="text-[10px] text-white font-mono truncate">{selectedFile.name}</span>
            <span className="text-[9px] text-white/40 font-mono">({selectedFile.size})</span>
          </div>
          <button onClick={() => setSelectedFile(null)} className="p-1 hover:text-white text-white/40"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Creative Command Palette */}
      {showCreativeMenu && (
        <div className="absolute bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="m-3 mb-[140px] bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">What can Claw do?</span>
              </div>
              <button onClick={() => setShowCreativeMenu(false)} className="p-1.5 rounded-lg bg-white/5 text-white/30 hover:text-white transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto scrollbar-hide">
              {CREATIVE_COMMANDS.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setShowCreativeMenu(false);
                    handleSend(cmd.prompt);
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cmd.color} flex items-center justify-center shadow-lg shrink-0 group-hover:scale-110 transition-transform`}>
                    <cmd.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors leading-tight">{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-slate-950/40 backdrop-blur-3xl border-t border-white/5 shrink-0">
        {!isProcessing && <div className="max-w-full overflow-x-hidden"><SmartSuggestions activeView={activeView} onSelect={(prompt) => handleSend(prompt)} /></div>}
        <div className="p-4 pt-2">
          <div className="relative group flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask Claw a question..."
              rows={2}
              className="flex-1 bg-black/30 border border-white/[0.08] rounded-xl p-3.5 pr-10 text-[13px] text-white focus:outline-none focus:border-rose-500/30 resize-none font-medium transition-all"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowCreativeMenu(!showCreativeMenu)}
                className={`p-3 rounded-xl border transition-all ${showCreativeMenu ? 'bg-gradient-to-br from-violet-600 to-rose-600 border-violet-400/50 text-white shadow-glow-lobster' : 'bg-white/5 border-white/5 text-white/30 hover:text-violet-400 hover:border-violet-500/30'}`}
                title="Creative Commands"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  onClick={toggleMic}
                  onContextMenu={(e) => { e.preventDefault(); setShowVoicePicker(!showVoicePicker); }}
                  onMouseDown={() => { micLongPressTimer.current = setTimeout(() => setShowVoicePicker(true), 500); }}
                  onMouseUp={() => clearTimeout(micLongPressTimer.current)}
                  onMouseLeave={() => clearTimeout(micLongPressTimer.current)}
                  onTouchStart={() => { micLongPressTimer.current = setTimeout(() => setShowVoicePicker(true), 500); }}
                  onTouchEnd={() => clearTimeout(micLongPressTimer.current)}
                  className={`p-3 rounded-xl border transition-all ${isMicActive ? 'bg-rose-600 border-rose-400 text-white shadow-glow-lobster' : 'bg-white/5 border-white/5 text-white/30 hover:text-white'}`}
                  title={`Voice: ${selectedVoice.emoji} ${selectedVoice.name} — Right-click to change`}
                >
                  {isMicActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
                </button>

                {/* Active Voice Label */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[7px] font-black uppercase tracking-widest text-white/25">{selectedVoice.emoji} {selectedVoice.name}</span>
                </div>

                {/* Voice Picker Popup */}
                {showVoicePicker && (
                  <div className="absolute bottom-14 right-0 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="glass-panel border border-white/10 rounded-2xl p-3 shadow-2xl min-w-[200px]">
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <Volume2 className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Voice Profile</span>
                      </div>
                      <div className="space-y-1.5">
                        {VOICE_PROFILES.map(v => {
                          const isActive = selectedVoice.id === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => {
                                setSelectedVoice(v);
                                userScopeService.scopedSet('voice_profile', v.id);
                                setShowVoicePicker(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group
                                ${isActive
                                  ? `bg-${v.color}-500/15 border border-${v.color}-500/30 shadow-glow`
                                  : 'bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10'}`}
                            >
                              <span className="text-lg">{v.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-white/70'}`}>{v.name}</span>
                                  <span className="text-[8px] text-white/30 font-mono">{v.gender}</span>
                                </div>
                                <span className="text-[9px] text-white/40 font-mono">{v.desc}</span>
                              </div>
                              {isActive && <div className={`w-1.5 h-1.5 rounded-full bg-${v.color}-500 animate-pulse`} />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 px-1">
                        <p className="text-[7px] text-white/20 font-mono italic">Right-click or long-press mic to change</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => handleSend()} disabled={isProcessing} className="p-3 bg-rose-600 text-white rounded-xl shadow-xl disabled:opacity-50 transition-all">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-3 right-14 p-2 text-white/20 hover:text-white transition-all">
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }} />
        </div>
      </div>

      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="glass-panel p-8 rounded-[32px] border-white/10 text-center max-w-xs">
            <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-4" />
            <h3 className="text-white font-bold text-sm uppercase tracking-tight mb-2">Reset Session?</h3>
            <div className="flex gap-3">
              <button onClick={handlePurgeHistory} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Confirm</button>
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 bg-white/5 text-white/40 rounded-xl text-[9px] font-black uppercase tracking-widest">Abort</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenClawAgent;
