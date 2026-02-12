/*
 * Claw Memory Service
 * Persistent brain — extracts, stores, and retrieves key facts
 * from conversations to give Claw long-term memory.
 */

import { api } from './apiService';
import { userScopeService } from './userScopeService';

interface Memory {
    id: string;
    fact: string;
    category: string;
    source: string;
    confidence: number;
    createdAt: string;
    lastAccessed: string;
    accessCount: number;
}

class MemoryService {
    private localCache: Memory[] = [];

    async init() {
        try {
            const memories = await api.config.get('memories_cache');
            if (memories && Array.isArray(memories)) {
                this.localCache = memories;
            }
            // Also try to load from API
            const serverMemories = await fetch(`${this.getApiBase()}/memories`).then(r => r.json()).catch(() => []);
            if (serverMemories.length > 0) {
                this.localCache = serverMemories;
            }
        } catch {
            const saved = userScopeService.scopedGet('memories');
            if (saved) this.localCache = JSON.parse(saved);
        }
        console.log(`[Memory] Loaded ${this.localCache.length} memories`);
    }

    private getApiBase(): string {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return (import.meta.env.VITE_API_HOST || window.location.origin) + '/api';
        }
        return `${window.location.protocol}//${host}:${window.location.port || '8080'}/api`;
    }

    // --- Save a new memory ---
    async remember(fact: string, category: string = 'GENERAL', source: string = 'conversation'): Promise<string> {
        // Check for duplicates — don't store near-identical facts
        const isDuplicate = this.localCache.some(m =>
            m.fact.toLowerCase().includes(fact.toLowerCase().slice(0, 30)) ||
            fact.toLowerCase().includes(m.fact.toLowerCase().slice(0, 30))
        );
        if (isDuplicate) return 'Memory already exists (similar fact found).';

        const memory: Memory = {
            id: `mem_${Date.now()}`,
            fact,
            category: category.toUpperCase(),
            source,
            confidence: 0.9,
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            accessCount: 0
        };

        this.localCache.unshift(memory);
        this.persist();

        // Save to server
        try {
            await fetch(`${this.getApiBase()}/memories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memory)
            });
        } catch { /* offline fallback */ }

        return `Memorized: "${fact}" [${category}]`;
    }

    // --- Recall memories relevant to a query ---
    async recall(query: string, limit: number = 5): Promise<Memory[]> {
        const q = query.toLowerCase();
        const words = q.split(/\s+/).filter(w => w.length > 2);

        // Score each memory by word overlap
        const scored = this.localCache.map(m => {
            const factLower = m.fact.toLowerCase();
            const catLower = m.category.toLowerCase();
            let score = 0;
            for (const word of words) {
                if (factLower.includes(word)) score += 2;
                if (catLower.includes(word)) score += 1;
            }
            // Boost recent and frequently accessed memories
            const ageHours = (Date.now() - new Date(m.createdAt).getTime()) / 3600000;
            if (ageHours < 24) score += 1;  // Recent boost
            score += Math.min(m.accessCount * 0.1, 0.5); // Frequency boost
            return { memory: m, score };
        });

        const results = scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.memory);

        // Update access count
        results.forEach(m => {
            m.accessCount += 1;
            m.lastAccessed = new Date().toISOString();
        });
        if (results.length > 0) this.persist();

        return results;
    }

    // --- Get all memories for context injection ---
    getTopMemories(limit: number = 10): Memory[] {
        return this.localCache
            .sort((a, b) => b.accessCount - a.accessCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    }

    // --- Format memories for system prompt injection ---
    getMemoryContext(): string {
        const top = this.getTopMemories(15);
        if (top.length === 0) return '';

        const lines = top.map(m => `• [${m.category}] ${m.fact}`);
        return `\n\nCLAW'S PERSISTENT MEMORY (${top.length} facts):\n${lines.join('\n')}`;
    }

    // --- Forget a specific memory ---
    async forget(memoryId: string): Promise<string> {
        const found = this.localCache.find(m => m.id === memoryId);
        if (!found) return 'Memory not found.';
        this.localCache = this.localCache.filter(m => m.id !== memoryId);
        this.persist();
        try {
            await fetch(`${this.getApiBase()}/memories/${memoryId}`, { method: 'DELETE' });
        } catch { /* offline */ }
        return `Forgotten: "${found.fact}"`;
    }

    // --- Forget all memories in a category ---
    async forgetCategory(category: string): Promise<string> {
        const count = this.localCache.filter(m => m.category === category.toUpperCase()).length;
        this.localCache = this.localCache.filter(m => m.category !== category.toUpperCase());
        this.persist();
        return `Cleared ${count} memories from [${category}].`;
    }

    // --- Stats ---
    getStats(): { total: number; categories: Record<string, number> } {
        const categories: Record<string, number> = {};
        this.localCache.forEach(m => {
            categories[m.category] = (categories[m.category] || 0) + 1;
        });
        return { total: this.localCache.length, categories };
    }

    private persist() {
        userScopeService.scopedSet('memories', JSON.stringify(this.localCache));
    }
}

export const memoryService = new MemoryService();
