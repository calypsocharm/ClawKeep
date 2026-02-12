// ===== Claw UI Control System — Widget Library =====
// All reusable widget components that ViewRenderer can compose

import React from 'react';
import { WidgetConfig } from '../../viewConfigTypes';
import {
    TrendingUp, TrendingDown, Minus, BarChart3,
    Clock, ChevronRight, ExternalLink, Sparkles
} from 'lucide-react';

// --- Shared Widget Shell ---
interface WidgetShellProps {
    config: WidgetConfig;
    children: React.ReactNode;
}

const WidgetShell: React.FC<WidgetShellProps> = ({ config, children }) => (
    <div
        className="glass-panel rounded-2xl border border-white/[0.06] overflow-hidden animate-fade-up"
        style={{
            gridColumn: config.span ? `span ${config.span}` : undefined,
            animationDelay: `${(config.order || 0) * 60}ms`
        }}
    >
        {config.title && (
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-white/40">{config.title}</h3>
                {config.color && <div className="w-2 h-2 rounded-full" style={{ background: `hsl(${config.color})` }} />}
            </div>
        )}
        <div className="px-5 pb-5">
            {children}
        </div>
    </div>
);

// ===== 1. StatRow =====
// Data: Array of { label, value, icon?, color?, trend? }
export const StatRowWidget: React.FC<{ config: WidgetConfig; data?: any[] }> = ({ config, data }) => {
    const items = data || config.staticContent || [];
    if (!items.length) return <WidgetShell config={config}><p className="text-white/20 text-xs italic">No stats available</p></WidgetShell>;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ gridColumn: config.span ? `span ${config.span}` : undefined }}>
            {items.map((item: any, i: number) => (
                <div key={i} className="glass-panel p-4 rounded-2xl flex flex-col gap-2 hover:bg-white/[0.04] transition-all animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex items-center justify-between">
                        <span className="text-lg">{item.icon || '📊'}</span>
                        {item.trend && (
                            <span className={`text-[9px] font-bold flex items-center gap-0.5 ${item.trend > 0 ? 'text-emerald-400' : item.trend < 0 ? 'text-rose-400' : 'text-white/30'}`}>
                                {item.trend > 0 ? <TrendingUp className="w-3 h-3" /> : item.trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {Math.abs(item.trend)}%
                            </span>
                        )}
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">{item.value}</div>
                    <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wide">{item.label}</div>
                </div>
            ))}
        </div>
    );
};

