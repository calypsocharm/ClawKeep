/*
 * Billing Service Stub — Lightweight placeholder
 * Full billing was removed in the ClawKeep fork.
 * This stub keeps existing service imports from breaking.
 */

import { userScopeService } from './userScopeService';

interface UsageStats {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    models: Record<string, { calls: number; inputTokens: number; outputTokens: number; cost: number }>;
}

type Listener = (stats: UsageStats) => void;

const EMPTY_STATS: UsageStats = {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    models: {},
};

class BillingService {
    private listeners: Listener[] = [];

    private _load(): UsageStats {
        try {
            const raw = userScopeService.scopedGet('billing_stats');
            return raw ? JSON.parse(raw) : { ...EMPTY_STATS };
        } catch { return { ...EMPTY_STATS }; }
    }

    private _save(stats: UsageStats) {
        userScopeService.scopedSet('billing_stats', JSON.stringify(stats));
        this.listeners.forEach(l => l(stats));
    }

    getStats(): UsageStats { return this._load(); }

    recordUsage(model: string, inputTokens: number, outputTokens: number) {
        const stats = this._load();
        stats.totalCalls++;
        stats.totalInputTokens += inputTokens;
        stats.totalOutputTokens += outputTokens;
        if (!stats.models[model]) stats.models[model] = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
        stats.models[model].calls++;
        stats.models[model].inputTokens += inputTokens;
        stats.models[model].outputTokens += outputTokens;
        this._save(stats);
    }

    subscribe(callback: Listener): () => void {
        this.listeners.push(callback);
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }

    reset() {
        this._save({ ...EMPTY_STATS });
    }

    getTodayCost() { return 0; }
    getWeekCost() { return 0; }
    getMonthCost() { return 0; }
    getAllTimeCost() { return this._load().totalCost; }
    getTodayCalls() { return this._load().totalCalls; }
}

export const billingService = new BillingService();
