
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Globe, X, Minimize2,
    ArrowLeft, ArrowRight as ArrowRightIcon, RotateCw,
    Search, Download, Monitor, Activity, Eye
} from 'lucide-react';
import { gatewayService } from '../services/gatewayService';

interface BrowserPopupProps {
    onClose: () => void;
}

const BrowserPopup: React.FC<BrowserPopupProps> = ({ onClose }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [urlInput, setUrlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [screenshot, setScreenshot] = useState<string>('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [currentTitle, setCurrentTitle] = useState('');
    const [thoughts, setThoughts] = useState<Array<{ message: string; timestamp: Date; type: string }>>([]);
    const [isMinimized, setIsMinimized] = useState(false);

    // Subscribe to browser updates
    useEffect(() => {
        const unsubscribe = gatewayService.subscribeBrowser((update) => {
            if (update.screenshot) {
                setScreenshot(update.screenshot);
            }
            if (update.url) {
                setCurrentUrl(update.url);
                setUrlInput(update.url);
            }
            if (update.title) setCurrentTitle(update.title);

            if (update.action) {
                setThoughts(prev => [{
                    message: update.action,
                    timestamp: new Date(),
                    type: update.status === 'ERROR' ? 'ERROR' :
                        update.action.includes('Navigate') ? 'NAV' :
                            update.action.includes('Download') ? 'DOWNLOAD' : 'ACTION'
                }, ...prev].slice(0, 30));
            }

            setIsLoading(false);

            if (update.status === 'CLOSED') {
                setScreenshot('');
                setCurrentUrl('');
                setCurrentTitle('');
            }
        });
        return unsubscribe;
    }, []);

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

    const handleViewportClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
        if (!imgRef.current) return;
        const rect = imgRef.current.getBoundingClientRect();
        const scaleX = 1280 / rect.width;
        const scaleY = 800 / rect.height;
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);
        setIsLoading(true);
        gatewayService.browserClick(undefined, x, y);
        setThoughts(prev => [{ message: `🖱️ Click at (${x}, ${y})`, timestamp: new Date(), type: 'ACTION' }, ...prev]);
    }, []);

    const thoughtColor = (type: string) => {
        switch (type) {
            case 'NAV': return 'text-cyan-400';
            case 'ERROR': return 'text-rose-400';
            case 'DOWNLOAD': return 'text-emerald-400';
            default: return 'text-white/60';
        }
    };

    // Minimized state — small floating badge at bottom
    if (isMinimized) {
        return (
            <div
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-3 shadow-[0_0_30px_rgba(6,182,212,0.15)] cursor-pointer hover:border-cyan-400/50 transition-all"
                onClick={() => setIsMinimized(false)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-white uppercase tracking-wider">BrowserPilot</p>
                        <p className="text-[9px] text-white/30 font-mono truncate max-w-[200px]">{currentUrl || 'Active'}</p>
                    </div>
                    {isLoading && <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />}
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/30 hover:text-rose-400 transition-all ml-2"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    }

    // Whether Claw is actively driving the browser
    const isActive = !!screenshot || isLoading;

    // Full panel — docked into the content area, NOT a fullscreen overlay
    return (
        <div className={`fixed inset-0 z-[500] flex flex-col bg-slate-950/98 animate-in fade-in duration-200 ${isActive ? 'browser-glow-active' : ''}`}>

            {/* Purple glow animation when Claw is active — uses box-shadow (not overflow) */}
            {isActive && (
                <style>{`
                    @keyframes borderGlow {
                        0%, 100% { 
                            box-shadow: inset 0 0 30px rgba(139, 92, 246, 0.15), 
                                        inset 0 0 60px rgba(139, 92, 246, 0.05),
                                        0 0 15px rgba(139, 92, 246, 0.1),
                                        0 0 30px rgba(139, 92, 246, 0.05);
                            border-color: rgba(139, 92, 246, 0.2);
                        }
                        50% { 
                            box-shadow: inset 0 0 40px rgba(139, 92, 246, 0.25), 
                                        inset 0 0 80px rgba(168, 85, 247, 0.1),
                                        0 0 20px rgba(139, 92, 246, 0.2),
                                        0 0 50px rgba(168, 85, 247, 0.1);
                            border-color: rgba(139, 92, 246, 0.4);
                        }
                    }
                    .browser-glow-active {
                        animation: borderGlow 3s ease-in-out infinite !important;
                        border: 1px solid rgba(139, 92, 246, 0.3) !important;
                    }
                `}</style>
            )}

            {/* Title Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                        <Globe className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-white tracking-tight">BrowserPilot</h2>
                        <p className="text-[8px] text-white/30 font-mono truncate max-w-[300px]">{currentTitle || 'Headless Chrome — VPS'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {isLoading && (
                        <div className="flex items-center gap-1.5 text-cyan-400 mr-2">
                            <Activity className="w-3 h-3 animate-pulse" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Loading</span>
                        </div>
                    )}
                    <button onClick={() => setIsMinimized(true)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all" title="Minimize — lets you see the main view while browser stays active">
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/30 hover:text-rose-400 transition-all">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* URL Bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-white/[0.01] shrink-0">
                <div className="flex items-center gap-0.5">
                    <button onClick={() => gatewayService.browserBack()} className="p-1 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all">
                        <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button onClick={() => gatewayService.browserForward()} className="p-1 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all">
                        <ArrowRightIcon className="w-3 h-3" />
                    </button>
                    <button onClick={() => gatewayService.browserReload()} className={`p-1 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all ${isLoading ? 'animate-spin' : ''}`}>
                        <RotateCw className="w-3 h-3" />
                    </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleNavigate(); }} className="flex-1 flex items-center gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                        <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="Navigate to URL..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg py-1.5 pl-7 pr-3 text-[11px] text-white font-mono placeholder:text-white/15 focus:outline-none focus:border-cyan-500/50 transition-all"
                        />
                    </div>
                </form>
            </div>

            {/* Main Content — browser viewport + activity stream side-by-side */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Viewport */}
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                    {screenshot ? (
                        <img
                            ref={imgRef}
                            src={screenshot}
                            alt="Live Browser"
                            onClick={handleViewportClick}
                            className="w-full h-full object-contain cursor-crosshair"
                            draggable={false}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-3 text-white/20">
                            <Monitor className="w-12 h-12 opacity-30" />
                            <p className="text-xs font-medium">Waiting for BrowserPilot...</p>
                            <p className="text-[9px] text-white/10 font-mono">Claw will drive the browser automatically</p>
                        </div>
                    )}

                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                                <span className="text-[10px] text-cyan-400 font-mono">Navigating...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Activity Stream Sidebar */}
                <div className="w-[200px] border-l border-white/5 flex flex-col bg-white/[0.01] shrink-0">
                    <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
                        <Eye className="w-3 h-3 text-cyan-400" />
                        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Activity</span>
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                        {thoughts.length === 0 ? (
                            <p className="text-[9px] text-white/15 text-center py-6 font-mono">No activity yet</p>
                        ) : (
                            thoughts.map((t, i) => (
                                <div key={i} className="px-2 py-1 rounded-lg bg-white/[0.02] border border-white/5">
                                    <p className={`text-[9px] font-mono leading-tight ${thoughtColor(t.type)}`}>{t.message}</p>
                                    <p className="text-[7px] text-white/15 mt-0.5">{t.timestamp.toLocaleTimeString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrowserPopup;
