/*
 * OpenCrabShell API Service — Auth Hardened
 * Frontend client for the VPS SQLite REST API
 * Falls back to localStorage when VPS is unreachable
 */

import { userScopeService } from './userScopeService';

const API_BASE = (() => {
    const host = window.location.hostname;
    const port = window.location.port;
    // In production, API is on the same host
    // In dev, it's on the VPS
    if (host === 'localhost' || host === '127.0.0.1') {
        return (import.meta.env.VITE_API_HOST || window.location.origin) + '/api';
    }
    return `${window.location.protocol}//${host}${port ? ':' + port : ''}/api`;
})();

let isOnline = true;

// --- Auth Token Management (in-memory, not localStorage for XSS safety) ---
let authToken: string | null = localStorage.getItem('claw_auth_token');
let currentUser: { id: string; email: string; name: string; role: string } | null = null;
let onAuthFailure: (() => void) | null = null;

function setAuthToken(token: string | null) {
    authToken = token;
    if (token) {
        localStorage.setItem('claw_auth_token', token);
    } else {
        localStorage.removeItem('claw_auth_token');
    }
}

function setOnAuthFailure(callback: () => void) {
    onAuthFailure = callback;
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {})
        };

        // Add auth token to all requests
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        });

        // Handle 401 — token expired or invalid
        if (res.status === 401 && !path.startsWith('/auth/')) {
            console.warn('[API] Authentication failed — redirecting to login');
            setAuthToken(null);
            currentUser = null;
            if (onAuthFailure) onAuthFailure();
            throw new Error('Authentication required');
        }

        if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
        isOnline = true;
        return res.json();
    } catch (err) {
        if ((err as Error).message === 'Authentication required') throw err;
        isOnline = false;
        console.warn(`[API] Offline — falling back to localStorage.`, (err as Error).message);
        throw err;
    }
}

// --- Auth Functions ---
async function register(email: string, password: string, name?: string): Promise<{ user: any; token: string }> {
    const result = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name })
    });
    setAuthToken(result.token);
    currentUser = result.user;
    userScopeService.setCurrentUserId(result.user.id);
    return result;
}

async function login(email: string, password: string): Promise<{ user: any; token: string }> {
    const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    setAuthToken(result.token);
    currentUser = result.user;
    userScopeService.setCurrentUserId(result.user.id);
    return result;
}

async function validateSession(): Promise<{ user: any } | null> {
    if (!authToken) return null;
    try {
        const result = await request('/auth/me');
        currentUser = result.user;
        // Ensure user scope is set on session restore
        userScopeService.setCurrentUserId(result.user.id);
        return result;
    } catch {
        setAuthToken(null);
        currentUser = null;
        return null;
    }
}

function logout() {
    setAuthToken(null);
    currentUser = null;
    userScopeService.clearUserScope();
}

function getToken(): string | null {
    return authToken;
}

function getCurrentUser(): typeof currentUser {
    return currentUser;
}

// --- Generic CRUD factory (localStorage fallback uses user-scoped keys) ---
function createResource<T extends { id: string }>(resourceName: string, localStorageKey: string) {
    // Strip 'claw_' prefix for scoped storage — userScopeService adds its own prefix
    const baseKey = localStorageKey.replace(/^claw_/, '');

    return {
        async list(): Promise<T[]> {
            try {
                return await request(`/${resourceName}`);
            } catch {
                const saved = userScopeService.scopedGet(baseKey);
                return saved ? JSON.parse(saved) : [];
            }
        },

        async get(id: string): Promise<T | null> {
            try {
                return await request(`/${resourceName}/${id}`);
            } catch {
                const items = JSON.parse(userScopeService.scopedGet(baseKey) || '[]');
                return items.find((i: any) => i.id === id) || null;
            }
        },

        async create(item: T): Promise<T> {
            try {
                return await request(`/${resourceName}`, {
                    method: 'POST',
                    body: JSON.stringify(item)
                });
            } catch {
                // Fallback: save to localStorage
                const items = JSON.parse(userScopeService.scopedGet(baseKey) || '[]');
                items.unshift(item);
                userScopeService.scopedSet(baseKey, JSON.stringify(items));
                return item;
            }
        },

        async update(id: string, data: Partial<T>): Promise<T> {
            try {
                return await request(`/${resourceName}/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            } catch {
                const items = JSON.parse(userScopeService.scopedGet(baseKey) || '[]');
                const idx = items.findIndex((i: any) => i.id === id);
                if (idx >= 0) items[idx] = { ...items[idx], ...data };
                userScopeService.scopedSet(baseKey, JSON.stringify(items));
                return items[idx];
            }
        },

        async delete(id: string): Promise<void> {
            try {
                await request(`/${resourceName}/${id}`, { method: 'DELETE' });
            } catch {
                const items = JSON.parse(userScopeService.scopedGet(baseKey) || '[]');
                userScopeService.scopedSet(baseKey, JSON.stringify(items.filter((i: any) => i.id !== id)));
            }
        },

        async save(items: T[]): Promise<void> {
            // Save full array — used for state sync
            userScopeService.scopedSet(baseKey, JSON.stringify(items));
            try {
                // Sync to server via bulk endpoint
                await request('/sync', {
                    method: 'POST',
                    body: JSON.stringify({ [resourceName]: items })
                });
            } catch {
                // Server unreachable — localStorage is the backup
            }
        }
    };
}

// --- Config helpers (user-scoped) ---
const config = {
    async get(key: string): Promise<any> {
        try {
            const res = await request(`/config/${key}`);
            return res.value;
        } catch {
            const saved = userScopeService.scopedGet(`config_${key}`);
            return saved ? JSON.parse(saved) : null;
        }
    },

    async set(key: string, value: any): Promise<void> {
        userScopeService.scopedSet(`config_${key}`, JSON.stringify(value));
        try {
            await request('/config', {
                method: 'PUT',
                body: JSON.stringify({ key, value })
            });
        } catch { /* offline fallback */ }
    }
};

// --- Sync: pull all data from server ---
async function pullAll(): Promise<any> {
    try {
        return await request('/sync/pull');
    } catch {
        return null; // Offline — use localStorage
    }
}

// --- Sync: push all localStorage data to server ---
async function pushAll(data: Record<string, any[]>): Promise<any> {
    try {
        return await request('/sync', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    } catch {
        return null;
    }
}

// --- Admin functions ---
const admin = {
    async listUsers(): Promise<any[]> {
        return await request('/admin/users');
    },
    async deleteUser(id: string): Promise<void> {
        await request(`/admin/users/${id}`, { method: 'DELETE' });
    },
    async changeRole(id: string, role: 'admin' | 'user'): Promise<void> {
        await request(`/admin/users/${id}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
    }
};

// --- Resource instances ---
export const api = {
    tasks: createResource('tasks', 'claw_tasks'),
    documents: createResource('documents', 'claw_documents'),
    agents: createResource('agents', 'claw_agents'),
    expenses: createResource('expenses', 'claw_expenses'),
    checklists: createResource('checklists', 'claw_checklists'),
    chat: createResource('chat', 'claw_chat_history'),
    contacts: createResource('contacts', 'claw_contacts'),
    cron: createResource('cron', 'claw_cron_jobs'),
    events: createResource('events', 'claw_events'),
    config,
    pullAll,
    pushAll,
    admin,
    // Auth
    register,
    login,
    logout,
    validateSession,
    getToken,
    getCurrentUser,
    setOnAuthFailure,
    get isOnline() { return isOnline; }
};

// Alias for backward compat
export const apiService = api;
