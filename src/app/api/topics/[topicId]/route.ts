import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteParams {
    topicId: string;
}

interface RouteContext {
    params: Promise<RouteParams> | RouteParams; // Acknowledge it might be a Promise
}

export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        // Await context.params before accessing properties
        const params = await context.params;
        const topicIdString = params.topicId;
        const topicId = parseInt(topicIdString, 10);

        if (isNaN(topicId)) {
            console.error("Parsed topicId is NaN. Original param:", topicIdString);
            return NextResponse.json({ error: 'Invalid Topic ID format' }, { status: 400 });
        }

        const topic = await prisma.topic.findUnique({
            where: { topicId: topicId },
        });

        if (!topic) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        return NextResponse.json(topic);

    } catch (error) {
        // Log params safely in case of error during await or access
        let paramsForLogging = 'unknown';
        try {
            const resolvedParams = await context.params;
            paramsForLogging = JSON.stringify(resolvedParams);
        } catch { /* ignore logging error */ }
        console.error(`Error fetching topic (Params: ${paramsForLogging}):`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}