
import React, { useState } from 'react';
import { Lock, Key, ArrowRight, AlertCircle, UserPlus, Mail, User, LogIn, Shield } from 'lucide-react';
import { api } from '../services/apiService';

interface LoginScreenProps {
    onLogin: (token: string, email: string, role?: string) => void;
    onShowOnboarding: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onShowOnboarding }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'login') {
                const result = await api.login(email, password);
                // Save email/password for convenience
                localStorage.setItem('claw_user_email', email);
                localStorage.setItem('claw_user_password', password);
                onLogin(result.token, email, result.user?.role);
            } else {
                if (password.length < 6) {
                    setError('Password must be at least 6 characters');
                    setLoading(false);
                    return;
                }
                const result = await api.register(email, password, name);
                localStorage.setItem('claw_user_email', email);
                localStorage.setItem('claw_user_password', password);
                onLogin(result.token, email, result.user?.role);
            }
        } catch (err: any) {
            const msg = err?.message || 'Connection failed';
            if (msg.includes('409')) {
                setError('Email already registered — try logging in');
            } else if (msg.includes('401')) {
                setError('Invalid email or password');
            } else if (msg.includes('400')) {
                setError('Please check your information');
            } else {
                setError(msg);
            }
            setLoading(false);
        }
    };

    const isLogin = mode === 'login';

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950">
            <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#581c87] animate-gradient-xy"></div>

            <div className="relative z-10 w-full max-w-md p-6">
                <div className="glass-panel p-12 rounded-[48px] shadow-2xl border-white/10 backdrop-blur-3xl text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-rose-700 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(244,63,94,0.3)] mx-auto mb-10 relative">
                        {isLogin ? (
                            <Lock className={`w-8 h-8 text-white transition-all duration-300 ${loading ? 'scale-75 opacity-50' : 'scale-100'}`} />
                        ) : (
                            <Shield className={`w-8 h-8 text-white transition-all duration-300 ${loading ? 'scale-75 opacity-50' : 'scale-100'}`} />
                        )}
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">SHELL.<span className="text-rose-400">CLAWKEEP</span></h1>
                    <p className="text-white/30 text-[10px] mb-10 uppercase tracking-widest font-mono">
                        {isLogin ? 'Authenticate to Continue 🦀' : 'Create Your Account 🦀'}
                    </p>

                    {/* Mode Toggle */}
                    <div className="flex rounded-2xl bg-black/40 border border-white/10 mb-8 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => { setMode('login'); setError(null); }}
                            className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-1.5 ${isLogin ? 'bg-rose-600 text-white' : 'text-white/30 hover:text-white/60'}`}
                        >
                            <LogIn className="w-3 h-3" /> Log In
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('register'); setError(null); }}
                            className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-1.5 ${!isLogin ? 'bg-rose-600 text-white' : 'text-white/30 hover:text-white/60'}`}
                        >
                            <UserPlus className="w-3 h-3" /> Create Account
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
                        {!isLogin && (
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-rose-500 transition-colors" />
                                <input
                                    type="text"
                                    name="name"
                                    autoComplete="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your Name"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/10 focus:outline-none focus:border-rose-500/50 transition-all text-center font-mono text-sm"
                                />
                            </div>
                        )}

                        <div className="relative group">
                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${error ? 'text-rose-400' : 'text-white/20 group-focus-within:text-rose-500'}`} />
                            <input
                                type="email"
                                name="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                placeholder="Email"
                                className={`w-full bg-black/40 border rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/10 focus:outline-none transition-all text-center font-mono text-sm
                                ${error ? 'border-rose-500/50 bg-rose-500/5' : 'border-white/10 focus:border-rose-500/50'}`}
                            />
                        </div>

                        <div className="relative group">
                            <Key className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${error ? 'text-rose-400' : 'text-white/20 group-focus-within:text-rose-500'}`} />
                            <input
                                type="password"
                                name="password"
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                autoFocus
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                placeholder={isLogin ? 'Password' : 'Create Password (6+ chars)'}
                                className={`w-full bg-black/40 border rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/10 focus:outline-none transition-all text-center font-mono text-sm
                                ${error ? 'border-rose-500/50 bg-rose-500/5' : 'border-white/10 focus:border-rose-500/50'}`}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center justify-center gap-2 text-rose-400 text-[10px] font-black uppercase tracking-widest animate-in fade-in">
                                <AlertCircle className="w-3 h-3" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !password || !email}
                            className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 group disabled:opacity-50 shadow-xl"
                        >
                            {loading ? 'Synchronizing...' : isLogin ? 'Log In' : 'Initialize Account'}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <div className="mt-10 pt-10 border-t border-white/5">
                        <p className="text-[8px] text-white/10 font-mono tracking-widest uppercase">ClawKeep v2.0 — Auth Hardened 🛡️</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
