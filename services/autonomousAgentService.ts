/*
 * Autonomous Agent Service
 * Gives Claw's agent squad the ability to run independent background
 * Gemini sessions on schedules, execute missions, and report findings.
 *
 * v2: Agents now have safe tools (createTask, semanticSearch, clawMemory, clawCommit),
 *     multi-turn execution loops, and progress tracking.
 */

import { geminiService } from './geminiService';
import { api } from './apiService';
import { guardrailService } from './guardrailService';
import { Type, FunctionDeclaration } from '@google/genai';

interface AgentMission {
    agentId: string;
    name: string;
    mascot: string;
    quest: string;
    specialty: string;
    schedule: string;       // 'CONTINUOUS' | 'HOURLY' | 'DAILY' | 'MANUAL'
    intervalMs: number;
    lastRun: number;
    isRunning: boolean;
    // v2: Progress tracking
    progress: number;                 // 0-100 completion percentage
    estimatedCompletion: string | null; // "~30 min"
    lastReport: string;               // Most recent report summary
}

interface AgentLog {
    id: string;
    agentId: string;
    type: 'REPORT' | 'ALERT' | 'ERROR';
    content: string;
    createdAt: string;
}

// --- Safe Agent Tool Declarations ---
// These are the ONLY tools agents can use. No email, no browser, no destructive ops.

const agentCreateTaskTool: FunctionDeclaration = {
    name: 'createTask',
    description: 'Create a task for the operator based on your analysis. Use when you find something that needs action.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'Task title' },
            description: { type: Type.STRING, description: 'Task details' },
            priority: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'], description: 'Priority level' },
            dueDate: { type: Type.STRING, description: 'Due date in ISO format (optional)' }
        },
        required: ['title', 'description'],
    },
};

const agentSemanticSearchTool: FunctionDeclaration = {
    name: 'semanticSearch',
    description: 'Search the Company Vault for documents related to a query. Use to review specific docs for your quest.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: { type: Type.STRING, description: 'Search query (e.g. "insurance expiration", "fleet maintenance")' }
        },
        required: ['query'],
    },
};

const agentMemoryTool: FunctionDeclaration = {
    name: 'clawMemory',
    description: 'Save or recall findings. Use REMEMBER to store an important finding. Use RECALL to check past knowledge.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING, enum: ['REMEMBER', 'RECALL'], description: 'REMEMBER to store, RECALL to search' },
            fact: { type: Type.STRING, description: 'The fact to remember or query to recall' },
            category: { type: Type.STRING, enum: ['GENERAL', 'FINANCE', 'LEGAL', 'OPERATIONS', 'PEOPLE', 'POLICY', 'SCHEDULE'], description: 'Category' }
        },
        required: ['action', 'fact'],
    },
};

const agentCommitTool: FunctionDeclaration = {
    name: 'clawCommit',
    description: 'Log your progress. Use COMMIT to note what you are working on. Use UPDATE to mark progress.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING, enum: ['COMMIT', 'UPDATE'], description: 'COMMIT a finding, UPDATE progress' },
            promise: { type: Type.STRING, description: 'What you found or are working on (for COMMIT)' },
            eta: { type: Type.STRING, description: 'Estimated time remaining (for COMMIT)' },
            commitmentId: { type: Type.STRING, description: 'ID to update (for UPDATE)' },
            status: { type: Type.STRING, enum: ['IN_PROGRESS', 'FAILED'], description: 'Status (for UPDATE)' }
        },
        required: ['action'],
    },
};

const AGENT_TOOLS: FunctionDeclaration[] = [
    agentCreateTaskTool,
    agentSemanticSearchTool,
    agentMemoryTool,
    agentCommitTool,
];

// Safe tool names that agents are allowed to execute
const SAFE_TOOL_NAMES = new Set(['createTask', 'semanticSearch', 'clawMemory', 'clawCommit']);

const MAX_TOOL_ROUNDS = 5;

class AutonomousAgentService {
    private missions: Map<string, AgentMission> = new Map();
    private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
    private logs: AgentLog[] = [];
    private contextProvider: (() => string) | null = null;
    private onReport: ((agentName: string, mascot: string, report: string, isAlert: boolean) => void) | null = null;
    private toolHandler: ((action: { name: string; args: any }) => Promise<string | void>) | null = null;

    init(
        contextProvider: () => string,
        onReport: (agentName: string, mascot: string, report: string, isAlert: boolean) => void,
        toolHandler?: (action: { name: string; args: any }) => Promise<string | void>
    ) {
        this.contextProvider = contextProvider;
        this.onReport = onReport;
        this.toolHandler = toolHandler || null;
        console.log('[AgentService] Autonomous agent service initialized (v2 — with tools)');
    }

    // --- Deploy an agent on a mission ---
    deployAgent(
        agentId: string,
        name: string,
        mascot: string,
        quest: string,
        specialty: string,
        schedule: 'CONTINUOUS' | 'HOURLY' | 'DAILY' | 'MANUAL' = 'DAILY'
    ): string {
        const intervalMap = {
            CONTINUOUS: 15 * 60 * 1000,  // 15 min
            HOURLY: 60 * 60 * 1000,
            DAILY: 24 * 60 * 60 * 1000,
            MANUAL: 0
        };

        const mission: AgentMission = {
            agentId,
            name,
            mascot,
            quest,
            specialty,
            schedule,
            intervalMs: intervalMap[schedule],
            lastRun: 0,
            isRunning: false,
            progress: 0,
            estimatedCompletion: null,
            lastReport: ''
        };

        this.missions.set(agentId, mission);

        // Start the schedule if not MANUAL
        if (schedule !== 'MANUAL' && mission.intervalMs > 0) {
            // Run the first check after a short delay
            setTimeout(() => this.runMission(agentId), 5000);

            const timer = setInterval(() => this.runMission(agentId), mission.intervalMs);
            this.timers.set(agentId, timer);
        }

        return `${mascot} ${name} deployed on ${schedule} schedule. Quest: "${quest}"`;
    }