// ===== 2. DataTable =====
// Data: Array of row objects, columns from config.columns
export const DataTableWidget: React.FC<{ config: WidgetConfig; data?: any[] }> = ({ config, data }) => {
    const rows = data || config.staticContent || [];
    const columns = config.columns || (rows.length > 0 ? Object.keys(rows[0]) : []);

    return (
        <WidgetShell config={config}>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/10">
                            {columns.map(col => (
                                <th key={col} className="text-left py-2 px-3 text-[9px] font-black text-white/30 uppercase tracking-widest">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={columns.length} className="py-4 text-center text-white/20 italic">No data</td></tr>
                        )}
                        {rows.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                {columns.map(col => (
                                    <td key={col} className="py-2.5 px-3 text-white/70 font-medium">{String(row[col] ?? '—')}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </WidgetShell>
    );
};

// ===== 3. Timeline =====
// Data: Array of { time, title, description?, icon? }
export const TimelineWidget: React.FC<{ config: WidgetConfig; data?: any[] }> = ({ config, data }) => {
    const items = data || config.staticContent || [];

    return (
        <WidgetShell config={config}>
            <div className="space-y-3">
                {items.length === 0 && <p className="text-white/20 text-xs italic">No events</p>}
                {items.map((item: any, i: number) => (
                    <div key={i} className="flex gap-3 group">
                        <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-white/20 group-hover:bg-rose-500 transition-colors shrink-0 mt-1.5" />
                            {i < items.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1" />}
                        </div>
                        <div className="pb-4 min-w-0">
                            <div className="flex items-center gap-2">
                                {item.icon && <span className="text-sm">{item.icon}</span>}
                                <span className="text-[11px] font-bold text-white">{item.title}</span>
                            </div>
                            {item.description && <p className="text-[10px] text-white/40 mt-0.5">{item.description}</p>}
                            <div className="flex items-center gap-1 mt-1 text-[8px] text-white/20 font-mono">
                                <Clock className="w-2.5 h-2.5" />
                                {item.time}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </WidgetShell>
    );
};

// ===== 4. MarkdownBlock =====
// Data: markdown string in staticContent
export const MarkdownWidget: React.FC<{ config: WidgetConfig }> = ({ config }) => {
    const content = config.staticContent || '';

    return (
        <WidgetShell config={config}>
            <div className="prose prose-invert prose-sm max-w-none text-[12px] leading-relaxed text-white/70 whitespace-pre-wrap">
                {content}
            </div>
        </WidgetShell>
    );
};

// ===== 5. CardGrid =====
// Data: Array of { title, description?, icon?, color?, action? }
export const CardGridWidget: React.FC<{ config: WidgetConfig; data?: any[] }> = ({ config, data }) => {
    const items = data || config.staticContent || [];

    return (
        <WidgetShell config={config}>
            <div className="grid grid-cols-2 gap-3">
                {items.length === 0 && <p className="text-white/20 text-xs italic col-span-2">No cards</p>}
                {items.map((item: any, i: number) => (
                    <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] transition-all cursor-default group">
                        <div className="flex items-start justify-between mb-2">
                            <span className="text-xl">{item.icon || '📦'}</span>
                            <ChevronRight className="w-3 h-3 text-white/10 group-hover:text-white/30 transition-colors" />
                        </div>
                        <div className="text-[11px] font-bold text-white truncate">{item.title}</div>
                        {item.description && <div className="text-[9px] text-white/30 mt-1 line-clamp-2">{item.description}</div>}
                    </div>
                ))}
            </div>
        </WidgetShell>
    );
};

// ===== 6. ChartPanel =====
// Data: { labels: string[], datasets: { label, data: number[], color? }[] }
// Renders a simple CSS-based bar chart (no charting library needed)
export const ChartWidget: React.FC<{ config: WidgetConfig; data?: any }> = ({ config, data }) => {
    const chartData = data || config.staticContent;
    if (!chartData?.labels || !chartData?.datasets?.length) {
        return <WidgetShell config={config}><p className="text-white/20 text-xs italic">No chart data</p></WidgetShell>;
    }

    const dataset = chartData.datasets[0];
    const maxVal = Math.max(...dataset.data, 1);
    const chartColor = config.color || '217 91% 60%';

    return (
        <WidgetShell config={config}>
            <div className="flex items-end gap-2 h-32">
                {chartData.labels.map((label: string, i: number) => {
                    const val = dataset.data[i] || 0;
                    const pct = (val / maxVal) * 100;
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[8px] text-white/40 font-mono">{val}</span>
                            <div className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                                style={{
                                    height: `${Math.max(pct, 4)}%`,
                                    background: `hsl(${chartColor})`,
                                    opacity: 0.7 + (pct / 100) * 0.3
                                }}
                            />
                            <span className="text-[7px] text-white/25 font-bold uppercase tracking-wide truncate w-full text-center">{label}</span>
                        </div>
                    );
                })}
            </div>
            {dataset.label && <div className="text-center mt-2 text-[8px] text-white/20 font-mono uppercase tracking-widest">{dataset.label}</div>}
        </WidgetShell>
    );
};

// ===== 7. KeyValue =====
// Data: Object of { key: value }
export const KeyValueWidget: React.FC<{ config: WidgetConfig; data?: any }> = ({ config, data }) => {
    const entries = data || config.staticContent || {};
    const pairs = Object.entries(entries);

    return (
        <WidgetShell config={config}>
            <div className="space-y-2">
                {pairs.length === 0 && <p className="text-white/20 text-xs italic">No data</p>}
                {pairs.map(([key, value], i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wide">{key}</span>
                        <span className="text-[11px] text-white font-bold">{String(value)}</span>
                    </div>
                ))}
            </div>
        </WidgetShell>
    );
};

// ===== 8. Embed (HTML/JS Sandbox + URL) =====
// staticContent: raw HTML/CSS/JS string OR a URL
export const EmbedWidget: React.FC<{ config: WidgetConfig }> = ({ config }) => {
    const content = config.staticContent || '';
    if (!content) return <WidgetShell config={config}><p className="text-white/20 text-xs italic">No content configured</p></WidgetShell>;

    // Detect if content is HTML (not a URL)
    const isHTML = content.trim().startsWith('<') || /\b(html|body|div|button|script|style)\b/i.test(content);

    // Dark-theme base styles injected into the sandbox
    const sandboxStyles = `
        <style>
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #0a0a0f; color: #e2e8f0; padding: 16px;
                min-height: 100%; display: flex; flex-direction: column;
            }
            button, .btn {
                cursor: pointer; border: none; border-radius: 12px; padding: 12px 24px;
                font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
                background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
                transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
            }
            button:hover, .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }
            button:active, .btn:active { transform: translateY(0); }
            .btn-success { background: linear-gradient(135deg, #059669, #10b981); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
            .btn-danger { background: linear-gradient(135deg, #dc2626, #f43f5e); box-shadow: 0 4px 15px rgba(244, 63, 94, 0.3); }
            .btn-warning { background: linear-gradient(135deg, #d97706, #f59e0b); box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3); }
            .card {
                background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px; padding: 20px; backdrop-filter: blur(10px);
            }
            .card:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
            input, select, textarea {
                background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
                padding: 10px 14px; color: #e2e8f0; font-size: 13px; outline: none; width: 100%;
                transition: border-color 0.2s;
            }
            input:focus, select:focus, textarea:focus { border-color: rgba(99, 102, 241, 0.5); }
            h1, h2, h3 { font-weight: 800; letter-spacing: -0.02em; }
            h1 { font-size: 22px; } h2 { font-size: 18px; } h3 { font-size: 14px; }
            .text-muted { color: rgba(255,255,255,0.4); } .text-accent { color: #818cf8; }
            .flex { display: flex; } .flex-col { flex-direction: column; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
            .items-center { align-items: center; } .justify-center { justify-content: center; } .justify-between { justify-content: space-between; }
            .grid { display: grid; } .grid-2 { grid-template-columns: 1fr 1fr; } .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
            .w-full { width: 100%; } .text-center { text-align: center; }
            .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; } .mt-4 { margin-top: 16px; }
            .mb-2 { margin-bottom: 8px; } .mb-3 { margin-bottom: 12px; }
            .p-2 { padding: 8px; } .p-3 { padding: 12px; } .p-4 { padding: 16px; }
            .rounded { border-radius: 8px; } .rounded-lg { border-radius: 12px; } .rounded-xl { border-radius: 16px; }
            .text-xs { font-size: 11px; } .text-sm { font-size: 13px; } .text-lg { font-size: 18px; } .text-xl { font-size: 22px; }
            .font-bold { font-weight: 700; } .font-mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
            .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            .glow { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
            .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
            .badge-green { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
            .badge-red { background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }
            .badge-blue { background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); }
            .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
            .status-dot.green { background: #34d399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.5); }
            .status-dot.red { background: #fb7185; box-shadow: 0 0 8px rgba(251, 113, 133, 0.5); }
            .status-dot.yellow { background: #fbbf24; box-shadow: 0 0 8px rgba(251, 191, 36, 0.5); }
        </style>
    `;
    const web3Script = `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js"></script>
        <script src="https://unpkg.com/@solana/web3.js@1.95.8/lib/index.iife.min.js"></script>
        <script>
            // === Ethereum (ethers.js) ===
            async function connectWallet() {
                if (!window.ethereum) return { error: 'No EVM wallet detected' };
                try {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();
                    const address = await signer.getAddress();
                    const balance = await provider.getBalance(address);
                    return { address, balance: ethers.formatEther(balance), provider, signer };
                } catch (e) { return { error: e.message }; }
            }

            // === Solana (Phantom) ===
            async function connectPhantom() {
                const phantom = window.solana || window.phantom?.solana;
                if (!phantom?.isPhantom) return { error: 'Phantom wallet not detected' };
                try {
                    const resp = await phantom.connect();
                    const pubkey = resp.publicKey.toString();
                    const conn = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');
                    const lamports = await conn.getBalance(new solanaWeb3.PublicKey(pubkey));
                    const balance = (lamports / solanaWeb3.LAMPORTS_PER_SOL).toFixed(4);
                    return { address: pubkey, balance, connection: conn };
                } catch (e) { return { error: e.message }; }
            }

            function shortAddr(a) { return a ? a.slice(0,6)+'...'+a.slice(-4) : ''; }
        </script>
    `;
    const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${sandboxStyles}${web3Script}</head><body>${content}</body></html>`;

    // Determine height from config or default
    const height = config.height || 280;

    if (isHTML) {
        return (
            <WidgetShell config={config}>
                <div className="relative rounded-xl overflow-hidden border border-purple-500/20 bg-black shadow-lg shadow-purple-500/5">
                    <iframe
                        srcDoc={fullHTML}
                        className="w-full border-0"
                        style={{ height: `${height}px`, minHeight: '120px' }}
                        sandbox="allow-scripts allow-popups allow-modals allow-forms allow-top-navigation-by-user-activation allow-same-origin"
                        title={config.title || 'Claw Sandbox'}
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-purple-500/20 backdrop-blur-sm rounded-lg">
                        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                        <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest">Sandbox</span>
                    </div>
                </div>
            </WidgetShell>
        );
    }

    // URL mode — existing behavior
    return (
        <WidgetShell config={config}>
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
                <iframe
                    src={content}
                    className="w-full h-64 border-0"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    title={config.title || 'Embedded content'}
                />
                <a href={content} target="_blank" rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-white/40 hover:text-white transition-colors">
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        </WidgetShell>
    );
};

// ===== 9. List =====
// Data: Array of strings or { text, icon?, done? }
export const ListWidget: React.FC<{ config: WidgetConfig; data?: any[] }> = ({ config, data }) => {
    const items = data || config.staticContent || [];

    return (
        <WidgetShell config={config}>
            <div className="space-y-1.5">
                {items.length === 0 && <p className="text-white/20 text-xs italic">Empty list</p>}
                {items.map((item: any, i: number) => {
                    const text = typeof item === 'string' ? item : item.text;
                    const icon = typeof item === 'object' ? item.icon : null;
                    const done = typeof item === 'object' ? item.done : false;
                    return (
                        <div key={i} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors ${done ? 'opacity-40' : ''}`}>
                            <span className="text-sm">{icon || (done ? '✅' : '•')}</span>
                            <span className={`text-[11px] font-medium ${done ? 'line-through text-white/30' : 'text-white/70'}`}>{text}</span>
                        </div>
                    );
                })}
            </div>
        </WidgetShell>
    );
};

// ===== Widget Registry =====
export const WIDGET_REGISTRY: Record<string, React.FC<{ config: WidgetConfig; data?: any }>> = {
    'stat-row': StatRowWidget as any,
    'data-table': DataTableWidget as any,
    'timeline': TimelineWidget as any,
    'markdown': MarkdownWidget as any,
    'card-grid': CardGridWidget as any,
    'chart': ChartWidget as any,
    'key-value': KeyValueWidget as any,
    'embed': EmbedWidget as any,
    'list': ListWidget as any,
};
