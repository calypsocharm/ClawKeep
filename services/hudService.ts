/*
 * HUD Service — Persona-Aware Heads-Up Display
 * Manages per-persona dashboard configs: what Claw shows, alert thresholds, quick actions.
 * Each persona (assistant/trader/business) gets its own HUD.
 */

export interface QuickAction {
    id: string;
    label: string;
    icon: string;       // emoji
    command: string;     // what to tell Claw when pressed
}

export interface AlertRule {
    id: string;
    label: string;
    condition: string;   // human-readable description for Claw
    severity: 'info' | 'warning' | 'critical';
}

export interface HUDConfig {
    persona: string;
    dashboardPriorities: string[];   // what to emphasize on the dashboard
    quickActions: QuickAction[];
    alertRules: AlertRule[];
    briefingSchedule: string;        // e.g. "9:00 AM daily"
    focusAreas: string[];            // what Claw should proactively monitor
}

import { userScopeService } from './userScopeService';

const STORAGE_BASE = 'hud_configs';

const DEFAULT_HUDS: Record<string, HUDConfig> = {
    assistant: {
        persona: 'assistant',
        dashboardPriorities: [
            'Open tasks and deadlines',
            'Today\'s calendar events',
            'Unanswered questions',
            'Recent notes and reminders',
        ],
        quickActions: [
            { id: 'briefing', label: 'Daily Briefing', icon: '📋', command: 'Give me my daily briefing' },
            { id: 'tasks', label: 'Open Tasks', icon: '✅', command: 'What tasks are pending?' },
            { id: 'schedule', label: 'Today\'s Schedule', icon: '📅', command: 'What\'s on my calendar today?' },
            { id: 'notes', label: 'Recent Notes', icon: '📝', command: 'Show my recent scrapbook notes' },
        ],
        alertRules: [
            { id: 'overdue-tasks', label: 'Overdue Tasks', condition: 'Any task past its due date', severity: 'warning' },
            { id: 'upcoming-events', label: 'Upcoming Events', condition: 'Events starting within 1 hour', severity: 'info' },
        ],
        briefingSchedule: '9:00 AM daily',
        focusAreas: ['Task completion', 'Calendar awareness', 'Note organization'],
    },

    trader: {
        persona: 'trader',
        dashboardPriorities: [
            'Portfolio P&L summary',
            'Active trade positions',
            'Market alerts and news',
            'Agent bot status',
        ],
        quickActions: [
            { id: 'market-scan', label: 'Market Scan', icon: '📈', command: 'Run a quick market scan for my watchlist' },
            { id: 'pnl', label: 'P&L Report', icon: '💰', command: 'Show my current P&L summary' },
            { id: 'news', label: 'Market News', icon: '📰', command: 'What\'s the latest market news?' },
            { id: 'bots', label: 'Bot Status', icon: '🤖', command: 'Status check on all trading bots' },
        ],
        alertRules: [
            { id: 'large-move', label: 'Large Price Move', condition: 'Any tracked asset moves > 5% in a day', severity: 'critical' },
            { id: 'bot-error', label: 'Bot Error', condition: 'Any trading bot reports an error or stops', severity: 'critical' },
            { id: 'earnings', label: 'Earnings Report', condition: 'Tracked company reports earnings this week', severity: 'warning' },
        ],
        briefingSchedule: '8:30 AM daily (pre-market)',
        focusAreas: ['Portfolio risk', 'Market conditions', 'Bot performance', 'Trade opportunities'],
    },

    business: {
        persona: 'business',
        dashboardPriorities: [
            'Compliance deadlines and expiring licenses',
            'Payroll and tax filing status',
            'Open contracts and renewals',
            'Agent squad mission status',
            'Expense tracking summary',
        ],
        quickActions: [
            { id: 'briefing', label: 'Situation Report', icon: '📊', command: 'Give me a full business situation report' },
            { id: 'compliance', label: 'Compliance Check', icon: '⚖️', command: 'Check all compliance deadlines and flag anything urgent' },
            { id: 'payroll', label: 'Payroll Status', icon: '💵', command: 'What\'s the current payroll status?' },
            { id: 'agents', label: 'Squad Status', icon: '🦀', command: 'Report on all agent missions' },
            { id: 'expenses', label: 'Expense Summary', icon: '🧾', command: 'Show this month\'s expense summary' },
        ],
        alertRules: [
            { id: 'license-expiry', label: 'License Expiring', condition: 'Any license expires within 30 days', severity: 'critical' },
            { id: 'tax-deadline', label: 'Tax Deadline', condition: 'Tax filing due within 14 days', severity: 'critical' },
            { id: 'contract-renewal', label: 'Contract Renewal', condition: 'Contract expires within 60 days', severity: 'warning' },
            { id: 'expense-spike', label: 'Expense Spike', condition: 'Daily expenses exceed $500', severity: 'warning' },
            { id: 'agent-stale', label: 'Stale Agent', condition: 'Agent has not reported in > 2 hours', severity: 'info' },
        ],
        briefingSchedule: '9:00 AM daily',
        focusAreas: ['Compliance', 'Payroll & taxes', 'Contracts', 'Cash flow', 'Agent operations'],
    },
};

