
import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Command, Zap, History, ChevronRight, X, Cpu, Shell } from 'lucide-react';
import { activityService, ActivityLog } from '../services/activityService';

const TerminalView: React.FC = () => {
    const [history, setHistory] = useState<{ cmd: string; output: string }[]>([
        { cmd: 'claw --status', output: 'CLAWKEEP NEURAL CORE v1.0\nUPLINK: ACTIVE\nSECTOR: SECURE\nREADY FOR DIRECTIVES.' }
    ]);
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = activityService.subscribeLogs((logs) => {
            const lastLog = logs[0];
            if (lastLog && lastLog.type === 'TERMINAL') {
                setHistory(prev => [...prev, {
                    cmd: `[AI] ${lastLog.message}`,
                    output: lastLog.meta ? JSON.stringify(lastLog.meta, null, 2) : 'Execution successful.'
                }]);
            }
        });
        return unsubscribe;
    }, []);

    const handleCommand = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        let response = '';
        const cmd = input.toLowerCase().trim();

        if (cmd === 'help') {
            response = 'AVAILABLE COMMANDS:\n- claw --sweep : Search for savings\n- claw --analyze : Deep dive documents\n- status : System health check\n- ocr --scan : Run Deep-Parse OCR\n- risk --audit : Run Risk-Sense Analysis\n- clear : Wipe session';
        } else if (cmd === 'clear') {
            setHistory([]);
            setInput('');
            return;
        } else if (cmd.includes('risk')) {
            response = 'INITIALIZING RISK-SENSE AUDIT...\n[!] ALERT: Missing Indemnification Clause detected.\nAUDIT COMPLETE. FLAG FOR OWNER REVIEW.';
        } else if (cmd === 'status') {
            response = 'OS: ClawKeep v1.0\nLINK: 24ms LATENCY\nVAULT: 100% SYNCED\nNEURAL: OPTIMIZED';
        } else {
            response = `claw-sh: command not found: ${cmd}. Try 'help'.`;
        }

        setHistory(prev => [...prev, { cmd: input, output: response }]);
        setInput('');
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    return (
        <div className="p-10 h-full flex flex-col">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter drop-shadow-md uppercase">Claw Terminal</h1>
                    <p className="text-white/40 text-sm font-mono tracking-widest uppercase">Direct Crustacean Shell Access</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        Link established
                    </div>
                </div>
            </header>

            <div className="flex-1 bg-[#050505] rounded-[40px] border border-white/10 shadow-2xl flex flex-col overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                    <Shell className="w-64 h-64 text-rose-500" />
                </div>
                <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]"></div>

                <div className="flex-1 overflow-y-auto p-10 font-mono text-sm space-y-6 scrollbar-hide relative z-0">
                    {history.map((item, i) => (
                        <div key={i} className="animate-in fade-in slide-in-from-top-1 duration-300">
                            <div className="flex items-center gap-2 text-rose-500 font-bold">
                                <ChevronRight className="w-4 h-4" />
                                <span className="text-white/40 text-xs uppercase">claw@node:~$</span>
                                {item.cmd}
                            </div>
                            <div className="mt-3 text-cyan-400/80 whitespace-pre-wrap pl-6 border-l border-white/5 ml-2 leading-relaxed">
                                {item.output}
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                <div className="p-6 bg-white/5 border-t border-white/10 relative z-20">
                    <form onSubmit={handleCommand} className="flex items-center gap-3">
                        <span className="text-rose-500 font-bold"><ChevronRight className="w-5 h-5" /></span>
                        <input
                            type="text"
                            autoFocus
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type command..."
                            className="flex-1 bg-transparent border-none text-white font-mono focus:outline-none placeholder:text-white/10"
                        />
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-white/20" />
                            <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">claw-sh 6.0</span>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TerminalView;
