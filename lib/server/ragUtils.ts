'use server';

// This file contains server-only code
import * as lancedb from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';

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

// Configuration
const vectorDbPath = process.env.VECTOR_DB_PATH || 'data/lancedb';
const vectorTableName = process.env.VECTOR_TABLE_NAME || 'mindshift_vectors';
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'; // Small but effective embedding model

// Generate embeddings using Transformers.js
async function generateEmbedding(text: string): Promise<number[]> {
    try {
        console.log(`Generating embedding for text: "${text.slice(0, 50)}..."`);

        // Create a new pipeline for each request to avoid memory issues
        const model = await pipeline('feature-extraction', MODEL_NAME, {
            quantized: false
        });

        const output = await model(text, {
            pooling: 'mean',
            normalize: true
        });

        // Convert the embedding to a regular array
        if (output && output.data) {
            // Use type checking to determine data format
            if (output.data instanceof Float32Array) {
                return Array.from(output.data);
            } else if (Array.isArray(output.data)) {
                return output.data.map(Number); // ensure numbers
            }
        }

        throw new Error("Model output doesn't contain expected data format");
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw new Error("Failed to generate text embedding");
    }
}

// RAG Retrieval function
export async function retrieveRelevantContext(queryText: string, topicId: number): Promise<string> {
    try {
        // Generate embedding for query
        const queryVector = await generateEmbedding(queryText);
        console.log(`Generated embedding with ${queryVector.length} dimensions`);

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
            .limit(3);

        // Collect search results
        type SearchResult = {
            text?: string;
            _distance?: number;
            [key: string]: unknown;
        };

        const results: SearchResult[] = [];
        for await (const record of searchQuery) {
            results.push(record as unknown as SearchResult);
        }

        if (results.length > 0) {
            const context = "Relevant context from past arguments:\n" +
                results.map((record, index) => {
                    const recordText = typeof record.text === 'string' ? record.text : '';
                    const distance = record._distance !== undefined ?
                        ` (similarity: ${(1 - record._distance).toFixed(2)})` : '';
                    return `[${index + 1}]${distance} ${recordText.substring(0, 300)}${recordText.length > 300 ? '...' : ''}`;
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

// Save embeddings to the vector database
export async function generateAndSaveEmbedding(input: EmbeddingData): Promise<void> {
    const {
        savedUserArgument,
        userArgumentText,
        aiResponseText,
        shiftReasoning,
        debateId,
        topicId
    } = input;

    try {
        console.log(`Generating and saving embedding for argument ${savedUserArgument.argumentId}`);

        // Create the combined text to embed
        const textToEmbed = `User argument: ${userArgumentText}\nAI response: ${aiResponseText}\nReasoning: ${shiftReasoning}`;

        // Generate the embedding vector
        const vector = await generateEmbedding(textToEmbed);

        // Connect to the database
        const db = await lancedb.connect(vectorDbPath);

        // Check if table exists, create if not
        const tableNames = await db.tableNames();
        if (!tableNames.includes(vectorTableName)) {
            console.log(`Creating vector table '${vectorTableName}'...`);

            // Create a starter record with the current vector
            const initialData = [{
                vector: vector,
                text: textToEmbed,
                argumentId: savedUserArgument.argumentId,
                debateId: debateId,
                topicId: topicId,
                turnNumber: savedUserArgument.turnNumber
            }];

            await db.createTable(vectorTableName, initialData);
            console.log(`Vector table created with initial record`);
            return;
        }

        // Table exists, so add the new record
        const table = await db.openTable(vectorTableName);

        await table.add([{
            vector: vector,
            text: textToEmbed,
            argumentId: savedUserArgument.argumentId,
            debateId: debateId,
            topicId: topicId,
            turnNumber: savedUserArgument.turnNumber
        }]);

        console.log(`Successfully added vector for argument ${savedUserArgument.argumentId}`);
    } catch (error) {
        console.error("Error saving embedding:", error);
    }
}