// src/app/api/topics/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Import options

const prisma = new PrismaClient();

// --- POST function (existing code, ensure authOptions import if needed) ---
export async function POST(request: Request) {
    // Use configured authOptions
    const session = await getServerSession(authOptions);

    if (!session || !session.user) { // Basic check, ID check might be redundant if session exists
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
}

// +++ GET function - remove unused 'request' parameter +++
export async function GET() { // Removed 'request: Request' parameter
    try {
        const topics = await prisma.topic.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(topics);
    } catch (error) {
        console.error('Error fetching topics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}