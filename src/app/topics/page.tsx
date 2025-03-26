import { PrismaClient } from '@prisma/client';
import Link from 'next/link'; // Import Link

// Note: Instantiating PrismaClient directly in components is okay for quick development,
// but for better practice/production, consider a singleton pattern for the Prisma instance.
// See: https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
const prisma = new PrismaClient();

// This is a Server Component, so we can fetch data directly
async function getTopics() {
    try {
        const topics = await prisma.topic.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return topics;
    } catch (error) {
        console.error("Failed to fetch topics:", error);
        return []; // Return empty array on error
    } finally {
        // Disconnecting might be necessary depending on deployment environment
        // await prisma.$disconnect(); // Consider lifecycle management carefully
    }
}

export default async function TopicsPage() {
    const topics = await getTopics();

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Topics</h1>
                <Link
                    href="/topics/create"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                >
                    Create New Topic
                </Link>
            </div>

            {topics.length === 0 ? (
                <p>No topics found. Create one!</p>
            ) : (
                <ul className="space-y-4">
                    {/* Updated map function with Link */}
                    {topics.map((topic) => (
                        <li key={topic.topicId} className="p-4 border rounded shadow-sm hover:shadow-md transition-shadow">
                            <Link href={`/topics/${topic.topicId}`} className="block"> {/* Wrap content in Link */}
                                <h2 className="text-lg font-semibold mb-1">{topic.name}</h2>
                                {topic.description && (
                                    <p className="text-sm text-gray-600 mb-2">{topic.description}</p>
                                )}
                                <p className="text-xs text-gray-500">
                                    Initial Stance: {topic.currentStance}/10 | Created: {new Date(topic.createdAt).toLocaleDateString()}
                                </p>
                            </Link> {/* Close Link */}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Optional: Add revalidation if needed
// export const revalidate = 60; // Revalidate data every 60 seconds