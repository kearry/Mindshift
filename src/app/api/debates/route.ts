// src/app/api/debates/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions"; // Import configured options


export async function POST(request: Request) {
    // Use configured authOptions
    const session = await getServerSession(authOptions);

    // Access ID safely using optional chaining and type augmentation
    const userIdString = session?.user?.id;
    const userId = userIdString ? parseInt(userIdString, 10) : null;

    // Validate session and parsed userId
    if (!session || !userId || isNaN(userId)) {
        return NextResponse.json({ error: 'Unauthorized - User not logged in or user ID invalid' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { topicId, goalDirection, llmProvider, llmModel } = body;

        const parsedTopicId = parseInt(topicId, 10);

        if (!parsedTopicId || isNaN(parsedTopicId) || !goalDirection || (goalDirection !== 'left' && goalDirection !== 'right')) {
            return NextResponse.json({ error: 'Missing or invalid topicId or goalDirection' }, { status: 400 });
        }

        const topic = await prisma.topic.findUnique({
            where: { topicId: parsedTopicId },
        });

        if (!topic) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        const newDebate = await prisma.debate.create({
            data: {
                topicId: topic.topicId,
                userId: userId, // Use validated userId
                initialStance: topic.currentStance,
                goalDirection: goalDirection,
                status: 'active',
                llmProvider: llmProvider ?? 'openai',
                llmModel: llmModel ?? process.env.OPENAI_MODEL_NAME ?? 'gpt-4o-mini',
            },
        });

        return NextResponse.json(newDebate, { status: 201 });

    } catch (error: unknown) { // Use unknown instead of any
        console.error('Debate creation error:', error);
        // Check if error is an instance of Error to access message safely
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}