// src/app/api/topics/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getAiInitialStance } from '@/lib/aiService';

const prisma = new PrismaClient();

// --- POST function (Saves scaleDefinitions if valid) ---
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, category } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
        }
        const topicName = name.trim();
        const topicDescription = (typeof description === 'string' && description.trim().length > 0) ? description.trim() : null;

        // --- Determine AI stance via selected LLM ---
        const { llmProvider, llmModel } = body;
        let aiResult;
        try {
            aiResult = await getAiInitialStance({
                topicName,
                topicDescription,
                llmProvider,
                llmModel
            });
        } catch (err) {
            console.error('Failed to determine AI initial stance:', err);
            return NextResponse.json({ error: 'Failed to determine initial stance' }, { status: 500 });
        }

        const initialStance = aiResult.stance;
        const stanceReasoning = aiResult.reasoning;
        const scaleDefs: Prisma.JsonValue | null = aiResult.scaleDefinitions as Prisma.JsonValue | null;

        // Create topic in database - this requires prisma generate to have been run
        const newTopic = await prisma.topic.create({
            data: {
                name: topicName,
                description: topicDescription,
                category: category || null,
                currentStance: initialStance,
                stanceReasoning: stanceReasoning,
                scaleDefinitions: scaleDefs // Save the extracted definitions
            },
        });

        return NextResponse.json(newTopic, { status: 201 });

    } catch (error: unknown) {
        console.error('Topic creation error:', error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json({ error: 'A topic with this name already exists.' }, { status: 409 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// --- GET function (List topics) ---
export async function GET() {
    try {
        const topics = await prisma.topic.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(topics);
    } catch (error: unknown) {
        console.error('Error fetching topics:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}