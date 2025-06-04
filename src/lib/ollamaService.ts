// src/lib/ollamaService.ts - Fixed for robust non-JSON responses
// Service for connecting to Ollama LLM

// Types for Ollama responses
export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

export interface OllamaRequestOptions {
    model: string;
    prompt: string;
    context?: number[];
    system?: string;
    template?: string;
    options?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
        num_predict?: number;
        stop?: string[];
        frequency_penalty?: number;
        presence_penalty?: number;
        mirostat?: number;
        mirostat_tau?: number;
        mirostat_eta?: number;
        num_ctx?: number;
        repeat_penalty?: number;
        num_gpu?: number;
        num_thread?: number;
        seed?: number;
    };
    stream?: boolean;
}

export interface OllamaModelTag {
    name: string;
}

// Default Ollama endpoint (can be configured in environment variables)
const OLLAMA_API_BASE = process.env.NEXT_PUBLIC_OLLAMA_API_BASE || 'http://localhost:11434';

/**
 * Extract the first JSON object contained in the given text.
 * Useful for Ollama responses that may contain markup like "<think>" before
 * the actual JSON payload.
 *
 * @param text Raw text that may contain a JSON object
 * @returns The JSON object string if found, otherwise null
 */
export function extractJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
        const char = text[i];
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                return text.slice(start, i + 1);
            }
        }
    }
    return null;
}

/**
 * Most simple direct generation - get raw text from Ollama
 * @param model Model name
 * @param prompt User prompt
 * @param systemPrompt Optional system prompt
 * @returns Raw text response
 */
export async function getOllamaRawResponse(
    model: string,
    prompt: string,
    systemPrompt?: string
): Promise<string> {
    const endpoint = `${OLLAMA_API_BASE}/api/generate`;

    try {
        console.log(`Calling Ollama model ${model} for raw text...`);

        const requestBody: OllamaRequestOptions = {
            model: model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
            }
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        // Get the response as text first
        const responseText = await response.text();

        try {
            // Try to parse as JSON (Ollama API returns JSON)
            const data = JSON.parse(responseText);
            return data.response || responseText;
        } catch (parseError) {
            // Note: Removed incorrect line referencing data.models
            // If JSON parsing fails, return the raw text
            return responseText;
        }
    } catch (error) {
        console.error('Ollama raw generation failed:', error);
        throw error;
    }
}

/**
 * List available models from Ollama
 * @returns Promise with array of available model names
 */
export async function listOllamaModels(): Promise<string[]> {
    const endpoint = `${OLLAMA_API_BASE}/api/tags`;

    try {
        const response = await fetch(endpoint);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        const responseText = await response.text();

        try {
            const data = JSON.parse(responseText) as { models?: OllamaModelTag[] };
            // Extract model names from response
            return data.models?.map((model: OllamaModelTag) => model.name) || [];
        } catch (parseError) {
            console.error('Failed to parse Ollama models response as JSON:', parseError);
            return [];
        }
    } catch (error) {
        console.error('Failed to list Ollama models:', error);
        return [];
    }
}