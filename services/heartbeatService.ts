import { activityService } from './activityService';
import { guardrailService } from './guardrailService';
import { userScopeService } from './userScopeService';

type PulseCallback = (report: string, isUrgent: boolean) => void;
type ContextProvider = () => string;

interface HeartbeatConfig {
    enabled: boolean;
    intervalMinutes: number;
    activeStartHour: number;  // 9 = 9am
    activeEndHour: number;    // 12 = 12pm
    mode: 'ACTIVE' | 'SLEEP';
}

interface HeartbeatStatus {
    config: HeartbeatConfig;
    lastPulse: string | null;
    nextPulse: string | null;
    pulseCount: number;
}

class HeartbeatService {
    private config: HeartbeatConfig;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private lastPulse: string | null = null;
    private pulseCount: number = 0;
    private contextProvider: ContextProvider | null = null;
    private onPulse: PulseCallback | null = null;
    private onGeminiPulse: ((context: string) => Promise<string>) | null = null;

    constructor() {
        const saved = userScopeService.scopedGet('heartbeat_config');
        if (saved) {
            this.config = JSON.parse(saved);
        } else {
            this.config = {
                enabled: false,
                intervalMinutes: 30,
                activeStartHour: 9,
                activeEndHour: 12,
                mode: 'SLEEP'
            };
        }
    }

    /**
     * Wire up the heartbeat with context and callbacks
     */
    init(
        contextProvider: ContextProvider,
        onPulse: PulseCallback,
        onGeminiPulse: (context: string) => Promise<string>
    ) {
        this.contextProvider = contextProvider;
        this.onPulse = onPulse;
        this.onGeminiPulse = onGeminiPulse;

        // Auto-start if it was previously enabled
        if (this.config.enabled) {
            this.startLoop();
        }
    }

    /**
     * Start the heartbeat loop
     */
    start(intervalMinutes?: number) {
        if (intervalMinutes) {
            this.config.intervalMinutes = intervalMinutes;
        }
        this.config.enabled = true;
        this.persist();
        this.startLoop();
        activityService.log('TERMINAL', `💓 Heartbeat started: every ${this.config.intervalMinutes}min (active ${this.config.activeStartHour}:00–${this.config.activeEndHour}:00)`);
    }

    /**
     * Stop the heartbeat loop
     */
    stop() {
        this.config.enabled = false;
        this.config.mode = 'SLEEP';
        this.persist();
        this.clearLoop();
        activityService.log('TERMINAL', '💤 Heartbeat stopped — entering permanent sleep.');
    }

    /**
     * Configure the active time window
     */
    setActiveWindow(startHour: number, endHour: number) {
        this.config.activeStartHour = startHour;
        this.config.activeEndHour = endHour;
        this.persist();
    }

    /**
     * Change the pulse interval
     */
    setInterval(minutes: number) {
        this.config.intervalMinutes = minutes;
        this.persist();
        // Restart the loop with new interval if running
        if (this.config.enabled) {
            this.clearLoop();
            this.startLoop();
        }
    }

    /**
     * Force an immediate pulse regardless of time window
     */
    async forcePulse(): Promise<string> {
        return this.executePulse(true);
    }

    /**
     * Get current heartbeat status
     */
    getStatus(): HeartbeatStatus {
        this.updateMode();
        const nextPulseMs = this.config.enabled
            ? (this.lastPulse
                ? new Date(this.lastPulse).getTime() + this.config.intervalMinutes * 60000
                : Date.now() + this.config.intervalMinutes * 60000)
            : null;

        return {
            config: { ...this.config },
            lastPulse: this.lastPulse,
            nextPulse: nextPulseMs ? new Date(nextPulseMs).toISOString() : null,
            pulseCount: this.pulseCount
        };
    }

    // --- Internal ---

    private startLoop() {
        this.clearLoop();
        const ms = this.config.intervalMinutes * 60 * 1000;
        this.intervalId = setInterval(() => this.tick(), ms);
        // Run a first check in 5 seconds to see if we're in the active window
        setTimeout(() => this.tick(), 5000);
    }

    private clearLoop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private updateMode() {
        const hour = new Date().getHours();
        const wasMode = this.config.mode;
        this.config.mode = (hour >= this.config.activeStartHour && hour < this.config.activeEndHour)
            ? 'ACTIVE'
            : 'SLEEP';

        if (wasMode !== this.config.mode) {
            if (this.config.mode === 'ACTIVE') {
                activityService.log('TERMINAL', `☀️ Heartbeat waking up — active window ${this.config.activeStartHour}:00–${this.config.activeEndHour}:00`);
            } else {
                activityService.log('TERMINAL', '🌙 Heartbeat entering sleep mode — outside active window');
            }
            this.persist();
        }
    }

    private async tick() {
        if (!this.config.enabled) return;
        // Guardrail: global sleep mode overrides heartbeat window
        if (!guardrailService.isAwake()) return;
        this.updateMode();

        if (this.config.mode === 'SLEEP') {
            return; // Skip pulse — outside active hours
        }

        await this.executePulse(false);
    }

    private async executePulse(forced: boolean): Promise<string> {
        if (!this.contextProvider || !this.onGeminiPulse) {
            return 'Heartbeat not wired up — no context provider.';
        }

        const context = this.contextProvider();
        const now = new Date();
        this.lastPulse = now.toISOString();
        this.pulseCount++;

        activityService.log('SCANNING', `💓 Heartbeat pulse #${this.pulseCount}${forced ? ' (forced)' : ''}...`);

        const pulsePrompt = `[HEARTBEAT PULSE #${this.pulseCount} — ${now.toLocaleTimeString()}]
You are performing a scheduled heartbeat check. Quickly scan the current business state and report:
1. Any OVERDUE or due-today tasks (flag as urgent)
2. Upcoming deadlines in the next 24 hours
3. Agent squad status (any agents that need attention)
4. Any anomalies or items the operator should know about

Be BRIEF (2-5 sentences max). If nothing urgent, say "All clear" with a quick summary.
If something is urgent, start your response with "⚠️ URGENT:" so it gets flagged.

Current Business State:
${context}`;

        try {
            const report = await this.onGeminiPulse(pulsePrompt);
            const isUrgent = report.includes('⚠️ URGENT') || report.includes('URGENT');

            if (this.onPulse) {
                this.onPulse(report, isUrgent);
            }

            activityService.log('TERMINAL', `💓 Pulse complete: ${isUrgent ? '⚠️ URGENT items found' : '✅ All clear'}`);
            return report;
        } catch (err: any) {
            activityService.log('TERMINAL', `💓 Pulse failed: ${err.message}`);
            return `Heartbeat pulse failed: ${err.message}`;
        }
    }

    private persist() {
        userScopeService.scopedSet('heartbeat_config', JSON.stringify(this.config));
    }
}

export const heartbeatService = new HeartbeatService();
