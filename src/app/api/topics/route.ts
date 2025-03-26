import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust if needed

const prisma = new PrismaClient();

// --- POST function (existing code) ---
export async function POST(request: Request) {
    // Check if user is authenticated
    // const session = await getServerSession(authOptions);
    const session = await getServerSession();

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, category } = body;

        if (!name) {
            return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
        }

        const initialStance = 5.0;
        const stanceReasoning = "Initial neutral stance.";

        const newTopic = await prisma.topic.create({
            data: {
                name,
                description: description || null,
                category: category || null,
                currentStance: initialStance,
                stanceReasoning: stanceReasoning,
            },
        });

        return NextResponse.json(newTopic, { status: 201 });

    } catch (error) {
        console.error('Topic creation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    // Note: Removed prisma.$disconnect() from finally block here
    // It's generally better to manage Prisma client instance lifecycle differently (e.g., singleton)
    // For simplicity now, let's omit it in POST and GET handlers
}


// +++ Add GET function to fetch topics +++
export async function GET(request: Request) {
    try {
        const topics = await prisma.topic.findMany({
            where: {
                isActive: true, // Optionally filter for active topics
            },
            orderBy: {
                createdAt: 'desc', // Order by newest first
            },
            // Select specific fields if needed to reduce payload size
            // select: { topicId: true, name: true, description: true, createdAt: true }
        });

        return NextResponse.json(topics);

    } catch (error) {
        console.error('Error fetching topics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    // Note: Prisma client disconnection management might be needed depending on deployment strategy
}