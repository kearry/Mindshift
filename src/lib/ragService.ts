// src/lib/ragService.ts
// This is a simplified version that only works on the server-side
// Client-side code will call the API endpoint instead

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

// Stub function for client-side imports - will be replaced by API calls
export async function retrieveRelevantContext(queryText: string, topicId: number): Promise<string> {
    // This function should never be called client-side
    // The API endpoint in src/app/api/rag/route.ts should be used instead
    console.warn("Client-side RAG retrieval attempted - this should not happen"+queryText+topicId);
    return "[Error: This function should not be called on the client. Use the API endpoint instead.]";
}

// Stub function for client-side imports - will be replaced by API calls
export async function generateAndSaveEmbedding(input: EmbeddingData): Promise<void> {
    // This function should never be called client-side
    // It's handled automatically by the debate API endpoint
    console.warn("Client-side embedding generation attempted - this should not happen"+input);
}