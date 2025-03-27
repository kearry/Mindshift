// src/app/api/rag/route.ts
import { NextResponse } from 'next/server';
import * as lancedb from '@lancedb/lancedb';

// Create a new API endpoint for RAG operations
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { queryText, topicId } = body;

        if (!queryText || !topicId) {
            return NextResponse.json({ error: 'Missing queryText or topicId' }, { status: 400 });
        }

        // This code only runs on the server
        const context = await retrieveRelevantContext(queryText, topicId);

        return NextResponse.json({ context });
    } catch (error) {
        console.error("RAG API error:", error);
        return NextResponse.json(
            { error: 'Failed to process RAG request', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

// Configuration
const vectorDbPath = process.env.VECTOR_DB_PATH || 'data/lancedb';
const vectorTableName = process.env.VECTOR_TABLE_NAME || 'mindshift_vectors';
const RAG_RETRIEVAL_COUNT = parseInt(process.env.RAG_RETRIEVAL_COUNT || '3', 10);

// Simple mock embedding function for now
// In production you would use a proper embedding model
async function generateEmbedding(text: string): Promise<number[]> {
    // Create a simple mock embedding (in real app, use a proper model)
    return Array(384).fill(0).map(() => Math.random() - 0.5);
}

// RAG Retrieval function
async function retrieveRelevantContext(queryText: string, topicId: number): Promise<string> {
    try {
        // Generate embedding for query (simplified for now)
        const queryVector = await generateEmbedding(queryText);
        console.log(`Generated mock embedding for query`);

        // Connect to vector DB
        const db = await lancedb.connect(vectorDbPath);
        const tableNames = await db.tableNames();

        if (!tableNames.includes(vectorTableName)) {
            console.log(`Vector table ${vectorTableName} not found`);
            return "[No context available yet - this appears to be the first debate on this topic]";
        }

        // Open table and perform search
        const table = await db.openTable(vectorTableName);
        const searchQuery = table.search(queryVector)
            .where(`topicId = ${topicId}`)
            .limit(RAG_RETRIEVAL_COUNT);

        // Collect search results
        const results: any[] = [];
        for await (const record of searchQuery) {
            results.push(record);
        }

        if (results.length > 0) {
            const context = "Relevant context from past arguments:\n" +
                results.map((record, index) => {
                    const text = typeof record.text === 'string' ? record.text : '';
                    return `[${index + 1}] ${text.substring(0, 300)}${text.length > 300 ? '...' : ''}`;
                }).join('\n\n');

            return context;
        } else {
            return "[No relevant context found for this topic]";
        }
    } catch (error) {
        console.error("RAG retrieval error:", error);
        return "[Error retrieving context]";
    }
}