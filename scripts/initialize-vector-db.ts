// scripts/initialize-vector-db.ts
// Run with: npx ts-node scripts/initialize-vector-db.ts
import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from '@xenova/transformers';

// Configuration
const vectorDbPath = process.env.VECTOR_DB_PATH || 'data/lancedb';
const vectorTableName = process.env.VECTOR_TABLE_NAME || 'mindshift_vectors';
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// Generate a proper embedding for the placeholder
async function generatePlaceholderEmbedding(): Promise<number[]> {
    try {
        console.log(`Loading embedding model: ${MODEL_NAME}`);
        const model = await pipeline('feature-extraction', MODEL_NAME, {
            quantized: false
        });

        const placeholderText = "This is a placeholder entry to initialize the vector database for the MindShift application.";
        console.log("Generating embedding for placeholder text");

        const result = await model(placeholderText, {
            pooling: 'mean',
            normalize: true
        });

        // Convert to regular array
        if (result && result.data) {
            // Use type checking to determine data format
            if (result.data instanceof Float32Array) {
                return Array.from(result.data);
            } else if (Array.isArray(result.data)) {
                return result.data.map(Number); // ensure numbers
            }
        }

        throw new Error("Model output doesn't contain expected data format");
    } catch (error) {
        console.error("Failed to generate embedding:", error);
        console.log("Falling back to zero vector");
        // Fallback to zero vector with correct dimensions for the model
        return new Array(384).fill(0);
    }
}

async function initializeVectorDb() {
    console.log('Initializing vector database...');

    // Create directory if it doesn't exist
    const dbDir = path.resolve(process.cwd(), vectorDbPath);
    if (!fs.existsSync(dbDir)) {
        console.log(`Creating database directory: ${dbDir}`);
        fs.mkdirSync(dbDir, { recursive: true });
    }

    try {
        // Connect to LanceDB
        const db = await lancedb.connect(vectorDbPath);

        // Check if table already exists
        const tableNames = await db.tableNames();

        if (tableNames.includes(vectorTableName)) {
            console.log(`Vector table '${vectorTableName}' already exists.`);
        } else {
            // Generate a proper embedding for the placeholder
            const placeholderVector = await generatePlaceholderEmbedding();
            console.log(`Generated embedding with ${placeholderVector.length} dimensions`);

            // Create a starter table with a placeholder vector
            const sampleData = [{
                vector: placeholderVector,
                text: 'Placeholder entry - initialization record',
                argumentId: 0,
                debateId: 0,
                topicId: 0,
                turnNumber: 0
            }];

            console.log(`Creating vector table '${vectorTableName}'...`);
            await db.createTable(vectorTableName, sampleData);
            console.log('Table created successfully with placeholder entry.');
        }

        console.log('Vector database is ready!');
    } catch (error) {
        console.error('Error initializing vector database:', error);
        process.exit(1);
    }
}

// Run the initialization function
initializeVectorDb().catch(console.error);
