import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Globe, ExternalLink, MousePointer2,
    Lock, Activity,
    ArrowLeft, ArrowRight as ArrowRightIcon, RotateCw,
    Search, Terminal, Sparkles, Code, Zap,
    ChevronRight, Monitor, Send, Download, X, Eye,
    ChevronDown, ChevronUp, Keyboard
} from 'lucide-react';
import { TelemetryState } from '../types';
import { gatewayService } from '../services/gatewayService';
import { userScopeService } from '../services/userScopeService';

interface LiveBrowserViewProps {
    telemetry: TelemetryState;
    onTakeWheel: () => void;
}

const BOOKMARKS = [
    { name: 'Google', url: 'https://google.com', icon: '🔍' },
    { name: 'IRS', url: 'https://irs.gov', icon: '🏛️' },
    { name: 'Wikipedia', url: 'https://wikipedia.org', icon: '📚' },
    { name: 'GitHub', url: 'https://github.com', icon: '🐙' },
    { name: 'Maps', url: 'https://maps.google.com', icon: '🗺️' },
];

const LiveBrowserView: React.FC<LiveBrowserViewProps> = ({ telemetry, onTakeWheel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [urlInput, setUrlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [currentTitle, setCurrentTitle] = useState('');
    const [thoughts, setThoughts] = useState<Array<{ message: string; timestamp: Date; type: string }>>([]);
    const [browserActive, setBrowserActive] = useState(false);
    const [showThoughts, setShowThoughts] = useState(false);
    const [hasFrames, setHasFrames] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const imgCacheRef = useRef<HTMLImageElement | null>(null);

    // Subscribe to BROWSER_UPDATE for metadata (url, title, action status)
    useEffect(() => {
        const unsubscribe = gatewayService.subscribeBrowser((update) => {
            if (update.url) {
                setCurrentUrl(update.url);
                setUrlInput(update.url);
            }
            if (update.title) setCurrentTitle(update.title);
            setBrowserActive(true);
            setIsLoading(false);

            if (update.action) {
                setThoughts(prev => [{
                    message: update.action,
                    timestamp: new Date(),
                    type: update.status === 'ERROR' ? 'ERROR' :
                        update.action.includes('Navigate') ? 'NAV' :
                            update.action.includes('Download') ? 'DOWNLOAD' : 'ACTION'
                }, ...prev].slice(0, 50));
            }

            if (update.status === 'CLOSED') {
                setBrowserActive(false);
                setHasFrames(false);
                setCurrentUrl('');
                setCurrentTitle('');
            }
        });
        return unsubscribe;
    }, []);

    // Subscribe to BROWSER_FRAME for real-time screencast
    useEffect(() => {
        const unsubscribe = gatewayService.subscribeFrame((frame) => {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;

            // Create/reuse cached Image object
            if (!imgCacheRef.current) {
                imgCacheRef.current = new Image();
            }
            const img = imgCacheRef.current;
            img.onload = () => {
                if (!canvasRef.current) return;
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
                ctx.drawImage(img, 0, 0);
                if (!hasFrames) setHasFrames(true);
            };
            img.src = 'data:image/jpeg;base64,' + frame.data;
        });
        return unsubscribe;
    }, [hasFrames]);

    // Auto-navigate if launched from dashboard
    useEffect(() => {
        const pendingUrl = userScopeService.scopedGet('browser_url');
        if (pendingUrl) {
            userScopeService.scopedRemove('browser_url');
            setTimeout(() => handleNavigate(pendingUrl), 300);
        }
    }, []);

    // Auto-scroll thought stream
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [thoughts]);

    const handleNavigate = useCallback((url?: string) => {
        const target = url || urlInput;
        if (!target.trim()) return;
        let cleanUrl = target.trim();
        if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
        setIsLoading(true);
        setUrlInput(cleanUrl);
        gatewayService.browserNavigate(cleanUrl);
        setThoughts(prev => [{ message: `🧭 Navigating to ${cleanUrl}...`, timestamp: new Date(), type: 'NAV' }, ...prev]);
    }, [urlInput]);

    // --- CDP Input Forwarding Handlers ---
    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = 1280 / rect.width;
        const scaleY = 800 / rect.height;
        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY)
        };
    }, []);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        const button = e.button === 2 ? 'right' : 'left';
        gatewayService.browserMouse('mousePressed', x, y, button, 1);
        setIsFocused(true);
    }, [getCanvasCoords]);

    const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        const button = e.button === 2 ? 'right' : 'left';
        gatewayService.browserMouse('mouseReleased', x, y, button, 1);
    }, [getCanvasCoords]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        // Only send move events when mouse is pressed (drag) to avoid flooding
        if (e.buttons === 0) return;
        const { x, y } = getCanvasCoords(e);
        gatewayService.browserMouse('mouseMoved', x, y);
    }, [getCanvasCoords]);

    const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e as any);
        gatewayService.browserWheel(x, y, e.deltaX, e.deltaY);
    }, [getCanvasCoords]);

    const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
        if (!isFocused) return;
        // Don't capture browser shortcuts
        if (e.ctrlKey && ['r', 'l', 'w', 't', 'n'].includes(e.key.toLowerCase())) return;
        e.preventDefault();
        e.stopPropagation();

        let modifiers = 0;
        if (e.altKey) modifiers |= 1;
        if (e.ctrlKey) modifiers |= 2;
        // Meta = 4, Shift = 8
        if (e.metaKey) modifiers |= 4;
        if (e.shiftKey) modifiers |= 8;

        const text = e.key.length === 1 ? e.key : '';
        gatewayService.browserKeyEvent('keyDown', e.key, e.code, text, modifiers);
    }, [isFocused]);

    const handleCanvasKeyUp = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
        if (!isFocused) return;
        if (e.ctrlKey && ['r', 'l', 'w', 't', 'n'].includes(e.key.toLowerCase())) return;
        e.preventDefault();
        e.stopPropagation();

        let modifiers = 0;
        if (e.altKey) modifiers |= 1;
        if (e.ctrlKey) modifiers |= 2;
        if (e.metaKey) modifiers |= 4;
        if (e.shiftKey) modifiers |= 8;

        gatewayService.browserKeyEvent('keyUp', e.key, e.code, '', modifiers);
    }, [isFocused]);

    const thoughtColor = (type: string) => {
        switch (type) {
            case 'NAV': return 'text-cyan-400';
            case 'DOWNLOAD': return 'text-emerald-400';
            case 'ERROR': return 'text-red-400';
            default: return 'text-rose-400';
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Compact Browser Panel — fills entire view */}
            <div className="flex-1 flex flex-col min-h-0 m-3 glass-panel rounded-2xl overflow-hidden border-white/10 bg-black/40 shadow-2xl">

                {/* ═══ Browser Chrome Bar ═══ */}
                <div className="bg-slate-900/95 px-4 py-2.5 border-b border-white/5 flex items-center gap-3">
                    {/* Traffic lights */}
                    <div className="flex gap-1.5 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                    </div>

                    {/* Nav buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => { setIsLoading(true); gatewayService.browserBack(); }} className="p-1 hover:bg-white/5 rounded-lg text-white/20 hover:text-white/60 transition-all"><ArrowLeft className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setIsLoading(true); gatewayService.browserForward(); }} className="p-1 hover:bg-white/5 rounded-lg text-white/20 hover:text-white/60 transition-all"><ArrowRightIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setIsLoading(true); gatewayService.browserReload(); }} className={`p-1 hover:bg-white/5 rounded-lg text-white/20 hover:text-white/60 transition-all ${isLoading ? 'animate-spin' : ''}`}><RotateCw className="w-3.5 h-3.5" /></button>
                    </div>

                    {/* URL Bar */}
                    <div className="flex-1 flex items-center gap-2 bg-black/50 rounded-xl px-3 py-1.5 border border-white/5 focus-within:border-rose-500/30 transition-all">
                        <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
                        <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
                            placeholder="Type a URL and press Enter..."
                            className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder-white/20 outline-none"
                        />
                        <button onClick={() => handleNavigate()} className="p-1 hover:bg-rose-500/10 rounded-lg transition-all text-white/20 hover:text-rose-400">
                            <Send className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Action buttons */}
                    <button onClick={() => gatewayService.browserExtract()} className="p-1.5 hover:bg-cyan-500/10 rounded-lg text-white/20 hover:text-cyan-400 transition-all" title="Extract page content">
                        <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Focus indicator */}
                    {isFocused && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                            <Keyboard className="w-3 h-3 text-amber-400" />
                            <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">Typing</span>
                        </div>
                    )}

                    {/* Status indicator */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0 ${browserActive ? 'bg-rose-500/10' : 'bg-white/5'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${browserActive ? 'bg-rose-500 animate-pulse' : 'bg-white/20'}`}></div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${browserActive ? 'text-rose-400' : 'text-white/20'}`}>
                            {hasFrames ? 'Streaming' : browserActive ? 'Live' : 'Idle'}
                        </span>
                    </div>
                </div>

                {/* ═══ Bookmarks Bar ═══ */}
                <div className="bg-slate-900/60 px-4 py-1.5 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    {BOOKMARKS.map(b => (
                        <button key={b.name} onClick={() => handleNavigate(b.url)} className="px-2.5 py-0.5 rounded-md bg-white/[0.03] border border-white/5 text-[9px] text-white/40 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1 whitespace-nowrap shrink-0">
                            <span className="text-[10px]">{b.icon}</span> {b.name}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-1 text-[8px] text-white/15 font-mono shrink-0">
                        <span>Click canvas to interact • Scroll with mousewheel • Type with keyboard</span>
                    </div>
                </div>

                {/* ═══ Browser Viewport — Canvas-based screencast ═══ */}
                <div
                    ref={containerRef}
                    className={`flex-1 relative bg-slate-950 overflow-hidden flex items-center justify-center ${isFocused ? 'ring-2 ring-rose-500/30 ring-inset' : ''}`}
                    onClick={() => !hasFrames && setIsFocused(false)}
                >
                    {hasFrames ? (
                        <canvas
                            ref={canvasRef}
                            tabIndex={0}
                            className="w-full h-full object-contain cursor-default outline-none"
                            style={{ imageRendering: 'auto' }}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseMove={handleCanvasMouseMove}
                            onWheel={handleCanvasWheel}
                            onKeyDown={handleCanvasKeyDown}
                            onKeyUp={handleCanvasKeyUp}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onContextMenu={(e) => e.preventDefault()}
                        />
                    ) : isLoading ? (
                        <div className="flex flex-col items-center gap-4 animate-pulse text-rose-500/40">
                            <Monitor className="w-16 h-16" />
                            <p className="font-mono text-[10px] uppercase tracking-[0.4em]">Launching Chrome...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-white/10">
                            <Globe className="w-20 h-20" />
                            <p className="font-mono text-xs uppercase tracking-[0.3em]">Enter a URL to Start Browsing</p>
                            <p className="text-[9px] font-mono text-white/5 uppercase tracking-widest">Or ask Claw to navigate for you</p>
                            <div className="mt-4 flex flex-col items-center gap-2 text-[9px] text-white/8 font-mono">
                                <p>🖱️ Click &amp; scroll directly on the page</p>
                                <p>⌨️ Type passwords, fill forms, solve captchas</p>
                                <p>📡 Real-time streaming — see everything live</p>
                            </div>
                        </div>
                    )}

                    {/* Loading overlay */}
                    {isLoading && hasFrames && (
                        <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center pointer-events-none">
                            <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-xl border border-rose-500/20">
                                <RotateCw className="w-3 h-3 text-rose-500 animate-spin" />
                                <span className="text-[9px] font-mono text-rose-400 uppercase tracking-widest">Loading...</span>
                            </div>
                        </div>
                    )}

                    {/* Cursor overlay for Claw-driven navigation */}
                    {telemetry.status === 'ROAMING' && (
                        <div className="absolute inset-0 pointer-events-none z-50">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce">
                                <MousePointer2 className="w-8 h-8 text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)] fill-rose-500" />
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ Status Bar + Thought Toggle ═══ */}
                <div className="bg-slate-900/95 px-4 py-1.5 border-t border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Activity className={`w-3 h-3 ${browserActive ? 'text-rose-500 animate-pulse' : 'text-white/20'}`} />
                        <span className="text-[9px] font-mono text-white/40 truncate max-w-sm">{currentTitle || 'Ready'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[8px] font-mono text-white/15">1280×800</span>
                        <button
                            onClick={() => setShowThoughts(!showThoughts)}
                            className="flex items-center gap-1.5 text-[9px] font-mono text-white/30 hover:text-rose-400 transition-all"
                        >
                            <Terminal className="w-3 h-3" />
                            Log ({thoughts.length})
                            {showThoughts ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                        </button>
                        <button onClick={() => gatewayService.browserClose()} className="text-[9px] font-mono text-white/15 hover:text-red-400 transition-all">Kill</button>
                    </div>
                </div>

                {/* ═══ Collapsible Thought Stream ═══ */}
                {showThoughts && (
                    <div className="border-t border-white/5 bg-black/40 max-h-40 overflow-y-auto scrollbar-hide" ref={scrollRef}>
                        <div className="p-3 space-y-1.5">
                            {thoughts.length === 0 ? (
                                <p className="text-[9px] text-white/10 font-mono text-center py-3 uppercase tracking-widest">Navigate to see activity</p>
                            ) : thoughts.map((thought, i) => (
                                <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                                    <span className="text-[8px] text-white/15 shrink-0">{thought.timestamp.toLocaleTimeString()}</span>
                                    <span className={`${thoughtColor(thought.type)}`}>{thought.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveBrowserView;