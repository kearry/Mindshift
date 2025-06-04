// src/app/api/topics/[topicId]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

// Define interfaces for route context and params
interface RouteParams { topicId: string; }
interface RouteContext { params: Promise<RouteParams> | RouteParams; }

// Define the specific structure for the GET response payload, including scaleDefinitions
type TopicGetResponse = Prisma.TopicGetPayload<{
    include: {
        debates: {
            orderBy: { createdAt: 'desc' },
            select: {
                debateId: true, status: true, createdAt: true, pointsEarned: true,
                user: { select: { userId: true, username: true, displayName: true } }
            }
        }
    }
}> & { scaleDefinitions?: Prisma.JsonValue | null }; // Explicitly add scaleDefinitions


// --- GET Handler (Fetches scaleDefinitions) ---
export async function GET(
    _request: Request, // Prefixed as unused
    context: RouteContext
) {
    try {
        const params = await context.params;
        const topicIdString = params.topicId;
        const topicId = parseInt(topicIdString, 10);

        if (isNaN(topicId)) {
            return NextResponse.json({ error: 'Invalid Topic ID format' }, { status: 400 });
        }

        const topic = await prisma.topic.findUnique({
            where: { topicId: topicId },
            include: { // Includes relations and automatically includes scalar fields like scaleDefinitions
                debates: {
                    orderBy: { createdAt: 'desc' },
                    select: {
                        debateId: true, status: true, createdAt: true, pointsEarned: true,
                        user: { select: { userId: true, username: true, displayName: true } }
                    }
                }
            }
        });

        if (!topic) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        return NextResponse.json(topic as TopicGetResponse);

    } catch (error: unknown) {
        let paramsForLogging = 'unknown';
        try { const resolvedParams = await context.params; paramsForLogging = JSON.stringify(resolvedParams); } catch { /* ignore */ }
        console.error(`Error fetching topic (Params: ${paramsForLogging}):`, error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}


// --- DELETE Handler (Unchanged) ---
export async function DELETE(
    _request: Request, // Prefixed as unused
    context: RouteContext
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let topicIdString: string | undefined;
    let topicId: number = 0;
    try {
        const params = await context.params;
        topicIdString = params.topicId;
        topicId = parseInt(topicIdString, 10);
        if (isNaN(topicId)) return NextResponse.json({ error: 'Invalid Topic ID format' }, { status: 400 });

        const topicWithDebateCount = await prisma.topic.findUnique({ where: { topicId: topicId }, select: { topicId: true, _count: { select: { debates: true } } } });
        if (!topicWithDebateCount) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const debateCount = topicWithDebateCount._count.debates;
        if (debateCount > 0) return NextResponse.json({ error: `Cannot delete topic: It has ${debateCount} associated debate(s).` }, { status: 400 });

        await prisma.topic.delete({ where: { topicId: topicId } });
        return NextResponse.json({ message: 'Topic deleted successfully' }, { status: 200 });

    } catch (error: unknown) {
        console.error(`Error deleting topic ${topicIdString ?? topicId ?? '[unknown ID]'}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) console.error(`Prisma Error Code during delete: ${error.code}`);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        if (message === 'Topic not found') return NextResponse.json({ error: message }, { status: 404 });
        return NextResponse.json({ error: 'Failed to delete topic', details: message }, { status: 500 });
    }
}