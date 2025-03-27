// scripts/initialize-vector-db.ts
// Run with: npx ts-node scripts/initialize-vector-db.ts
import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const vectorDbPath = process.env.VECTOR_DB_PATH || 'data/lancedb';
const vectorTableName = process.env.VECTOR_TABLE_NAME || 'mindshift_vectors';

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
            // Create a starter table with an empty vector
            // We need to provide a schema with the expected vector dimensions
            // Using 384 as dimension size for 'Xenova/all-MiniLM-L6-v2'
            const sampleData = [{
                vector: new Array(384).fill(0),
                text: 'Placeholder entry - initialization record',
                argumentId: 0,
                debateId: 0,
                topicId: 0,
                turnNumber: 0
            }];

            console.log(`Creating vector table '${vectorTableName}'...`);
            await db.createTable(vectorTableName, sampleData);
            console.log('Table created successfully.');
        }

        console.log('Vector database is ready!');
    } catch (error) {
        console.error('Error initializing vector database:', error);
        process.exit(1);
    }
}

// Run the initialization function
initializeVectorDb().catch(console.error);