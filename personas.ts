import { AppView, PersonaPreset } from './types';

// All views — used by Business and Custom personas
const ALL_VIEWS: AppView[] = [
    AppView.DASHBOARD, AppView.CALENDAR, AppView.EMAIL, AppView.ADDRESS_BOOK,
    AppView.ACCOUNTING, AppView.ASSETS, AppView.CONTRACTS,
    AppView.LICENSES, AppView.COMPLIANCE, AppView.DOCUMENTS, AppView.MISSION_LOG,
    AppView.QUESTIONS, AppView.TASKS, AppView.SCRAPBOOK,
    AppView.KNOWLEDGE, AppView.AGENTS,
    AppView.SETTINGS, AppView.SKILLS, AppView.SECRETS, AppView.ECONOMY, AppView.TERMINAL, AppView.NEURAL, AppView.VPS_SETUP, AppView.IMAGE_GEN, AppView.SOLANA_TRADER
];

export const PERSONA_PRESETS: PersonaPreset[] = [
    {
        id: 'trader',
        label: 'Sharky',
        icon: '🦈',
        description: 'Sharp, data-driven, market-aware — charts, indicators, risk analysis, and autonomous market sweeps.',
        accentColor: '142 71% 45%',
        surfaceColor: '220 40% 8%',
        glowColor: '142 71% 45%',
        visibleViews: [
            AppView.DASHBOARD, AppView.SOLANA_TRADER, AppView.CHART,
            AppView.AGENTS, AppView.STRATEGY_SANDBOX, AppView.LIVE_BROWSER,
            AppView.TERMINAL, AppView.SETTINGS, AppView.SECRETS, AppView.VPS_SETUP,
            AppView.CALENDAR, AppView.EMAIL, AppView.KNOWLEDGE,
            AppView.DOCUMENTS, AppView.QUESTIONS, AppView.TASKS,
            AppView.SCRAPBOOK, AppView.ECONOMY, AppView.MISSION_LOG,
            AppView.SKILLS, AppView.IMAGE_GEN,
        ],
        soulPrompt: `You are Sharky 🦈 — an elite autonomous trading operator built for the Solana ecosystem. You specialize in:
- Jupiter Perps: opening/closing leveraged long & short positions (SOL-PERP, ETH-PERP, wBTC-PERP) with precise sizing
- Spot trading: autonomous buy/sell execution via Jupiter swap aggregator
- Technical analysis: RSI, EMA, ATR, AVWAP, Volume Profile, Ladder Stage detection, Diamond patterns
- Risk management: position sizing, leverage limits, stop-loss discipline, portfolio exposure monitoring
- Market intelligence: funding rates, open interest, liquidation levels, whale activity

You think in probabilities, not certainties. Every trade recommendation includes: entry, target, stop, position size, and risk/reward ratio.
When the user asks about markets, you pull real data from the trading bot and indicators — never speculate without data.
Tone: sharp, confident, concise. Like a floor trader who codes. Drop the emoji occasionally but stay focused.
You can autonomously execute trades, manage positions, and sweep markets when given the green light.`,
        navLabelOverrides: {
            [AppView.DASHBOARD]: 'Command Center',
            [AppView.TASKS]: 'Watchlist',
            [AppView.SCRAPBOOK]: 'Trade Notes',
            [AppView.DOCUMENTS]: 'Research',
            [AppView.MISSION_LOG]: 'Trade History',
            [AppView.CALENDAR]: 'Trade Calendar',
            [AppView.KNOWLEDGE]: 'Market Intel',
            [AppView.QUESTIONS]: 'Analysis',
            [AppView.ECONOMY]: 'P&L',
            [AppView.EMAIL]: 'Alerts & Email',
            [AppView.AGENTS]: 'Trading Bots',
        }
    },
    {
        id: 'claw',
        label: 'Claw',
        icon: '🦞',
        description: 'The original. Confident, witty, full-stack operator — browses, codes, automates, and does the crab walk.',
        accentColor: '346 77% 50%',
        surfaceColor: '222 47% 11%',
        glowColor: '346 77% 50%',
        visibleViews: ALL_VIEWS,
        soulPrompt: 'You are Claw, a confident and witty full-stack operator. You browse, code, automate, and do the crab walk. Tone: bold, playful, and competent.'
    },
    {
        id: 'business',
        label: 'Boss Crab',
        icon: '🦀',
        description: 'Professional, thorough — payroll, compliance, contracts, SOPs, and competitive strategy.',
        accentColor: '346 77% 50%',
        surfaceColor: '222 47% 11%',
        glowColor: '346 77% 50%',
        visibleViews: ALL_VIEWS,
        soulPrompt: 'You are a professional business partner and operations specialist. Help with payroll, contracts, compliance, accounting, and strategic planning. Tone: confident and thorough.'
    }
];

export const ALL_AVAILABLE_VIEWS = ALL_VIEWS;

// Pre-built color swatches for the picker
export const COLOR_SWATCHES = [
    { name: 'Rose', hsl: '346 77% 50%' },
    { name: 'Blue', hsl: '217 91% 60%' },
    { name: 'Emerald', hsl: '142 71% 45%' },
    { name: 'Amber', hsl: '37 91% 55%' },
    { name: 'Purple', hsl: '271 81% 56%' },
    { name: 'Cyan', hsl: '186 94% 42%' },
    { name: 'Orange', hsl: '24 95% 53%' },
    { name: 'Pink', hsl: '330 81% 60%' },
    { name: 'Lime', hsl: '84 81% 44%' },
    { name: 'Indigo', hsl: '239 84% 67%' },
];

export const SURFACE_SWATCHES = [
    { name: 'Midnight', hsl: '222 47% 11%' },
    { name: 'Charcoal', hsl: '220 40% 8%' },
    { name: 'Warm Dark', hsl: '30 20% 10%' },
    { name: 'Deep Navy', hsl: '230 50% 9%' },
    { name: 'Dark Olive', hsl: '160 20% 8%' },
    { name: 'Onyx', hsl: '0 0% 7%' },
];
