// src/lib/ragService.ts
import * as lancedb from '@lancedb/lancedb';
import type { Argument } from '@prisma/client';

// --- Configuration ---
const embeddingModelName = process.env.LOCAL_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
const vectorDbPath = process.env.VECTOR_DB_PATH || 'data/lancedb';
const vectorTableName = process.env.VECTOR_TABLE_NAME || 'mindshift_vectors';
const RAG_RETRIEVAL_COUNT = parseInt(process.env.RAG_RETRIEVAL_COUNT || '3', 10);

// Define essential types for transformer outputs
interface TransformerOutput {
    data: Float32Array | number[];
}

// Define a pipeline function type
type PipelineFunction = (text: string, options: Record<string, unknown>) => Promise<TransformerOutput>;

// Local embedder instance
let embedder: PipelineFunction | null = null;

// --- Function to initialize embedding model ---
async function initializeEmbedder(): Promise<boolean> {
    if (embedder) return true;

    try {
        console.log(`Loading local embedding model ${embeddingModelName}...`);

        // Dynamic import
        const transformersModule = await import('@xenova/transformers');

        // Check if pipeline exists - using type assertion
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!transformersModule.pipeline) {
            console.error("pipeline function not found in @xenova/transformers");
            return false;
        }

        // Create pipeline with type assertion
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const pipeline = await transformersModule.pipeline('feature-extraction', embeddingModelName, {
            quantized: true
        });

        // Assign to embedder with type cast
        embedder = ((text: string, options: Record<string, unknown>) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            return pipeline(text, options);
        }) as PipelineFunction;

        console.log("Local embedding model loaded successfully.");
        return true;
    } catch (error) {
        console.error("Failed to load embedding model:", error);
        return false;
    }
}

// Type for LanceDB record with necessary properties
interface SearchResult {
    text?: string;
    _distance?: number;
    [key: string]: unknown;
}

// --- Function: RAG Retrieval ---
export async function retrieveRelevantContext(queryText: string, topicId: number): Promise<string> {
    let retrievedContext = "";

    try {
        // Initialize embedder if needed
        if (!await initializeEmbedder()) {
            return "[Unable to initialize embedding model - check console for errors]";
        }

        console.log(`Generating query embedding for RAG...`);
        // Generate embedding for query - using non-null assertion since we checked initialization
        const queryEmbeddingOutput = await embedder!(queryText, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(queryEmbeddingOutput.data);
        console.log(`Query embedding generated with length: ${queryVector.length}.`);

        // Connect to vector DB
        const db = await lancedb.connect(vectorDbPath);
        const tableNames = await db.tableNames();

        if (!tableNames.includes(vectorTableName)) {
            console.log(`Vector table ${vectorTableName} not found. No context available yet.`);
            return "[No context available yet - this appears to be the first debate on this topic]";
        }

        // Open table and perform search
        const table = await db.openTable(vectorTableName);

        console.log(`Searching vector DB for context related to topic ${topicId}...`);
        // Filter by topicId when searching to get relevant context
        // Using type assertion for vector since LanceDB's typings don't match well with TypeScript
        const searchQuery = table.search(queryVector as unknown as number[])
            .where(`topicId = ${topicId}`)
            .limit(RAG_RETRIEVAL_COUNT);

        // Collect search results
        const results: SearchResult[] = [];
        for await (const record of searchQuery) {
            // Cast record to our search result type
            results.push(record as unknown as SearchResult);
        }

        console.log(`Retrieved ${results.length} context snippets from vector DB.`);

        if (results.length > 0) {
            // Sort results by semantic relevance
            results.sort((a, b) => {
                // Safely access _distance property
                const distanceA = typeof a._distance === 'number' ? a._distance : 1;
                const distanceB = typeof b._distance === 'number' ? b._distance : 1;
                return distanceA - distanceB;
            });

            // Format context from results
            retrievedContext = "Relevant context from past arguments:\n" +
                results.map((record, index) => {
                    // Safely access text property
                    const text = typeof record.text === 'string' ? record.text : '';
                    return `[${index + 1}] ${text.substring(0, 300)}${text.length > 300 ? '...' : ''}`;
                }).join('\n\n');

            console.log(`Formatted ${results.length} context snippets for AI response.`);
        } else {
            retrievedContext = "[No relevant context found for this topic]";
        }
    } catch (ragError) {
        console.error("RAG retrieval failed:", ragError);
        retrievedContext = "[Error retrieving context: " + (ragError instanceof Error ? ragError.message : "unknown error") + "]";
    }

    return retrievedContext;
}

// --- Function: Generate and Save Embedding ---
export interface EmbeddingData {
    savedUserArgument: Argument;
    userArgumentText: string;
    aiResponseText: string;
    shiftReasoning: string;
    stanceBefore: number;
    stanceAfter: number;
    debateId: number;
    topicId: number;
}

export async function generateAndSaveEmbedding(input: EmbeddingData): Promise<void> {
    const { savedUserArgument, userArgumentText, aiResponseText, shiftReasoning, stanceBefore, stanceAfter, debateId, topicId } = input;

    try {
        // Initialize embedder if needed
        if (!await initializeEmbedder()) {
            console.error("Embedding generation aborted: model initialization failed");
            return;
        }

        // Create text to embed - include all relevant context
        const textToEmbed = `User Argument: ${userArgumentText}\nAI Response: ${aiResponseText}\nReasoning: ${shiftReasoning}\nStance Change: ${stanceBefore.toFixed(1)} → ${stanceAfter.toFixed(1)}`;
        console.log(`Generating embedding for argument ID ${savedUserArgument.argumentId}...`);

        // Generate embedding - using non-null assertion since we checked initialization
        const output = await embedder!(textToEmbed, { pooling: 'mean', normalize: true });
        const embeddingVector = Array.from(output.data);
        console.log(`Embedding generated with length: ${embeddingVector.length}`);

        // Prepare data for insertion
        const dataToAdd = [{
            vector: embeddingVector as unknown as number[],
            text: textToEmbed,
            argumentId: savedUserArgument.argumentId,
            debateId: debateId,
            topicId: topicId,
            turnNumber: savedUserArgument.turnNumber
        }];

        // Connect to DB and add vector
        const db = await lancedb.connect(vectorDbPath);
        const tableNames = await db.tableNames();

        // Create table if it doesn't exist, otherwise add to existing table
        if (!tableNames.includes(vectorTableName)) {
            console.log(`Creating new LanceDB table: ${vectorTableName}`);
            await db.createTable(vectorTableName, dataToAdd);
            console.log("Vector table created successfully.");
        } else {
            const table = await db.openTable(vectorTableName);
            await table.add(dataToAdd);
            console.log(`Added embedding to existing table ${vectorTableName}`);
        }
    } catch (embeddingError) {
        console.error(`Failed to generate or save embedding for argument ${savedUserArgument?.argumentId}:`, embeddingError);
    }
}