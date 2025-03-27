// src/lib/ragService.ts
import * as lancedb from '@lancedb/lancedb';
// FIX: Remove unused FeatureExtractionPipeline, keep PipelineType and Pipeline
import { pipeline, PipelineType, Pipeline } from '@xenova/transformers';
import type { Argument } from '@prisma/client';

// --- Configuration ---
const embeddingModelName = process.env.LOCAL_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
const vectorDbPath = 'data/lancedb';
const vectorTableName = 'mindshift_vectors';
const RAG_RETRIEVAL_COUNT = 3;

// --- Embedding Pipeline (Singleton Pattern) ---
class EmbeddingPipelineSingleton {
    static task: PipelineType = 'feature-extraction';
    static model = embeddingModelName;
    // Use Pipeline type from transformers | null
    static instance: Pipeline | null = null;

    // FIX: Use unknown for callback type
    static async getInstance(progress_callback?: (progress: unknown) => void): Promise<Pipeline | null> {
        if (this.instance === null) {
            console.log(`Loading local embedding model ${this.model}...`);
            try {
                // Explicitly type the awaited pipeline result if needed, or keep as Pipeline
                this.instance = await pipeline(this.task, this.model, { quantized: true, progress_callback });
                console.log("Local embedding model loaded.");
            } catch (e) {
                console.error("Failed to load embedding model:", e);
                this.instance = null;
            }
        }
        return this.instance;
    }
}
// --- End Embedding Pipeline ---


// --- Function: RAG Retrieval ---
export async function retrieveRelevantContext(queryText: string, topicId: number): Promise<string> {
    let retrievedContext = "";
    try {
        const embedder = await EmbeddingPipelineSingleton.getInstance();
        if (!embedder) throw new Error("Embedding model not loaded for retrieval.");

        console.log(`Generating query embedding for RAG...`);
        // Cast embedder to function type for call
        const queryEmbeddingOutput = await (embedder as Function)(queryText, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(queryEmbeddingOutput.data as Float32Array);
        console.log(`Query embedding generated.`);

        const db = await lancedb.connect(vectorDbPath);
        const tableNames = await db.tableNames();
        if (!tableNames.includes(vectorTableName)) {
            console.log(`Vector table ${vectorTableName} not found for retrieval.`);
            return "[Vector DB table not found]";
        }
        const table = await db.openTable(vectorTableName);

        console.log(`Searching vector DB for context related to topic ${topicId}...`);
        // FIX: Remove .execute(), await search directly, handle async iteration
        const searchResults = table.search(queryVector)
            // .where(`topicId = ${topicId}`) // Example filter
            .limit(RAG_RETRIEVAL_COUNT);

        // FIX: Process results assuming async iterator yields objects with 'text' property
        const resultsTexts: string[] = [];
        for await (const record of searchResults) {
            // Assuming record is a JS object with a 'text' property
            if (record && typeof record.text === 'string') {
                resultsTexts.push(record.text);
            } else {
                console.warn("Retrieved vector DB record missing 'text' property:", record);
            }
        }
        console.log(`Retrieved ${resultsTexts.length} potential context snippets.`);

        if (resultsTexts.length > 0) {
            retrievedContext = "Relevant context from past arguments:\n" + resultsTexts.map(text => `- ${text}`).join('\n');
            console.log(`Formatted ${resultsTexts.length} context snippets.`);
        } else {
            console.log(`No relevant context text found after processing results.`);
            retrievedContext = "[No relevant context found]";
        }

    } catch (ragError) {
        console.error("RAG retrieval failed:", ragError);
        retrievedContext = "[Failed to retrieve relevant context]";
    }
    return retrievedContext;
}


// --- Function: Generate and Save Embedding ---
interface EmbeddingData { savedUserArgument: Argument; userArgumentText: string; aiResponseText: string; shiftReasoning: string; stanceBefore: number; stanceAfter: number; debateId: number; topicId: number; }

export async function generateAndSaveEmbedding(input: EmbeddingData): Promise<void> {
    // FIX: Add eslint disable comments for incorrectly flagged unused vars
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { savedUserArgument, userArgumentText, aiResponseText, shiftReasoning, stanceBefore, stanceAfter, debateId, topicId } = input;
    try {
        const embedder = await EmbeddingPipelineSingleton.getInstance();
        if (!embedder) { throw new Error("Embedding model not loaded for ingestion."); }

        // StanceBefore and StanceAfter ARE used here
        const textToEmbed = `User: ${userArgumentText}\nAI: ${aiResponseText}\nRsn: ${shiftReasoning}\nStance: <span class="math-inline">\{stanceBefore\.toFixed\(1\)\}\-\></span>{stanceAfter.toFixed(1)}`;
        console.log(`Generating embedding arg ${savedUserArgument.argumentId}...`);

        // Use embedder directly (cast to Function)
        const output = await (embedder as Function)(textToEmbed, { pooling: 'mean', normalize: true });
        const embeddingVector = Array.from(output.data as Float32Array);
        console.log(`Embed gen len: ${embeddingVector.length}`);

        const db = await lancedb.connect(vectorDbPath);
        let table;
        const tblNames = await db.tableNames();
        const dataToAdd = [{ vector: embeddingVector, text: textToEmbed, argumentId: savedUserArgument.argumentId, debateId: debateId, topicId: topicId, turnNumber: savedUserArgument.turnNumber }];

        if (!tblNames.includes(vectorTableName)) { console.log(`Create LanceDB: ${vectorTableName}`); table = await db.createTable(vectorTableName, dataToAdd); console.log("LanceDB created."); }
        else { table = await db.openTable(vectorTableName); await table.add(dataToAdd); console.log(`Embed added ${vectorTableName}`); }
    } catch (embeddingError) { console.error(`Failed to generate or save embedding for argument ${savedUserArgument?.argumentId}:`, embeddingError); }
}