class HUDService {
    private configs: Record<string, HUDConfig>;
    private listeners: (() => void)[] = [];

    constructor() {
        const saved = userScopeService.scopedGet(STORAGE_BASE);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge saved over defaults so new default fields are preserved
                this.configs = { ...DEFAULT_HUDS };
                for (const key of Object.keys(parsed)) {
                    this.configs[key] = { ...DEFAULT_HUDS[key], ...parsed[key] };
                }
            } catch {
                this.configs = { ...DEFAULT_HUDS };
            }
        } else {
            this.configs = { ...DEFAULT_HUDS };
        }
    }

    /** Get HUD config for a specific persona */
    getConfig(persona: string): HUDConfig {
        return this.configs[persona] || this.configs['assistant'];
    }

    /** Get compact HUD context for system prompt injection */
    getHUDContext(persona: string): string {
        const hud = this.getConfig(persona);
        const lines = [
            `HUD Persona: ${hud.persona}`,
            `Dashboard Focus: ${hud.dashboardPriorities.join('; ')}`,
            `Quick Actions: ${hud.quickActions.map(a => `${a.icon} ${a.label}`).join(', ')}`,
            `Alert Rules: ${hud.alertRules.map(a => `[${a.severity.toUpperCase()}] ${a.condition}`).join('; ')}`,
            `Briefing: ${hud.briefingSchedule}`,
            `Focus Areas: ${hud.focusAreas.join(', ')}`,
        ];
        return lines.join('\n');
    }

    /** Update HUD for a specific persona */
    updateConfig(persona: string, updates: Partial<HUDConfig>): void {
        this.configs[persona] = { ...this.getConfig(persona), ...updates };
        this.persist();
        this.notify();
    }

    /** Add a quick action to a persona */
    addQuickAction(persona: string, action: QuickAction): void {
        const config = this.getConfig(persona);
        config.quickActions.push(action);
        this.persist();
        this.notify();
    }

    /** Remove a quick action */
    removeQuickAction(persona: string, actionId: string): void {
        const config = this.getConfig(persona);
        config.quickActions = config.quickActions.filter(a => a.id !== actionId);
        this.persist();
        this.notify();
    }

    /** Add an alert rule */
    addAlertRule(persona: string, rule: AlertRule): void {
        const config = this.getConfig(persona);
        config.alertRules.push(rule);
        this.persist();
        this.notify();
    }

    /** Remove an alert rule */
    removeAlertRule(persona: string, ruleId: string): void {
        const config = this.getConfig(persona);
        config.alertRules = config.alertRules.filter(r => r.id !== ruleId);
        this.persist();
        this.notify();
    }

    /** Reset a persona's HUD to defaults */
    resetConfig(persona: string): void {
        this.configs[persona] = { ...DEFAULT_HUDS[persona] || DEFAULT_HUDS['assistant'] };
        this.persist();
        this.notify();
    }

    /** Get all persona IDs that have HUD configs */
    getPersonaIds(): string[] {
        return Object.keys(this.configs);
    }

    /** Subscribe to changes */
    subscribe(listener: () => void): () => void {
        this.listeners.push(listener);
        return () => { this.listeners = this.listeners.filter(l => l !== listener); };
    }

    private persist(): void {
        userScopeService.scopedSet(STORAGE_BASE, JSON.stringify(this.configs));
    }

    private notify(): void {
        this.listeners.forEach(l => l());
    }
}

export const hudService = new HUDService();
