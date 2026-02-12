/*
 * Brain Service — MASTER_SPEC Manager
 * Manages the business brain file that gives Claw persistent business context.
 * Stored in localStorage with VPS vault sync.
 */

import { userScopeService } from './userScopeService';

const STORAGE_BASE = 'master_spec';

const DEFAULT_SPEC = `# MASTER SPEC — Business Brain
# This document is Claw's primary source of business context.
# Edit it here or in Settings → Business Brain.

## Business Identity
- Company Name: 
- State of Formation: 
- Entity Type: 
- EIN: 
- Formation Date: 

## Current Priorities
<!-- What should Claw focus on right now? -->
1. 

## Standing Orders
<!-- Rules Claw should always follow -->
- Check compliance calendar weekly
- Always verify document accuracy before filing

## Key Accounts & References
<!-- Tax accounts, registered agent, important URLs -->

## Standard Procedures
<!-- How-to guides for recurring tasks -->

## Agent Delegation Rules
<!-- Which agents handle which types of work -->

## Security Rules
<!-- What Claw must NEVER do with sensitive data -->
- Never share EIN, SSN, or bank details in chat
- Never email financial documents without operator approval
- Never store passwords in the vault
`;

class BrainService {
    private spec: string;
    private listeners: ((spec: string) => void)[] = [];

    constructor() {
        const saved = userScopeService.scopedGet(STORAGE_BASE);
        this.spec = saved || DEFAULT_SPEC;
    }

    /** Get the current spec content */
    getSpec(): string {
        return this.spec;
    }

    /** Get a compact version for system prompt injection (strips comments, empty lines) */
    getCompactSpec(): string {
        return this.spec
            .split('\n')
            .filter(line => line.trim() && !line.trim().startsWith('<!--'))
            .join('\n');
    }

    /** Update the spec */
    updateSpec(newSpec: string): void {
        this.spec = newSpec;
        this.persist();
        this.notify();
    }

    /** Reset to default template */
    resetSpec(): void {
        this.spec = DEFAULT_SPEC;
        this.persist();
        this.notify();
    }

    /** Check if spec has been customized beyond default */
    isCustomized(): boolean {
        return this.spec !== DEFAULT_SPEC;
    }

    /** Subscribe to changes */
    subscribe(listener: (spec: string) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private persist(): void {
        userScopeService.scopedSet(STORAGE_BASE, this.spec);
        // Also sync to VPS vault
        try {
            const host = window.location.hostname;
            const apiBase = (host === 'localhost' || host === '127.0.0.1')
                ? ((import.meta as any).env?.VITE_API_HOST || window.location.origin) + '/api'
                : `${window.location.protocol}//${host}:${window.location.port || '8080'}/api`;
            fetch(apiBase + '/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'master_spec', value: this.spec })
            }).catch(() => { /* offline fallback */ });
        } catch { /* offline fallback */ }
    }

    private notify(): void {
        this.listeners.forEach(l => l(this.spec));
    }
}

export const brainService = new BrainService();
