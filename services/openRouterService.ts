/**
 * OpenRouter Service — Universal Model Gateway
 * Converts Gemini tool format → OpenAI function calling format
 * and routes chat completions through OpenRouter's API.
 */

import { FunctionDeclaration, Type } from '@google/genai';
import { billingService } from './billingService';
import { activityService } from './activityService';
import { userScopeService } from './userScopeService';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// --- Format Converters ---

/** Convert Gemini Type enum to JSON Schema type string */
function convertType(geminiType: any): string {
    switch (geminiType) {
        case Type.STRING: return 'string';
        case Type.NUMBER: return 'number';
        case Type.INTEGER: return 'integer';
        case Type.BOOLEAN: return 'boolean';
        case Type.ARRAY: return 'array';
        case Type.OBJECT: return 'object';
        default: return 'string';
    }
}

/** Convert a Gemini parameter schema → JSON Schema (recursive) */
function convertSchema(geminiSchema: any): any {
    if (!geminiSchema) return {};

    const schema: any = { type: convertType(geminiSchema.type) };

    if (geminiSchema.description) schema.description = geminiSchema.description;
    if (geminiSchema.enum) schema.enum = geminiSchema.enum;

    if (geminiSchema.properties) {
        schema.properties = {};
        for (const [key, val] of Object.entries(geminiSchema.properties)) {
            schema.properties[key] = convertSchema(val);
        }
    }

    if (geminiSchema.required) {
        schema.required = geminiSchema.required;
    }

    if (geminiSchema.items) {
        schema.items = convertSchema(geminiSchema.items);
    }

    return schema;
}

/** Convert Gemini FunctionDeclaration[] → OpenAI tools[] */
export function convertTools(geminiTools: FunctionDeclaration[]): any[] {
    return geminiTools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description || '',
            parameters: convertSchema(tool.parameters),
        }
    }));
}

/** Convert chat history from Gemini {role, content} → OpenAI messages */
function convertHistory(
    history: { role: string; content: string }[],
    systemInstruction: string
): any[] {
    const messages: any[] = [
        { role: 'system', content: systemInstruction }
    ];

    for (const msg of history) {
        messages.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
        });
    }

    return messages;
}

// --- Available Models ---

export interface OpenRouterModel {
    id: string;
    name: string;
    provider: string;
    contextWindow: number;
    supportsTools: boolean;
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
    { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Anthropic', contextWindow: 1000000, supportsTools: true },
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', contextWindow: 200000, supportsTools: true },
    { id: 'qwen/qwen3-coder-next', name: 'Qwen3 Coder Next', provider: 'Qwen', contextWindow: 262144, supportsTools: true },
];

// OpenAI models available with a direct OpenAI key
export const OPENAI_MODELS: OpenRouterModel[] = [
    { id: 'openai/gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', contextWindow: 1000000, supportsTools: true },
    { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro', provider: 'OpenAI', contextWindow: 1000000, supportsTools: true },
    { id: 'openai/gpt-5.2-codex', name: 'GPT-5.2 Codex', provider: 'OpenAI', contextWindow: 1000000, supportsTools: true },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', contextWindow: 1047576, supportsTools: true },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', contextWindow: 128000, supportsTools: true },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', contextWindow: 128000, supportsTools: true },
    { id: 'openai/o3-mini', name: 'o3-mini', provider: 'OpenAI', contextWindow: 200000, supportsTools: true },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', contextWindow: 1047576, supportsTools: true },
];

// --- Service ---

class OpenRouterService {
    private getApiKey(): string {
        return userScopeService.scopedGet('env_OPENROUTER_API_KEY') || '';
    }

    private getOpenAIKey(): string {
        return userScopeService.scopedGet('env_OPENAI_API_KEY') || '';
    }

    isAvailable(): boolean {
        return !!this.getApiKey();
    }

    isOpenAIAvailable(): boolean {
        return !!this.getOpenAIKey();
    }

    /** Check if a model should route through OpenAI directly */
    private shouldUseOpenAI(modelId: string): boolean {
        return modelId.startsWith('openai/') && this.isOpenAIAvailable();
    }

    /** Get the API URL and key for a given model */
    private getEndpoint(modelId: string): { url: string; key: string; cleanModelId: string } {
        if (this.shouldUseOpenAI(modelId)) {
            // Strip 'openai/' prefix for direct OpenAI API
            return { url: OPENAI_API_URL, key: this.getOpenAIKey(), cleanModelId: modelId.replace('openai/', '') };
        }
        return { url: OPENROUTER_API_URL, key: this.getApiKey(), cleanModelId: modelId };
    }

    private estimateTokens(text: string): number {
        return Math.ceil((text || '').length / 4);
    }

    /**
     * Send a chat message through OpenRouter.
     * Mirrors the GeminiService.sendMessage interface.
     */
    async sendMessage(
        history: { role: string; content: string }[],
        newMessage: string,
        systemInstruction: string,
        modelId: string,
        geminiTools: FunctionDeclaration[],
        file?: { name: string; type: string; data: string } | null
    ): Promise<{ text: string; functionCalls: any[] }> {
        const { url: apiUrl, key: apiKey, cleanModelId } = this.getEndpoint(modelId);
        if (!apiKey) {
            const provider = modelId.startsWith('openai/') ? 'OpenAI' : 'OpenRouter';
            return { text: `🔑 ${provider} API key not set. Add it in Vault → Secrets.`, functionCalls: [] };
        }

        const via = this.shouldUseOpenAI(modelId) ? 'OpenAI' : 'OpenRouter';
        activityService.log('THINKING', `Engaging via ${via} (${modelId.split('/').pop()})...`);

        try {
            const messages = convertHistory(history, systemInstruction);

            // Add the user's new message
            const userContent: any[] = [{ type: 'text', text: newMessage || 'Awaiting Directive' }];
            if (file) {
                userContent.push({
                    type: 'image_url',
                    image_url: { url: `data:${file.type};base64,${file.data}` }
                });
            }

            messages.push({
                role: 'user',
                content: userContent.length === 1 ? userContent[0].text : userContent
            });

            const tools = convertTools(geminiTools);

            const body: any = {
                model: cleanModelId,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
                max_tokens: 4096,
                temperature: 0.7,
            };

            const headers: any = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            };
            // OpenRouter-specific headers
            if (!this.shouldUseOpenAI(modelId)) {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'ClawKeep';
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData?.error?.message || response.statusText;

                // If 404 is about tool support, retry without tools
                if (response.status === 404 && errorMsg.toLowerCase().includes('tool')) {
                    activityService.log('THINKING', `${cleanModelId} doesn't support tools on ${via} — retrying without tools...`);
                    body.tools = undefined;
                    body.tool_choice = undefined;
                    const retryResponse = await fetch(apiUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body),
                    });
                    if (!retryResponse.ok) {
                        const retryError = await retryResponse.json().catch(() => ({}));
                        throw new Error(`${via} ${retryResponse.status}: ${retryError?.error?.message || retryResponse.statusText}`);
                    }
                    const retryData = await retryResponse.json();
                    const retryChoice = retryData.choices?.[0];
                    const retryText = retryChoice?.message?.content || '';
                    const inputTokens = retryData.usage?.prompt_tokens || this.estimateTokens(JSON.stringify(messages));
                    const outputTokens = retryData.usage?.completion_tokens || this.estimateTokens(retryText);
                    billingService.recordUsage(modelId, inputTokens, outputTokens);
                    return { text: retryText, functionCalls: [] };
                }

                throw new Error(`${via} ${response.status}: ${errorMsg}`);
            }

            const data = await response.json();
            const choice = data.choices?.[0];

            if (!choice) {
                throw new Error('No response from OpenRouter');
            }

            const responseMessage = choice.message;
            const text = responseMessage?.content || '';
            const toolCalls = responseMessage?.tool_calls || [];

            // Convert OpenAI tool_calls → Gemini functionCalls format
            const functionCalls = toolCalls.map((tc: any) => ({
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments || '{}')
            }));

            // Record billing
            const inputTokens = data.usage?.prompt_tokens || this.estimateTokens(JSON.stringify(messages));
            const outputTokens = data.usage?.completion_tokens || this.estimateTokens(text);
            billingService.recordUsage(modelId, inputTokens, outputTokens);

            return { text, functionCalls };

        } catch (error: any) {
            console.error(`[${via}] Error:`, error);
            return { text: `${via} Error: ${error.message}`, functionCalls: [] };
        }
    }

    /**
     * Lightweight call for agents — mirrors GeminiService.sendAgentMessage.
     */
    async sendAgentMessage(
        systemPrompt: string,
        message: string,
        geminiTools: FunctionDeclaration[],
        modelId?: string
    ): Promise<{ text: string; functionCalls: any[] }> {
        const model = modelId || 'openai/gpt-4o-mini';
        const { url: apiUrl, key: apiKey, cleanModelId } = this.getEndpoint(model);
        if (!apiKey) {
            return { text: '🔑 API key not set. Add an OpenAI or OpenRouter key in Vault → Secrets.', functionCalls: [] };
        }

        try {
            const tools = convertTools(geminiTools);
            const body: any = {
                model: cleanModelId,
                messages: [
                    { role: 'system', content: `${systemPrompt}\n\nCURRENT DATE AND TIME: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. CURRENT YEAR: ${new Date().getFullYear()}. Use this timestamp for ALL date references.` },
                    { role: 'user', content: message }
                ],
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
                max_tokens: 2048,
                temperature: 0.5,
            };

            const headers: any = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            };
            if (!this.shouldUseOpenAI(model)) {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'ClawKeep Agent';
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.error?.message || response.statusText);
            }

            const data = await response.json();
            const choice = data.choices?.[0];
            if (!choice) throw new Error('No response');

            const text = choice.message?.content || '';
            const toolCalls = choice.message?.tool_calls || [];
            const functionCalls = toolCalls.map((tc: any) => ({
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments || '{}')
            }));

            billingService.recordUsage(model, data.usage?.prompt_tokens || 0, data.usage?.completion_tokens || 0);

            return { text, functionCalls };
        } catch (error: any) {
            console.error('[OpenRouter Agent] Error:', error.message);
            return { text: `Agent error: ${error.message}`, functionCalls: [] };
        }
    }
}

export const openRouterService = new OpenRouterService();