    // --- Run an agent's mission (v2: multi-turn with tools) ---
    async runMission(agentId: string): Promise<string> {
        // Guardrail: defer missions during sleep mode
        if (!guardrailService.isAwake()) {
            console.log(`[AgentService] 💤 Sleep mode active — mission for ${agentId} deferred.`);
            return '💤 Sleep mode active — mission deferred until awake hours.';
        }

        const mission = this.missions.get(agentId);
        if (!mission) return 'Agent not deployed.';
        if (mission.isRunning) return 'Agent already running a mission.';

        mission.isRunning = true;
        const context = this.contextProvider?.() || '';

        const systemPrompt = `You are ${mission.mascot} ${mission.name}, an autonomous agent working for Claw.
Your specialty is: ${mission.specialty}
Your current quest/mission is: "${mission.quest}"

You have access to these tools:
- createTask: Create action items for the operator when you find something that needs doing
- semanticSearch: Search the Company Vault for relevant documents
- clawMemory: Remember important findings (REMEMBER) or check past knowledge (RECALL)
- clawCommit: Log your progress (COMMIT) or update status (UPDATE)

WORKFLOW:
1. Use semanticSearch to find relevant documents for your quest
2. Analyze what you find against the business context
3. Use createTask for any action items you discover
4. Use clawMemory REMEMBER to store key findings
5. Write your final field report

VERIFICATION RULES:
- If you only analyzed but changed nothing, say "ANALYSIS ONLY — no changes made."
- If you created tasks or stored memories, list each one.
- Do NOT claim you did something unless you used a tool.

PROGRESS FORMAT (include this on the LAST line of your report):
PROGRESS: <0-100>% | ETA: <estimate or "ongoing">

Business Context:
${context}`;

        const taskPrompt = `Execute your quest: "${mission.quest}"

Focus on your specialty (${mission.specialty}). Be specific, actionable, and flag urgent items with ⚠️.
Keep your final report under 200 words. Start with "${mission.mascot} FIELD REPORT:"`;

        try {
            let finalReport = '';
            let round = 0;

            // Initial call with tools
            let response = await geminiService.sendAgentMessage(systemPrompt, taskPrompt, AGENT_TOOLS);

            while (round < MAX_TOOL_ROUNDS) {
                round++;

                // If no function calls, we're done
                if (!response.functionCalls || response.functionCalls.length === 0) {
                    finalReport = response.text || 'No findings to report.';
                    break;
                }

                // Process function calls
                const toolResults: string[] = [];
                for (const call of response.functionCalls) {
                    if (!SAFE_TOOL_NAMES.has(call.name)) {
                        toolResults.push(`[BLOCKED] Tool "${call.name}" is not available to agents.`);
                        continue;
                    }

                    if (this.toolHandler) {
                        try {
                            const result = await this.toolHandler({ name: call.name, args: call.args });
                            toolResults.push(`[${call.name}] ${result}`);
                        } catch (e: any) {
                            toolResults.push(`[${call.name}] Error: ${e.message}`);
                        }
                    } else {
                        toolResults.push(`[${call.name}] Tool handler not available.`);
                    }
                }

                // Feed results back and continue
                const toolResultsText = `Tool results:\n${toolResults.join('\n')}\n\nContinue your quest. If you have enough information, produce your final field report. Remember to include PROGRESS on the last line.`;
                response = await geminiService.sendAgentMessage(systemPrompt, toolResultsText, AGENT_TOOLS);
            }

            // If we exhausted rounds, take whatever we have
            if (!finalReport) {
                finalReport = response.text || 'Agent reached max tool rounds without final report.';
            }

            // Parse progress from report
            this.parseProgress(mission, finalReport);

            const isAlert = finalReport.includes('⚠️') || finalReport.toLowerCase().includes('urgent');
            mission.lastReport = finalReport.substring(0, 200);

            const log: AgentLog = {
                id: `alog_${Date.now()}`,
                agentId,
                type: isAlert ? 'ALERT' : 'REPORT',
                content: finalReport,
                createdAt: new Date().toISOString()
            };

            this.logs.unshift(log);
            mission.lastRun = Date.now();
            mission.isRunning = false;

            // Save log to API
            try {
                await fetch(`${this.getApiBase()}/agent_logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(log)
                });
            } catch { /* offline fallback */ }

            // Notify through callback
            this.onReport?.(mission.name, mission.mascot, finalReport, isAlert);

            return finalReport;
        } catch (err: any) {
            mission.isRunning = false;
            const errorLog: AgentLog = {
                id: `alog_${Date.now()}`,
                agentId,
                type: 'ERROR',
                content: `Mission failed: ${err.message}`,
                createdAt: new Date().toISOString()
            };
            this.logs.unshift(errorLog);
            return `Mission error: ${err.message}`;
        }
    }

    // --- Parse PROGRESS line from agent report ---
    private parseProgress(mission: AgentMission, report: string): void {
        const match = report.match(/PROGRESS:\s*(\d+)%\s*\|\s*ETA:\s*(.+)/i);
        if (match) {
            mission.progress = Math.min(parseInt(match[1], 10), 100);
            mission.estimatedCompletion = match[2].trim();
        }
    }

    // --- Stand down an agent ---
    standDown(agentId: string): string {
        const timer = this.timers.get(agentId);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(agentId);
        }
        this.missions.delete(agentId);
        return 'Agent stood down.';
    }

    // --- Get agent's field reports ---
    getAgentLogs(agentId: string, limit: number = 10): AgentLog[] {
        return this.logs
            .filter(l => l.agentId === agentId)
            .slice(0, limit);
    }

    // --- Get all agent logs ---
    getAllLogs(limit: number = 20): AgentLog[] {
        return this.logs.slice(0, limit);
    }

    // --- Get deployed missions ---
    getDeployedMissions(): AgentMission[] {
        return Array.from(this.missions.values());
    }

    // --- Get mission status for a specific agent ---
    getMissionStatus(agentId: string): AgentMission | null {
        return this.missions.get(agentId) || null;
    }

    private getApiBase(): string {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return (import.meta.env.VITE_API_HOST || window.location.origin) + '/api';
        }
        return `${window.location.protocol}//${host}:${window.location.port || '8080'}/api`;
    }

    // --- Cleanup ---
    destroy() {
        for (const timer of this.timers.values()) {
            clearInterval(timer);
        }
        this.timers.clear();
        this.missions.clear();
    }
}

export const autonomousAgentService = new AutonomousAgentService();
