import React, { useState } from 'react';
import { Rocket, User, Mail, Lock as LockIcon, ChevronRight, ChevronLeft, Check, Building, ShieldCheck, Palette, Sparkles } from 'lucide-react';
import { gatewayService } from '../services/gatewayService';
import { api } from '../services/apiService';
import { UserIdentity, ShellConfig, PersonaType, AppView } from '../types';
import { PERSONA_PRESETS, COLOR_SWATCHES, SURFACE_SWATCHES, ALL_AVAILABLE_VIEWS } from '../personas';

interface OnboardingOverlayProps {
    onComplete: (config: ShellConfig) => void;
}

// Helper: HSL string to hex for <input type="color">
function hslToHex(hsl: string): string {
    const parts = hsl.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return '#f43f5e';
    const h = parseFloat(parts[0]) / 360;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper: hex to HSL string
function hexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '346 77% 50%';
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete }) => {
    // Step management
    const [step, setStep] = useState(1);

    // Step 1: Identity
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');

    // Step 2: Persona
    const [selectedPersona, setSelectedPersona] = useState<PersonaType>('business');

    // Step 3: Customization
    const [shellName, setShellName] = useState('My Shell');
    const [accentColor, setAccentColor] = useState('346 77% 50%');
    const [surfaceColor, setSurfaceColor] = useState('222 47% 11%');
    const [glowColor, setGlowColor] = useState('346 77% 50%');
    const [styles, setStyles] = useState({
        glassmorphism: true,
        animations: true,
        glowEffects: true,
        roundedCorners: true
    });

    const [isDeploying, setIsDeploying] = useState(false);

    const persona = PERSONA_PRESETS.find(p => p.id === selectedPersona)!;

    // When persona changes, update colors to preset defaults
    const handlePersonaSelect = (id: PersonaType) => {
        setSelectedPersona(id);
        const preset = PERSONA_PRESETS.find(p => p.id === id)!;
        setAccentColor(preset.accentColor);
        setSurfaceColor(preset.surfaceColor);
        setGlowColor(preset.glowColor);
    };

    const toggleStyle = (key: keyof typeof styles) => {
        setStyles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleFinish = async () => {
        if (!email || !password || !name) return;
        setIsDeploying(true);

        localStorage.setItem('claw_user_email', email);
        localStorage.setItem('claw_user_password', password);
        gatewayService.connect(email, password);

        const identity: UserIdentity = {
            name,
            role: 'Operator',
            company: company || '',
            soul: 'assistant',
            accessKey: password,
            soulMemories: {
                claw: { learnings: [], evolutionLevel: 1, interactionCount: 0 },
                assistant: { learnings: [], evolutionLevel: 1, interactionCount: 0 },
                trader: { learnings: [], evolutionLevel: 1, interactionCount: 0 },
                business: { learnings: [], evolutionLevel: 1, interactionCount: 0 }
            }
        };

        gatewayService.saveIdentity(identity);
        // Sync identity to VPS for cross-session persistence
        api.config.set('identity', identity).catch(() => { });
        localStorage.setItem('claw_user_email', email);
        await gatewayService.runSetup(true);

        const config: ShellConfig = {
            shellName,
            persona: selectedPersona,
            accentColor,
            surfaceColor,
            glowColor,
            styles,
            visibleViews: persona.visibleViews
        };

        setTimeout(() => {
            setIsDeploying(false);
            onComplete(config);
        }, 1200);
    };

    const isFormValid = email.includes('@') && password.length >= 4 && name.length >= 2;

    // --- Color Picker Component ---
    const ColorPicker = ({ label, value, onChange, swatches }: { label: string; value: string; onChange: (v: string) => void; swatches: { name: string; hsl: string }[] }) => (
        <div>
            <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">{label}</label>
            <div className="flex items-center gap-2 flex-wrap">
                {swatches.map(s => (
                    <button
                        key={s.hsl}
                        onClick={() => onChange(s.hsl)}
                        className={`w-8 h-8 rounded-xl transition-all duration-200 border-2 hover:scale-110 ${value === s.hsl ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                        style={{ backgroundColor: `hsl(${s.hsl})` }}
                        title={s.name}
                    />
                ))}
                <label className="w-8 h-8 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors overflow-hidden relative" title="Custom color">
                    <Palette className="w-3.5 h-3.5 text-white/40" />
                    <input
                        type="color"
                        value={hslToHex(value)}
                        onChange={(e) => onChange(hexToHsl(e.target.value))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
                <div className="w-4 h-4 rounded-md" style={{ backgroundColor: `hsl(${value})` }} />
                <span className="text-[9px] font-mono text-white/20">{value}</span>
            </div>
        </div>
    );

    // --- Style Toggle Component ---
    const StyleToggle = ({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) => (
        <button onClick={onChange} className={`flex items-center gap-4 p-3 rounded-2xl transition-all w-full text-left ${checked ? 'bg-white/[0.06] border border-white/10' : 'bg-transparent border border-white/5 opacity-50'}`}>
            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${checked ? 'border-current bg-current/20' : 'border-white/20'}`} style={checked ? { borderColor: `hsl(${accentColor})`, backgroundColor: `hsl(${accentColor} / 0.2)` } : {}}>
                {checked && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="min-w-0">
                <div className="text-xs font-bold text-white">{label}</div>
                <div className="text-[9px] text-white/30">{description}</div>
            </div>
        </button>
    );

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950">
            <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] animate-gradient-subtle"></div>

            <div className="w-full max-w-2xl glass-panel p-10 rounded-[48px] border-white/10 relative overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto scrollbar-hide">
                <div className="relative z-10 flex flex-col items-center">

                    {/* Progress indicator */}
                    <div className="flex items-center gap-2 mb-6">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${s === step ? 'w-10' : 'w-4'}`} style={{ backgroundColor: s <= step ? `hsl(${accentColor})` : 'rgba(255,255,255,0.1)' }} />
                        ))}
                    </div>

                    {/* ===== STEP 1: IDENTITY ===== */}
                    {step === 1 && (
                        <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl mb-4 mx-auto" style={{ background: `linear-gradient(135deg, hsl(${accentColor}), hsl(${accentColor} / 0.7))` }}>
                                <Rocket className="w-7 h-7 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight uppercase text-center">Initialize Your Shell</h1>
                            <p className="text-white/30 text-[10px] font-mono uppercase tracking-[0.3em] mb-8 text-center">Step 1 — Identity</p>

                            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-rose-500 transition-colors" />
                                        <input type="text" placeholder="Your Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-rose-500 transition-all text-sm" />
                                    </div>
                                    <div className="relative group">
                                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-rose-500 transition-colors" />
                                        <input type="text" placeholder="Company / Project Name" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-rose-500 transition-all text-sm" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-rose-500 transition-colors" />
                                        <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-rose-500 transition-all text-sm" />
                                    </div>
                                    <div className="relative group">
                                        <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-rose-500 transition-colors" />
                                        <input type="password" placeholder="Access Key (Password)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-rose-500 transition-all text-sm" />
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setStep(2)} disabled={!isFormValid} className="w-full py-4 rounded-[28px] text-white font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30" style={{ background: `linear-gradient(135deg, hsl(${accentColor}), hsl(${accentColor} / 0.7))` }}>
                                Next: Pick Your Persona <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* ===== STEP 2: PERSONA PICKER ===== */}
                    {step === 2 && (
                        <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight uppercase text-center">Choose Your Persona</h1>
                            <p className="text-white/30 text-[10px] font-mono uppercase tracking-[0.3em] mb-6 text-center">Step 2 — This shapes your sidebar and AI personality</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                                {PERSONA_PRESETS.map(p => (
                                    <button key={p.id} onClick={() => handlePersonaSelect(p.id)}
                                        className={`p-5 rounded-[24px] border-2 flex flex-col items-center gap-2 transition-all duration-300 text-center group hover:scale-[1.02] ${selectedPersona === p.id ? 'bg-white/[0.08] shadow-xl' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}
                                        style={selectedPersona === p.id ? { borderColor: `hsl(${p.accentColor})`, boxShadow: `0 0 30px hsl(${p.accentColor} / 0.15)` } : {}}
                                    >
                                        <span className="text-3xl mb-1">{p.icon}</span>
                                        <span className="text-xs font-black uppercase tracking-wide text-white">{p.label}</span>
                                        <span className="text-[9px] text-white/40 leading-relaxed">{p.description}</span>
                                        {selectedPersona === p.id && (
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center mt-1" style={{ backgroundColor: `hsl(${p.accentColor})` }}>
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="px-6 py-4 rounded-[28px] text-white/40 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2">
                                    <ChevronLeft className="w-4 h-4" /> Back
                                </button>
                                <button onClick={() => setStep(3)} className="flex-1 py-4 rounded-[28px] text-white font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95" style={{ background: `linear-gradient(135deg, hsl(${accentColor}), hsl(${accentColor} / 0.7))` }}>
                                    Next: Customize <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 3: CUSTOMIZE ===== */}
                    {step === 3 && (
                        <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight uppercase text-center">Make It Yours</h1>
                            <p className="text-white/30 text-[10px] font-mono uppercase tracking-[0.3em] mb-6 text-center">Step 3 — Name, colors, and style</p>

                            {/* Shell Name */}
                            <div className="mb-6">
                                <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Name Your Shell</label>
                                <input type="text" value={shellName} onChange={(e) => setShellName(e.target.value)} placeholder="e.g. Mission Control, The Forge, HQ"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-5 text-white text-lg font-bold focus:outline-none transition-all"
                                    style={{ borderColor: shellName ? `hsl(${accentColor} / 0.3)` : undefined }}
                                />
                            </div>

                            {/* Live Preview */}
                            <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-black/30">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm" style={{ background: `linear-gradient(135deg, hsl(${accentColor}), hsl(${accentColor} / 0.7))` }}>
                                        {persona.icon}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">{shellName || 'My Shell'}</div>
                                        <div className="text-[9px] text-white/30 font-mono">{persona.label} Mode</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <div className="px-3 py-1 rounded-lg text-[9px] font-bold text-white" style={{ backgroundColor: `hsl(${accentColor})` }}>Accent</div>
                                    <div className="px-3 py-1 rounded-lg text-[9px] font-bold text-white" style={{ backgroundColor: `hsl(${surfaceColor})`, border: '1px solid rgba(255,255,255,0.1)' }}>Surface</div>
                                    <div className="px-3 py-1 rounded-lg text-[9px] font-bold text-white" style={{ backgroundColor: `hsl(${glowColor} / 0.5)` }}>Glow</div>
                                </div>
                            </div>

                            {/* Color Pickers */}
                            <div className="space-y-5 mb-6">
                                <ColorPicker label="Accent Color" value={accentColor} onChange={setAccentColor} swatches={COLOR_SWATCHES} />
                                <ColorPicker label="Surface Color" value={surfaceColor} onChange={setSurfaceColor} swatches={SURFACE_SWATCHES} />
                                <ColorPicker label="Glow Color" value={glowColor} onChange={setGlowColor} swatches={COLOR_SWATCHES} />
                            </div>

                            {/* Style Toggles */}
                            <div className="mb-8">
                                <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Style Toggles</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <StyleToggle label="Glassmorphism" description="Frosted glass panels" checked={styles.glassmorphism} onChange={() => toggleStyle('glassmorphism')} />
                                    <StyleToggle label="Animations" description="Transitions & micro-motion" checked={styles.animations} onChange={() => toggleStyle('animations')} />
                                    <StyleToggle label="Glow Effects" description="Neon accent shadows" checked={styles.glowEffects} onChange={() => toggleStyle('glowEffects')} />
                                    <StyleToggle label="Rounded Corners" description="Mega-round panels" checked={styles.roundedCorners} onChange={() => toggleStyle('roundedCorners')} />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setStep(2)} className="px-6 py-4 rounded-[28px] text-white/40 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2">
                                    <ChevronLeft className="w-4 h-4" /> Back
                                </button>
                                <button onClick={handleFinish} disabled={isDeploying || !shellName.trim()} className="flex-1 py-4 rounded-[28px] text-white font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30" style={{ background: `linear-gradient(135deg, hsl(${accentColor}), hsl(${accentColor} / 0.7))` }}>
                                    {isDeploying ? <span className="animate-pulse">Building Your Shell...</span> : <><Sparkles className="w-4 h-4" /> Launch {shellName || 'Shell'}</>}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex items-center gap-2 opacity-20">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span className="text-[8px] font-mono uppercase tracking-widest">ClawKeep v1.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingOverlay;