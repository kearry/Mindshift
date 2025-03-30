// src/lib/ragService.ts
// Safe for both client and server

// Type definition for embedding data
export interface EmbeddingData {
    savedUserArgument: {
        argumentId: number;
        turnNumber: number;
    };
    userArgumentText: string;
    aiResponseText: string;
    shiftReasoning: string;
    stanceBefore: number;
    stanceAfter: number;
    debateId: number;
    topicId: number;
}

// Dynamic imports that only execute on the server
export async function retrieveRelevantContext(queryText: string, topicId: number): Promise<string> {
    // Only import on the server
    if (typeof window === 'undefined') {
        // Server-side code
        const { retrieveRelevantContext } = await import('./server/ragUtils');
        return retrieveRelevantContext(queryText, topicId);
    }

    // Client-side code
    console.warn("Client-side RAG retrieval attempted - this should not happen");
    return "[Error: This function should not be called on the client. Use the API endpoint instead.]";
}

export async function generateAndSaveEmbedding(input: EmbeddingData): Promise<void> {
    // Only import on the server
    if (typeof window === 'undefined') {
        // Server-side code
        const { generateAndSaveEmbedding } = await import('./server/ragUtils');
        return generateAndSaveEmbedding(input);
    }

    // Client-side code
    console.warn("Client-side embedding generation attempted - this should not happen");
}