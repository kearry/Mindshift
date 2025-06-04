// src/app/api/debates/[debateId]/route.ts (Updated with LLM provider selection)
import { NextResponse } from 'next/server';
import { PrismaClient, Argument } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Import functions from service files
import { getAiDebateResponse, generateAndSaveSummary, AiResponseInput } from '@/lib/aiService';

const prisma = new PrismaClient();

// Type Definitions
interface RouteParams { debateId: string; }
interface RouteContext { params: Promise<RouteParams> | RouteParams; }

// Include needed types for SummaryInputData
interface SummaryInputData {
    debateId: number;
    topicName: string;
    initialStance: number;
    goalDirection: string;
    pointsEarned: number | null;
    arguments: Argument[];
    finalStance: number;
}

// Include needed types from Prisma models for TransactionResult
interface TransactionResult {
    savedUserArgument: Argument;
    stanceBefore: number;
    debateGoalDirection: string;
    debateTopicId: number;
    debateTopicName: string;
    previousArguments: Argument[];
    maxTurns: number;
    currentTurnCountAfterUser: number;
    existingProvider: string | null;
    existingModel: string | null;
}

// --- GET Handler (unchanged) ---
export async function GET(request: Request, context: RouteContext) {
    try {
        const params = await context.params;
        const debateId = parseInt(params.debateId, 10);
        if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });

        const debate = await prisma.debate.findUnique({
            where: { debateId: debateId },
            include: {
                topic: true,
                user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } },
                arguments: {
                    orderBy: { turnNumber: 'asc' },
                    include: { user: { select: { userId: true, username: true, displayName: true } } }
                }
            }
        });

        if (!debate) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        return NextResponse.json(debate);
    } catch (error: unknown) {
        console.error(`Error fetching debate:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- POST Handler (updated to handle LLM selection) ---
export async function POST(request: Request, context: RouteContext) {
    // Authentication check
    const session = await getServerSession(authOptions);
    const userIdString = session?.user?.id;
    const userId = userIdString ? parseInt(userIdString, 10) : null;

    if (!session || !userId || isNaN(userId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let debateIdString: string | undefined;
    let debateId: number;

    try {
        // Parse debate ID
        const params = await context.params;
        debateIdString = params.debateId;
        debateId = parseInt(debateIdString, 10);

        if (isNaN(debateId)) {
            return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });
        }

        // Parse request body
        const body = await request.json();
        const {
            argumentText,
            llmProvider, // New: optional LLM provider (openai/ollama)
            llmModel     // New: optional LLM model name
        } = body;

        if (!argumentText?.trim()) {
            return NextResponse.json({ error: 'Argument text is required' }, { status: 400 });
        }

        // --- Step 1: Transaction (Fetch history, Save user arg) ---
        const transactionResult = await prisma.$transaction<TransactionResult>(async (tx) => {
            // Get debate with existing arguments
            const debate = await tx.debate.findUnique({
                where: { debateId: debateId },
                include: {
                    arguments: { orderBy: { turnNumber: 'asc' } },
                    topic: true
                }
            });

            // Validate debate exists and user can make a move
            if (!debate) throw new Error('Debate not found');
            if (debate.status !== 'active') throw new Error('Debate is not active');

            const currentTurns = debate.turnCount;
            const isUserTurn = debate.userId === userId && currentTurns % 2 === 0;

            if (!isUserTurn) throw new Error('Not your turn');
            if (currentTurns >= debate.maxTurns * 2) throw new Error('Maximum turns reached');

            // Get current stance
            const lastArgument = debate.arguments[debate.arguments.length - 1];
            const currentStance = lastArgument?.stanceAfter ?? debate.initialStance;

            // Create new user argument
            const newUserArgument = await tx.argument.create({
                data: {
                    debateId: debateId,
                    userId: userId,
                    turnNumber: currentTurns + 1,
                    argumentText: argumentText.trim(),
                    stanceBefore: currentStance
                }
            });

            // Update debate turn count
            await tx.debate.update({
                where: { debateId: debateId },
                data: { turnCount: { increment: 1 } }
            });

            // Return transaction result
            return {
                savedUserArgument: newUserArgument,
                stanceBefore: currentStance,
                debateGoalDirection: debate.goalDirection,
                debateTopicId: debate.topicId,
                debateTopicName: debate.topic.name,
                previousArguments: debate.arguments,
                maxTurns: debate.maxTurns,
                currentTurnCountAfterUser: currentTurns + 1,
                existingProvider: debate.llmProvider ?? null,
                existingModel: debate.llmModel ?? null
            };
        });

        // Extract all values from transaction result
        const {
            savedUserArgument,
            stanceBefore,
            debateGoalDirection,
            debateTopicId,
            debateTopicName,
            previousArguments,
            maxTurns,
            currentTurnCountAfterUser,
            existingProvider,
            existingModel
        } = transactionResult;

        const providerToUse = (llmProvider as 'openai' | 'ollama' | undefined) ?? existingProvider ?? 'openai';
        const modelToUse = llmModel ?? existingModel ?? process.env.OPENAI_MODEL_NAME ?? 'gpt-4o-mini';

        // --- Step 2: Get RAG Context (from separate API endpoint) ---
        let retrievedContext = "";
        try {
            const ragResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/rag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queryText: argumentText.trim(), topicId: debateTopicId })
            });

            if (ragResponse.ok) {
                const ragData = await ragResponse.json();
                retrievedContext = ragData.context || "";
            } else {
                console.log("Failed to get RAG context, using empty context");
            }
        } catch (ragError) {
            console.error("Error fetching RAG context:", ragError);
            retrievedContext = "[Error retrieving context]";
        }

        // --- Step 3: Call AI Service with LLM selection ---
        console.log(`Calling AI Service for response with provider: ${providerToUse}, model: ${modelToUse}`);
        const aiInput: AiResponseInput = {
            debateTopicName,
            stanceBefore,
            debateGoalDirection,
            previousArguments,
            currentArgumentText: argumentText.trim(),
            retrievedContext,
            // Pass final LLM selection
            llmProvider: providerToUse,
            llmModel: modelToUse
        };

        const aiResponse = await getAiDebateResponse(aiInput);
        const { aiResponseText, newStance, stanceShift, shiftReasoning, model: providerModel } = aiResponse;

        // --- Step 4: Calculate Points & Update DB ---
        const pointsThisTurn = calculatePoints(stanceShift, debateGoalDirection);
        console.log(`Points calculation: Shift=${stanceShift}, Goal=${debateGoalDirection}, Points=${pointsThisTurn}`);

        let updatedArgument: Argument | null = null;
        let finalDebateStatus: string = 'active';

        try {
            // Update argument with AI response
            updatedArgument = await prisma.argument.update({
                where: { argumentId: savedUserArgument.argumentId },
                data: {
                    aiResponse: `${aiResponseText}\n\n_Response generated by: ${providerModel}_`,
                    stanceAfter: newStance,
                    stanceShift: stanceShift,
                    shiftReasoning: shiftReasoning
                }
            });

            // Check if debate has ended
            const turnCountAfterAI = currentTurnCountAfterUser + 1;
            const debateEnded = turnCountAfterAI >= maxTurns * 2;
            finalDebateStatus = debateEnded ? 'completed' : 'active';

            // Update debate
            await prisma.debate.update({
                where: { debateId: debateId },
                data: {
                    turnCount: { increment: 1 },
                    pointsEarned: { increment: pointsThisTurn },
                    status: finalDebateStatus,
                    ...(existingProvider ? {} : { llmProvider: providerToUse }),
                    ...(existingModel ? {} : { llmModel: modelToUse }),
                    ...(debateEnded && {
                        finalStance: newStance,
                        completedAt: new Date()
                    })
                }
            });

            // Update topic stance
            await prisma.topic.update({
                where: { topicId: debateTopicId },
                data: {
                    currentStance: newStance,
                    stanceReasoning: shiftReasoning
                }
            });

            // --- Step 4b: Trigger Summary Generation if debate ended ---
            if (debateEnded) {
                const finalPoints = await prisma.debate.findUnique({
                    where: { debateId },
                    select: { pointsEarned: true }
                });

                const summaryInput: SummaryInputData = {
                    debateId: debateId,
                    topicName: debateTopicName,
                    initialStance: stanceBefore - stanceShift,
                    goalDirection: debateGoalDirection,
                    pointsEarned: finalPoints?.pointsEarned ?? 0,
                    arguments: [...previousArguments, updatedArgument] as Argument[],
                    finalStance: newStance
                };

                // Generate summary in background
                generateAndSaveSummary(summaryInput).catch(e => {
                    console.error(`Background summary generation failed for debate ${debateId}:`, e);
                });
            }
        } catch (dbError) {
            console.error(`Database update failed for debate ${debateIdString}:`, dbError);
            return NextResponse.json(
                { error: 'Failed to save AI response', details: dbError instanceof Error ? dbError.message : '' },
                { status: 500 }
            );
        }

        if (!updatedArgument) {
            throw new Error("Argument update failed unexpectedly");
        }

        return NextResponse.json(updatedArgument, { status: 200 });

    } catch (error: unknown) {
        console.error(`Error processing argument for debate ${debateIdString ?? '[unknown ID]'}:`, error);

        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';

        // Return appropriate status codes based on error type
        if (errorMessage === 'Not your turn') {
            return NextResponse.json({ error: errorMessage }, { status: 403 });
        }
        if (errorMessage === 'Debate not found') {
            return NextResponse.json({ error: errorMessage }, { status: 404 });
        }
        if (errorMessage === 'Debate is not active' || errorMessage === 'Maximum turns reached') {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// Helper function to calculate points
function calculatePoints(stanceShift: number, goalDirection: string): number {
    if (stanceShift < 0 && goalDirection === 'left') {
        return Math.abs(stanceShift);
    }
    if (stanceShift > 0 && goalDirection === 'right') {
        return stanceShift;
    }
    if ((stanceShift > 0 && goalDirection === 'left') || (stanceShift < 0 && goalDirection === 'right')) {
        return -Math.abs(stanceShift);
    }
    return 0;
}