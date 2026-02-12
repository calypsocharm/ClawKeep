import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AppView, GatewayStatus, UserIdentity, ShellConfig, PersonaType, ChatMessage } from './types';
import { gatewayService } from './services/gatewayService';
import { activityService } from './services/activityService';
import { agentService } from './services/agentService';
import { geminiService } from './services/geminiService';
import { memoryService } from './services/memoryService';
import { heartbeatService } from './services/heartbeatService';
import { hudService } from './services/hudService';
import { apiService } from './services/apiService';
import { guardrailService } from './services/guardrailService';
import { openRouterService } from './services/openRouterService';
import { userScopeService } from './services/userScopeService';

// Lazy-loaded views
const TradingDashboard = lazy(() => import('./components/TradingDashboard'));
const SolanaTraderView = lazy(() => import('./components/SolanaTraderView'));
const ChartView = lazy(() => import('./components/ChartView'));
const OpenClawAgent = lazy(() => import('./components/OpenClawAgent'));
const AgentsView = lazy(() => import('./components/AgentsView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const SecretsView = lazy(() => import('./components/SecretsView'));
const LiveBrowserView = lazy(() => import('./components/LiveBrowserView'));
const TerminalView = lazy(() => import('./components/TerminalView'));
const VPSSetupView = lazy(() => import('./components/VPSSetupView'));
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const OnboardingOverlay = lazy(() => import('./components/OnboardingOverlay'));
const StrategySandbox = lazy(() => import('./components/StrategySandbox'));

// Sidebar with trading-focused nav
import Sidebar from './components/Sidebar';
import BrowserPopup from './components/BrowserPopup';
import TelemetryPopup from './components/TelemetryPopup';

// ─── Simple Trading App Views ─────────────────────────────
enum TraderView {
    DASHBOARD = 'dashboard',
    TRADING = 'solana_trader',
    CHART = 'chart',
    CLAW = 'claw',
    AGENTS = 'agents',
    SETTINGS = 'settings',
    SECRETS = 'secrets',
    BROWSER = 'live_browser',
    TERMINAL = 'terminal',
    VPS_SETUP = 'vps_setup',
    STRATEGY_SANDBOX = 'strategy_sandbox',
}

// ─── Auth State ───────────────────────────────────────────
interface AuthUser {
    email: string;
    role: string;
    company?: string;
}

const LoadingFallback = () => (
    <div className="flex items-center justify-center h-full text-white/20">
        <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
    </div>
);

// ─── Main App ─────────────────────────────────────────────
const App: React.FC = () => {
    // Auth state
    const [isUnlocked, setIsUnlocked] = useState(() => !!localStorage.getItem('claw_auth_token'));
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);

    // View state
    const [currentView, setCurrentView] = useState<TraderView>(TraderView.DASHBOARD);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = userScopeService.scopedGet('sidebar_collapsed');
        return saved === 'true';
    });

    // Gateway
    const [gwStatus, setGwStatus] = useState<GatewayStatus>('DISCOVERING');

    // Shell config  
    const [shellConfig, setShellConfig] = useState<ShellConfig | null>(() => {
        const saved = userScopeService.scopedGet('shell_config');
        if (saved) try { return JSON.parse(saved); } catch { }
        return {
            shellName: 'ClawKeep',
            accentColor: '160 70% 50%', // emerald/green for trading
            persona: 'trader' as PersonaType,
        };
    });

    // Telemetry & browser popup  
    const [telemetry, setTelemetry] = useState({ neural: 0, quantum: 0, efficiency: 0, uptime: 0, memoryUsed: 0, activeNodes: 0, lastSync: '', mode: 'idle' as any });
    const [showTelemetry, setShowTelemetry] = useState(false);
    const [showBrowserPopup, setShowBrowserPopup] = useState(false);
    const [browserUrl, setBrowserUrl] = useState('');

    // Claw panel state
    const [isBotPanelOpen, setIsBotPanelOpen] = useState(false);

    // ─── Session Validation ─────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('claw_auth_token');
        if (token) {
            const host = localStorage.getItem('claw_gateway_host');
            if (host) {
                fetch(`${host.replace('ws://', 'http://').replace('wss://', 'https://')}/api/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(r => r.json()).then(data => {
                    if (data.email) {
                        setAuthUser({ email: data.email, role: data.role || 'user', company: data.company });
                        userScopeService.setUserId(data.email);
                        setIsUnlocked(true);
                    } else {
                        handleLogout();
                    }
                }).catch(() => { setIsUnlocked(true); }); // offline, trust token
            }
        }
    }, []);

    // ─── Gateway ─────────────────────────────────────────────
    useEffect(() => {
        const unsub = gatewayService.subscribe(setGwStatus);
        return unsub;
    }, []);

    // Listen for browser open events
    useEffect(() => {
        const handler = () => {
            const url = userScopeService.scopedGet('browser_url');
            if (url) {
                userScopeService.scopedRemove('browser_url');
                setCurrentView(TraderView.BROWSER);
            }
        };
        window.addEventListener('claw-open-browser', handler);
        return () => window.removeEventListener('claw-open-browser', handler);
    }, []);

    // ─── Apply shell accent ──────────────────────────────────
    useEffect(() => {
        if (shellConfig?.accentColor) {
            document.documentElement.style.setProperty('--shell-accent', shellConfig.accentColor);
        }
    }, [shellConfig]);

    // ─── Auth Handlers ───────────────────────────────────────
    const handleLogin = useCallback((token: string, email: string, role?: string) => {
        localStorage.setItem('claw_auth_token', token);
        userScopeService.setUserId(email);
        setAuthUser({ email, role: role || 'user' });
        setIsUnlocked(true);
        setShowOnboarding(false);

        // Auto-connect gateway
        const host = localStorage.getItem('claw_gateway_host');
        if (host) {
            gatewayService.connect(host, email, localStorage.getItem('claw_user_password') || '');
        }
    }, []);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('claw_auth_token');
        userScopeService.setUserId(null);
        setAuthUser(null);
        setIsUnlocked(false);
        setCurrentView(TraderView.DASHBOARD);
        gatewayService.disconnect();
    }, []);

    // ─── Sidebar Nav Config ──────────────────────────────────
    const navItems = [
        { view: AppView.DASHBOARD, label: 'Dashboard', order: 1 },
        { view: 'solana_trader' as AppView, label: 'Trading', order: 2 },
        { view: 'chart' as AppView, label: 'Chart', order: 3 },
        { view: AppView.AGENTS, label: 'Agents', order: 4 },
        { view: 'strategy_sandbox' as AppView, label: 'Strategies', order: 5 },
        { view: 'live_browser' as AppView, label: 'Browser', order: 6 },
        { view: AppView.TERMINAL, label: 'Terminal', order: 7 },
        {
            view: AppView.SETTINGS, label: 'Settings', order: 8, children: [
                { view: AppView.SECRETS, label: 'Vault', order: 1 },
                { view: 'vps_setup' as AppView, label: 'VPS Setup', order: 2 },
            ]
        },
    ];

    // ─── View Renderer ───────────────────────────────────────
    const renderView = () => {
        switch (currentView) {
            case TraderView.DASHBOARD:
                return <TradingDashboard onNavigate={(v: string) => setCurrentView(v as TraderView)} />;
            case TraderView.TRADING:
                return <SolanaTraderView />;
            case TraderView.CHART:
                return <ChartView />;
            case TraderView.AGENTS:
                return <AgentsView agentService={agentService} activityService={activityService} />;
            case TraderView.STRATEGY_SANDBOX:
                return <StrategySandbox />;
            case TraderView.BROWSER:
                return <LiveBrowserView telemetry={telemetry} />;
            case TraderView.TERMINAL:
                return <TerminalView />;
            case TraderView.SETTINGS:
                return <SettingsView
                    shellConfig={shellConfig}
                    onShellConfigChange={(c: ShellConfig) => { setShellConfig(c); userScopeService.scopedSet('shell_config', JSON.stringify(c)); }}
                    authUser={authUser}
                    onLogout={handleLogout}
                />;
            case TraderView.SECRETS:
                return <SecretsView />;
            case TraderView.VPS_SETUP:
                return <VPSSetupView />;
            default:
                return <TradingDashboard onNavigate={(v: string) => setCurrentView(v as TraderView)} />;
        }
    };

    // ─── Not Logged In ───────────────────────────────────────
    if (!isUnlocked) {
        return (
            <div className="min-h-screen bg-[#060a10] flex items-center justify-center">
                <Suspense fallback={<LoadingFallback />}>
                    {showOnboarding ? (
                        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
                    ) : (
                        <LoginScreen
                            onLogin={handleLogin}
                            onShowOnboarding={() => setShowOnboarding(true)}
                        />
                    )}
                </Suspense>
            </div>
        );
    }

    // ─── Main Layout ─────────────────────────────────────────
    return (
        <div className="flex h-screen bg-[#060a10] text-white overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                currentView={currentView as unknown as AppView}
                onChangeView={(v) => setCurrentView(v as unknown as TraderView)}
                navLayout={navItems as any}
                shellConfig={shellConfig}
                onLogout={handleLogout}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => {
                    const next = !sidebarCollapsed;
                    setSidebarCollapsed(next);
                    userScopeService.scopedSet('sidebar_collapsed', String(next));
                }}
            />

            {/* Main Content */}
            <main className="flex-1 min-w-0 relative overflow-hidden">
                <Suspense fallback={<LoadingFallback />}>
                    {renderView()}
                </Suspense>
            </main>

            {/* Claw Agent Panel */}
            {isBotPanelOpen && (
                <Suspense fallback={<LoadingFallback />}>
                    <OpenClawAgent
                        contextData={JSON.stringify({ activeView: currentView })}
                        telemetry={telemetry}
                        onClose={() => setIsBotPanelOpen(false)}
                    />
                </Suspense>
            )}

            {/* Claw FAB */}
            {!isBotPanelOpen && (
                <button
                    onClick={() => setIsBotPanelOpen(true)}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center text-white text-xl transition-all hover:scale-110 active:scale-95 group"
                    style={{ background: `linear-gradient(135deg, hsl(${shellConfig?.accentColor || '160 70% 50%'}), hsl(${shellConfig?.accentColor || '160 70% 50%'} / 0.7))` }}
                    title="Open Claw"
                >
                    🦀
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ boxShadow: `0 0 20px hsl(${shellConfig?.accentColor || '160 70% 50%'} / 0.4)` }}></div>
                </button>
            )}

            {/* Telemetry Popup */}
            {showTelemetry && (
                <TelemetryPopup telemetry={telemetry} onClose={() => setShowTelemetry(false)} />
            )}

            {/* Browser Popup */}
            {showBrowserPopup && (
                <BrowserPopup url={browserUrl} onClose={() => setShowBrowserPopup(false)} />
            )}
        </div>
    );
};

export default App;
