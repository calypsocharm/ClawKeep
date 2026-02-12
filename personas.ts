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
        id: 'claw',
        label: 'Claw',
        icon: '🦞',
        description: 'The original — confident, witty, full-stack operator.',
        accentColor: '346 77% 50%',
        surfaceColor: '222 47% 11%',
        glowColor: '346 77% 50%',
        visibleViews: ALL_VIEWS,
        soulPrompt: 'You are Claw, a confident and witty full-stack operator. You browse, code, automate, and do the crab walk. Tone: bold, playful, and competent.'
    },
    {
        id: 'trader',
        label: 'Sharky',
        icon: '🦈',
        description: 'Portfolio analysis, market watch, news feeds, trade tracking.',
        accentColor: '142 71% 45%',
        surfaceColor: '220 40% 8%',
        glowColor: '142 71% 45%',
        visibleViews: [
            AppView.DASHBOARD, AppView.CALENDAR, AppView.EMAIL,
            AppView.AGENTS, AppView.KNOWLEDGE, AppView.DOCUMENTS, AppView.QUESTIONS,
            AppView.TASKS, AppView.SCRAPBOOK, AppView.ECONOMY, AppView.MISSION_LOG,
            AppView.SETTINGS, AppView.SKILLS, AppView.SECRETS, AppView.TERMINAL, AppView.VPS_SETUP, AppView.IMAGE_GEN, AppView.SOLANA_TRADER
        ],
        soulPrompt: 'You are a sharp financial analyst and trading assistant. Focus on market data, risk assessment, and portfolio strategy. Tone: concise, data-driven, and precise.',
        navLabelOverrides: {
            [AppView.DASHBOARD]: 'Terminal',
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
        id: 'business',
        label: 'Boss Crab',
        icon: '🦀',
        description: 'Full operations — payroll, contracts, fleet, accounting, agents.',
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
