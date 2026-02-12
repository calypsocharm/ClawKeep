/*
 * User Scope Service — Per-User localStorage Isolation
 * 
 * Prefixes all localStorage keys with the active user's ID so each account
 * gets its own "empty house" — own API keys, memories, chat, guardrails, etc.
 * 
 * The auth token stays UNSCOPED because we need it before knowing the user ID.
 */

const USER_ID_KEY = 'claw_active_user_id';

// Keys that must NEVER be scoped (needed before auth)
const UNSCOPED_KEYS = new Set([
    'claw_auth_token',
    'claw_active_user_id',
]);

class UserScopeService {
    private userId: string | null = null;

    constructor() {
        // Restore from previous session
        this.userId = localStorage.getItem(USER_ID_KEY);
    }

    /** Called on login — sets the active user context */
    setCurrentUserId(userId: string) {
        this.userId = userId;
        localStorage.setItem(USER_ID_KEY, userId);
    }

    /** Returns the active user ID, or null if not logged in */
    getCurrentUserId(): string | null {
        return this.userId;
    }

    /** Called on logout — clears the active user context (data stays for next login) */
    clearUserScope() {
        this.userId = null;
        localStorage.removeItem(USER_ID_KEY);
    }

    /**
     * Returns a user-scoped localStorage key.
     * Input should be the BASE key without 'claw_' prefix.
     * e.g. scopedKey('memories') → 'claw_{userId}_memories'
     * Falls back to 'claw_{baseKey}' if no user is set (shouldn't happen in normal flow).
     */
    scopedKey(baseKey: string): string {
        if (this.userId) {
            return `claw_${this.userId}_${baseKey}`;
        }
        // Fallback for pre-auth reads (shouldn't happen but safe)
        return `claw_${baseKey}`;
    }

    /** Scoped localStorage.getItem */
    scopedGet(baseKey: string): string | null {
        return localStorage.getItem(this.scopedKey(baseKey));
    }

    /** Scoped localStorage.setItem */
    scopedSet(baseKey: string, value: string): void {
        localStorage.setItem(this.scopedKey(baseKey), value);
    }

    /** Scoped localStorage.removeItem */
    scopedRemove(baseKey: string): void {
        localStorage.removeItem(this.scopedKey(baseKey));
    }

    /** Alias for setCurrentUserId — used by App.tsx */
    setUserId(userId: string | null) {
        if (userId) {
            this.setCurrentUserId(userId);
        } else {
            this.clearUserScope();
        }
    }
}

export const userScopeService = new UserScopeService();
