
import React, { useState, useRef, useEffect } from 'react';
import { ClawAgent, AgentChatMessage } from '../types';
import { Send, X, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { getApiKey } from '../services/geminiService';
import { openRouterService } from '../services/openRouterService';

interface AgentChatPanelProps {
    agent: ClawAgent;
    onClose: () => void;
    onUpdateAgent: (agent: ClawAgent) => void;
}

const COLOR_MAP: Record<string, { accent: string; border: string; bg: string; glow: string; bubbleBg: string }> = {
    rose: { accent: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]', bubbleBg: 'bg-rose-600/80' },
    emerald: { accent: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]', bubbleBg: 'bg-emerald-600/80' },
    amber: { accent: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]', bubbleBg: 'bg-amber-600/80' },
    cyan: { accent: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]', bubbleBg: 'bg-cyan-600/80' },
    indigo: { accent: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]', bubbleBg: 'bg-indigo-600/80' },
    violet: { accent: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', glow: 'shadow-[0_0_20px_rgba(139,92,246,0.15)]', bubbleBg: 'bg-violet-600/80' },
    pink: { accent: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10', glow: 'shadow-[0_0_20px_rgba(236,72,153,0.15)]', bubbleBg: 'bg-pink-600/80' },
    slate: { accent: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-500/10', glow: 'shadow-[0_0_20px_rgba(100,116,139,0.15)]', bubbleBg: 'bg-slate-600/80' },
};

const AgentChatPanel: React.FC<AgentChatPanelProps> = ({ agent, onClose, onUpdateAgent }) => {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const colors = COLOR_MAP[agent.color] || COLOR_MAP.slate;
    const history = agent.chatHistory || [];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history.length, isProcessing]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isProcessing) return;

        const userMsg: AgentChatMessage = {
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        };

        const updatedHistory = [...history, userMsg];
        onUpdateAgent({ ...agent, chatHistory: updatedHistory });
        setInput('');
        setIsProcessing(true);

        const systemPrompt = `You are ${agent.name} ${agent.mascot}, a specialized ${agent.specialty} operative in Claw's Agent Squad.

CURRENT DATE & TIME: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}

YOUR PERSONA:
- Your mascot/avatar is ${agent.mascot}
- Your specialty is: ${agent.specialty}
- Your current quest is: "${agent.quest}"
- Your current status is: ${agent.status}
- You report to the squad leader of this ClawKeep instance

PERSONALITY RULES:
- Stay in character as a ${agent.specialty.toLowerCase()} specialist
- Be concise, tactical, and helpful
- Reference your quest when relevant
- Use your mascot emoji occasionally
- Speak like a focused operative reporting to HQ
- If asked about things outside your specialty, still help but note it's outside your lane
- Keep responses under 3 paragraphs unless the user needs detail`;

        try {
            let responseText = '';

            if (agent.modelId && openRouterService.isAvailable()) {
                // --- OpenRouter path (e.g. free Qwen) ---
                const historyForOR = updatedHistory.map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.content
                }));
                const result = await openRouterService.sendAgentMessage(
                    systemPrompt,
                    text,
                    [], // no tools for agent chat
                    agent.modelId
                );
                responseText = result.text;
            } else if (getApiKey()) {
                // --- Gemini path (has Gemini key) ---
                const ai = new GoogleGenAI({ apiKey: getApiKey() });

                const geminiHistory = updatedHistory.map(msg => ({
                    role: msg.role === 'user' ? 'user' as const : 'model' as const,
                    parts: [{ text: msg.content }]
                }));

                const cleanHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
                for (let i = 0; i < geminiHistory.length - 1; i++) {
                    if (i === 0 && geminiHistory[i].role !== 'user') continue;
                    if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === geminiHistory[i].role) {
                        cleanHistory[cleanHistory.length - 1].parts[0].text += '\n\n' + geminiHistory[i].parts[0].text;
                    } else {
                        cleanHistory.push({ ...geminiHistory[i] });
                    }
                }

                const chat = ai.chats.create({
                    model: 'gemini-2.0-flash',
                    config: { systemInstruction: systemPrompt },
                    history: cleanHistory
                });

                const result = await chat.sendMessage({ message: [{ text: text }] });
                responseText = result.text || '';
            } else if (openRouterService.isAvailable()) {
                // --- OpenRouter fallback (no Gemini key, but has OpenRouter key) ---
                const result = await openRouterService.sendAgentMessage(
                    systemPrompt,
                    text,
                    []
                );
                responseText = result.text;
            } else {
                responseText = `⚠️ No API key configured. Add a Gemini or OpenRouter key in Vault → Secrets to chat with agents.`;
            }

            const modelMsg: AgentChatMessage = {
                role: 'model',
                content: responseText || `${agent.mascot} ...standing by.`,
                timestamp: new Date().toISOString()
            };

            onUpdateAgent({ ...agent, chatHistory: [...updatedHistory, modelMsg] });
        } catch (err: any) {
            const errorMsg: AgentChatMessage = {
                role: 'model',
                content: `${agent.mascot} Comms disrupted: ${err.message}`,
                timestamp: new Date().toISOString()
            };
            onUpdateAgent({ ...agent, chatHistory: [...updatedHistory, errorMsg] });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[4000] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className={`w-full max-w-lg mb-0 sm:mb-6 rounded-t-[32px] sm:rounded-[32px] glass-panel flex flex-col overflow-hidden ${colors.glow} border ${colors.border}`}
                style={{ maxHeight: '75vh', animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-5 border-b border-white/5 ${colors.bg} shrink-0`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border ${colors.border} ${colors.bg} shadow-lg`}>
                                {agent.mascot}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                                    {agent.name}
                                    <Sparkles className={`w-3.5 h-3.5 ${colors.accent}`} />
                                </h3>
                                <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest">{agent.specialty} Operative</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Quest Banner */}
                    <div className={`mt-3 px-3 py-2 rounded-xl bg-white/5 border border-white/5`}>
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Active Quest: </span>
                        <span className="text-[10px] text-white/50 font-mono italic">"{agent.quest}"</span>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide min-h-0" style={{ minHeight: '200px' }}>
                    {history.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <span className="text-5xl mb-4 opacity-40">{agent.mascot}</span>
                            <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-black">Channel Open</p>
                            <p className="text-[9px] text-white/15 font-mono mt-1">Send a message to {agent.name}</p>
                        </div>
                    )}
                    {history.map((msg, i) => (
                        <div key={i} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                            {msg.role === 'model' && (
                                <span className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-1 ml-1">{agent.mascot} {agent.name}</span>
                            )}
                            <div className={`rounded-2xl px-4 py-3 text-[13px] shadow-lg break-words ${msg.role === 'user'
                                ? `${colors.bubbleBg} text-white rounded-br-sm`
                                : 'bg-white/[0.06] text-slate-100 rounded-bl-sm border border-white/[0.06]'
                                }`}>
                                <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</div>
                            </div>
                            <span className="text-[7px] text-white/15 font-mono mt-1 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                    {isProcessing && (
                        <div className="flex items-center gap-2 text-white/30 mr-auto">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${colors.bg} ${colors.border} border`}>
                                {agent.mascot}
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-4 py-3 border border-white/5">
                                <Loader2 className={`w-3.5 h-3.5 animate-spin ${colors.accent}`} />
                                <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-white/5 bg-slate-950/40 backdrop-blur-xl shrink-0">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={`Message ${agent.name}...`}
                            rows={1}
                            className={`flex-1 bg-black/30 border border-white/[0.08] rounded-xl p-3 text-[13px] text-white focus:outline-none focus:${colors.border} resize-none font-medium transition-all`}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isProcessing || !input.trim()}
                            className={`p-3 rounded-xl shadow-xl disabled:opacity-30 transition-all text-white ${colors.bubbleBg}`}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AgentChatPanel;
