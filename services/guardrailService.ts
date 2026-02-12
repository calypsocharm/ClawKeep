/*
 * Guardrail Service
 * Central enforcement point for sleep mode, email consent, internet abilities,
 * and API usage controls. Only the operator can change these settings —
 * Claw and agents cannot modify guardrails.
 */

import { api } from './apiService';
import { userScopeService } from './userScopeService';

export interface GuardrailSettings {
    sleepSchedule: {
        awakeStart: number;   // Hour 0-23 (default 7 = 7am)
        awakeEnd: number;     // Hour 0-23 (default 23 = 11pm)
    };
    sleepOverride: boolean;    // true = force awake, false = follow schedule
    emailEnabled: boolean;     // Email consent toggle
    internetEnabled: boolean;  // Browser/web abilities toggle
    apiInSleep: boolean;       // Allow API calls during sleep (default: false)
}

type GuardrailListener = (settings: GuardrailSettings) => void;

const STORAGE_BASE = 'guardrail_settings';

const DEFAULT_SETTINGS: GuardrailSettings = {
    sleepSchedule: { awakeStart: 7, awakeEnd: 23 },
    sleepOverride: false,
    emailEnabled: true,
    internetEnabled: true,
    apiInSleep: false,
};

class GuardrailService {
    private settings: GuardrailSettings;
    private listeners: GuardrailListener[] = [];

    constructor() {
        const saved = userScopeService.scopedGet(STORAGE_BASE);
        if (saved) {
            try {
                this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            } catch {
                this.settings = { ...DEFAULT_SETTINGS };
            }
        } else {
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    // --- Core Checks ---

    /** Is Claw/agents allowed to be active right now? */
    isAwake(): boolean {
        if (this.settings.sleepOverride) return true;

        const hour = new Date().getHours();
        const { awakeStart, awakeEnd } = this.settings.sleepSchedule;

        // Handle overnight sleep (e.g. awakeStart=7, awakeEnd=23 → sleep 23-7)
        if (awakeStart < awakeEnd) {
            return hour >= awakeStart && hour < awakeEnd;
        } else {
            // Wraps midnight (e.g. awakeStart=22, awakeEnd=6)
            return hour >= awakeStart || hour < awakeEnd;
        }
    }

    /** Is email sending allowed? */
    isEmailAllowed(): boolean {
        return this.settings.emailEnabled;
    }

    /** Is internet/browser usage allowed? */
    isInternetAllowed(): boolean {
        return this.settings.internetEnabled;
    }

    /** Is API usage allowed right now? (blocked during sleep unless apiInSleep is on) */
    isApiAllowed(): boolean {
        if (this.isAwake()) return true;
        return this.settings.apiInSleep;
    }

    /** Get time until next wake (in minutes), or 0 if awake */
    getMinutesUntilWake(): number {
        if (this.isAwake()) return 0;

        const now = new Date();
        const hour = now.getHours();
        const min = now.getMinutes();
        const currentMinutes = hour * 60 + min;
        const wakeMinutes = this.settings.sleepSchedule.awakeStart * 60;

        if (currentMinutes < wakeMinutes) {
            return wakeMinutes - currentMinutes;
        }
        // Past midnight, wake is tomorrow
        return (24 * 60 - currentMinutes) + wakeMinutes;
    }

    /** Get a human-readable status string */
    getStatusText(): string {
        if (this.isAwake()) {
            const end = this.settings.sleepSchedule.awakeEnd;
            return `AWAKE (until ${end > 12 ? end - 12 : end}${end >= 12 ? 'PM' : 'AM'})`;
        }
        const minsUntil = this.getMinutesUntilWake();
        const hrs = Math.floor(minsUntil / 60);
        const mins = minsUntil % 60;
        return `SLEEPING (wakes in ${hrs}h ${mins}m)`;
    }

    // --- Settings Management ---

    getSettings(): GuardrailSettings {
        return { ...this.settings };
    }

    updateSettings(partial: Partial<GuardrailSettings>): void {
        this.settings = { ...this.settings, ...partial };
        this.persist();
        this.notify();
    }

    updateSleepSchedule(awakeStart: number, awakeEnd: number): void {
        this.settings.sleepSchedule = { awakeStart, awakeEnd };
        this.persist();
        this.notify();
    }

    toggleSleepOverride(override: boolean): void {
        this.settings.sleepOverride = override;
        this.persist();
        this.notify();
    }

    toggleEmail(enabled: boolean): void {
        this.settings.emailEnabled = enabled;
        this.persist();
        this.notify();
    }

    toggleInternet(enabled: boolean): void {
        this.settings.internetEnabled = enabled;
        this.persist();
        this.notify();
    }

    toggleApiInSleep(enabled: boolean): void {
        this.settings.apiInSleep = enabled;
        this.persist();
        this.notify();
    }

    // --- Subscriptions ---

    subscribe(listener: GuardrailListener): () => void {
        this.listeners.push(listener);
        listener(this.settings);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // --- Persistence ---

    private persist(): void {
        // Dual-write: localStorage (offline) + API config (VPS)
        userScopeService.scopedSet(STORAGE_BASE, JSON.stringify(this.settings));
        try {
            fetch(this.getApiBase() + '/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'guardrail_settings', value: JSON.stringify(this.settings) })
            }).catch(() => { /* offline fallback */ });
        } catch { /* offline fallback */ }
    }

    private notify(): void {
        this.listeners.forEach(l => l(this.settings));
    }

    private getApiBase(): string {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return (import.meta.env.VITE_API_HOST || window.location.origin) + '/api';
        }
        return `${window.location.protocol}//${host}:${window.location.port || '8080'}/api`;
    }
}

export const guardrailService = new GuardrailService();
