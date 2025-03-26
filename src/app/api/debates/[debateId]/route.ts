import { NextResponse } from 'next/server';
// Removed unused 'Prisma' type import
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
// Removed '.ts' extension from import path
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

interface RouteParams {
    debateId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

// --- GET Handler (from previous steps) ---
export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const params = await context.params;
        const debateIdString = params.debateId;
        const debateId = parseInt(debateIdString, 10);

        if (isNaN(debateId)) {
            return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });
        }

        const debate = await prisma.debate.findUnique({
            where: { debateId: debateId },
            include: {
                topic: true,
                user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } },
                arguments: {
                    orderBy: { turnNumber: 'asc' },
                    include: { user: { select: { userId: true, username: true, displayName: true } } }
                },
            },
        });

        if (!debate) {
            return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }
        return NextResponse.json(debate);

    } catch (error) {
        let paramsForLogging = 'unknown';
        try { const resolvedParams = await context.params; paramsForLogging = JSON.stringify(resolvedParams); } catch { /* ignore */ }
        console.error(`Error fetching debate (Params: ${paramsForLogging}):`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}

// --- POST Handler (from previous step) ---
export async function POST(
    request: Request,
    context: RouteContext
) {
    const session = await getServerSession(authOptions);
    const userIdString = session?.user?.id;
    const userId = userIdString ? parseInt(userIdString, 10) : null;

    if (!session || !userId || isNaN(userId)) {
        return NextResponse.json({ error: 'Unauthorized - User not logged in or user ID invalid' }, { status: 401 });
    }

    let debateIdString: string | undefined; // Define outside try for catch block logging

    try {
        const params = await context.params;
        debateIdString = params.debateId; // Assign value here
        const debateId = parseInt(debateIdString, 10);

        if (isNaN(debateId)) {
            return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });
        }

        const body = await request.json();
        const { argumentText } = body;

        if (!argumentText || typeof argumentText !== 'string' || argumentText.trim().length === 0) {
            return NextResponse.json({ error: 'Argument text is required' }, { status: 400 });
        }

        const debate = await prisma.debate.findUnique({
            where: { debateId: debateId },
            include: { arguments: { orderBy: { turnNumber: 'desc' }, take: 1 } }
        });

        if (!debate) { return NextResponse.json({ error: 'Debate not found' }, { status: 404 }); }
        if (debate.status !== 'active') { return NextResponse.json({ error: 'Debate is not active' }, { status: 400 }); }

        const currentTurnNumber = debate.arguments.length;
        const isUserTurn = debate.userId === userId && currentTurnNumber % 2 === 0;

        if (!isUserTurn) { return NextResponse.json({ error: 'Not your turn or you are not the owner' }, { status: 403 }); }
        // Assuming maxTurns is per participant (e.g., 7 turns for user, 7 for AI)
        if (currentTurnNumber >= debate.maxTurns * 2) { return NextResponse.json({ error: 'Maximum turns reached' }, { status: 400 }); }

        const stanceBefore = debate.arguments.length > 0
            ? debate.arguments[0].stanceAfter ?? debate.initialStance
            : debate.initialStance;

        const result = await prisma.$transaction(async (tx) => {
            const newArgument = await tx.argument.create({
                data: {
                    debateId: debateId, userId: userId,
                    turnNumber: currentTurnNumber + 1,
                    argumentText: argumentText.trim(),
                    stanceBefore: stanceBefore,
                }
            });
            await tx.debate.update({ where: { debateId: debateId }, data: { turnCount: { increment: 1 } } });
            return newArgument;
        });

        // --- TODO: Trigger AI Response Generation ---

        return NextResponse.json(result, { status: 201 });

    } catch (error: unknown) {
        // Log the string ID we captured earlier, safely
        console.error(`Error submitting argument for debate ${debateIdString ?? '[unknown ID]'}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}