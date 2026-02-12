import React, { useRef, useEffect, useState } from 'react';
import {
    Globe, Shield, ExternalLink, MousePointer2, Keyboard, X,
    ArrowRight, Lock, Fingerprint, Eye, Camera, Activity,
    ArrowLeft, ArrowRight as ArrowRightIcon, RotateCw, ShieldCheck,
    Search, Terminal, Hash, Sparkles, Layout, Database, Code, Zap,
    ChevronRight, Maximize2, Minimize2
} from 'lucide-react';
import { TelemetryState } from '../types';

interface TelemetryPopupProps {
    telemetry: TelemetryState;
    onClose: () => void;
    onTakeWheel: () => void;
}

const PincerCursor = ({ status }: { status: string }) => (
    <div className={`absolute pointer-events-none z-[100] transition-all duration-1000 ease-in-out transform -translate-x-1/2 -translate-y-1/2 group
        ${status === 'ROAMING' ? 'animate-bounce' : ''}`}
        style={{
            left: status === 'ROAMING' ? '70%' : status === 'SCRAPING' ? '30%' : '50%',
            top: status === 'ROAMING' ? '60%' : status === 'SCRAPING' ? '20%' : '45%'
        }}>
        <div className="relative">
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.9)]">
                <path fill="currentColor" d="M12 2C12 2 7 3 5 8C3 13 4 17 8 20C12 23 16 23 20 20C24 17 25 13 23 8C21 3 16 2 16 2" />
                <path fill="#fff" d="M9 10C9 10 7 11 7 13C7 15 9 16 9 16" className="opacity-40" />
                <path fill="#fff" d="M15 10C15 10 17 11 17 13C17 15 15 16 15 16" className="opacity-40" />
            </svg>
        </div>
    </div>
);

const TelemetryPopup: React.FC<TelemetryPopupProps> = ({ telemetry, onClose, onTakeWheel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [displayUrl, setDisplayUrl] = useState('');
    const [isHighRes, setIsHighRes] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (telemetry.isVisualActive && telemetry.visualStream && videoRef.current) {
            videoRef.current.srcObject = telemetry.visualStream;
        }
        if (telemetry.url) {
            setDisplayUrl(telemetry.url);
        }
    }, [telemetry.isVisualActive, telemetry.visualStream, telemetry.url]);

    if (!telemetry.isActive) return null;

    const isRoaming = telemetry.status === 'ROAMING' || telemetry.status === 'NAVIGATING' || telemetry.status === 'SCRAPING';

    return (
        <div className={`fixed bottom-6 z-[4000] animate-in slide-in-from-bottom-10 duration-500 flex items-end justify-center pointer-events-none transition-all
        ${isExpanded ? 'inset-0 right-0 left-0 bottom-0 p-8' : 'right-[480px] left-80'}
    `}>
            <div className={`glass-panel rounded-[40px] overflow-hidden flex flex-col border transition-all duration-500 pointer-events-auto shadow-[0_40px_100px_rgba(0,0,0,0.9)] 
        ${isExpanded ? 'w-full h-full max-w-none max-h-none' : 'max-h-[80vh] w-full max-w-[900px]'}
        ${isRoaming || telemetry.isVisualActive ? 'border-rose-500/40 shadow-[0_0_60px_rgba(244,63,94,0.25)]' : 'border-white/10'}
      `}>

                {/* Browser Chrome */}
                <div className="bg-slate-900/95 backdrop-blur-3xl p-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex gap-1.5 shrink-0">
                            <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/40"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/20"></div>
                        </div>
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                onClick={() => setIsHighRes(!isHighRes)}
                                className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all
                            ${isHighRes ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white/20 border-white/10'}
                        `}
                            >
                                {isHighRes && <ShieldCheck className="w-2.5 h-2.5" />}
                                Crystal Clear {isHighRes ? 'ON' : 'OFF'}
                            </button>
                            <div className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2 truncate ${isRoaming ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-white/5 text-white/20 border-white/10'}`}>
                                {isRoaming && <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-glow-lobster"></div>}
                                Pilot {telemetry.status}
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/20 hover:text-white">
                                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                                <button onClick={onClose} className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-all text-white/20 hover:text-rose-500">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-black/40 rounded-xl p-0.5 shrink-0">
                            <button className="p-1.5 text-white/20 hover:text-white transition-colors"><ArrowLeft className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 text-white/20 hover:text-white transition-colors"><ArrowRightIcon className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="flex-1 relative group min-w-0">
                            <div className="w-full bg-black/60 border border-white/10 rounded-xl py-2 px-10 text-[10px] font-mono text-white/80 overflow-hidden truncate shadow-inner">
                                {displayUrl || 'about:blank'}
                            </div>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2"><Lock className="w-3 h-3 text-emerald-500" /></div>
                        </div>
                    </div>
                </div>

                {/* Content Viewport */}
                <div className={`flex-1 bg-slate-950 relative overflow-hidden group shrink transition-all ${isExpanded ? 'h-full' : 'min-h-[300px] aspect-video'}`}>
                    {telemetry.isVisualActive ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-contain relative z-10 transition-all ${isHighRes ? 'filter saturate-125' : 'opacity-80 blur-[0.5px]'}`}
                        />
                    ) : (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 text-white/20">
                            <Globe className="w-20 h-20 mb-4 animate-pulse" />
                            <p className="font-mono text-[10px] uppercase tracking-widest">Awaiting Neural Projection...</p>
                        </div>
                    )}

                    <div className="absolute inset-0 z-20 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>

                    {telemetry.status === 'ROAMING' && <PincerCursor status="ROAMING" />}

                    {telemetry.status === 'WAITING_FOR_OPERATOR' && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-md">
                            <div className="glass-panel p-8 rounded-[40px] border-rose-500/20 text-center max-w-sm">
                                <Lock className="w-10 h-10 text-rose-500 mx-auto mb-4" />
                                <h4 className="text-white font-bold text-lg uppercase tracking-tight mb-2">Operator Handshake Required</h4>
                                <p className="text-xs text-white/50 mb-6 font-mono">"Manual authentication is required to bypass this node."</p>
                                <button onClick={onTakeWheel} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl">Take Control</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Trace */}
                <div className="p-4 bg-slate-900/95 border-t border-white/5 shrink-0">
                    <div className="bg-black/60 rounded-2xl p-3 border border-white/10 flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 mt-0.5 shrink-0">
                            <Terminal className="w-3.5 h-3.5 text-rose-500/40" />
                            <Activity className="w-2.5 h-2.5 text-emerald-500/40 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono text-rose-500/90 italic leading-tight line-clamp-2">
                                {telemetry.lastAction || 'Establishing forensic link with 2026 tactical target...'}
                            </p>
                            <div className="flex gap-4 mt-2 opacity-20">
                                <span className="text-[7px] font-mono text-white uppercase tracking-widest">Res: {isExpanded ? '1920x1080' : '1280x720'}</span>
                                <span className="text-[7px] font-mono text-white uppercase tracking-widest">Mode: {isHighRes ? 'LOSSLESS' : 'ECON'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TelemetryPopup;