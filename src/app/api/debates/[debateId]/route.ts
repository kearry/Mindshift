import { NextResponse } from 'next/server';
import { PrismaClient, Argument } from '@prisma/client'; // Keep needed Prisma types
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Import functions from service files
import { getAiDebateResponse, generateAndSaveSummary, AiResponseInput } from '@/lib/aiService';
import { retrieveRelevantContext, generateAndSaveEmbedding, EmbeddingData } from '@/lib/ragService';

const prisma = new PrismaClient();

// Type Definitions
interface RouteParams { debateId: string; }
interface RouteContext { params: Promise<RouteParams> | RouteParams; }
// Include needed types from Prisma models for TransactionResult
interface TransactionResult { savedUserArgument: Argument; stanceBefore: number; debateGoalDirection: string; debateTopicId: number; debateTopicName: string; previousArguments: Argument[]; maxTurns: number; currentTurnCountAfterUser: number; }

// --- GET Handler (remains the same - doesn't use new services) ---
export async function GET(request: Request, context: RouteContext) {
    try {
        const params = await context.params;
        const debateId = parseInt(params.debateId, 10);
        if (isNaN(debateId)) return NextResponse.json({ e: 'Inv ID' }, { status: 400 });
        const debate = await prisma.debate.findUnique({
            where: { debateId: debateId },
            include: {
                topic: true,
                user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } },
                arguments: { orderBy: { turnNumber: 'asc' }, include: { user: { select: { userId: true, username: true, displayName: true } } } }
            }
        });
        if (!debate) return NextResponse.json({ e: 'NF' }, { status: 404 });
        return NextResponse.json(debate);
    } catch (_error: unknown) { let pL = 'unk'; try { const p = await context.params; pL = JSON.stringify(p); } catch { } console.error(`Workspace err (P:${pL}):`, _error); return NextResponse.json({ e: 'ISE' }, { status: 500 }); }
}

// --- POST Handler (Refactored to use Services) ---
export async function POST(request: Request, context: RouteContext) {
    const session = await getServerSession(authOptions); const userIdString = session?.user?.id; const userId = userIdString ? parseInt(userIdString, 10) : null; if (!session || !userId || isNaN(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let debateIdString: string | undefined; let debateId: number;

    try {
        const params = await context.params; debateIdString = params.debateId; debateId = parseInt(debateIdString, 10); if (isNaN(debateId)) return NextResponse.json({ error: 'Inv ID' }, { status: 400 });
        const body = await request.json(); const { argumentText } = body; if (!argumentText?.trim()) return NextResponse.json({ error: 'Arg text req' }, { status: 400 });

        // --- Step 1: Transaction (Fetch history, Save user arg) ---
        const transactionResult = await prisma.$transaction<TransactionResult>(async (tx) => {
            const debate = await tx.debate.findUnique({ where: { debateId: debateId }, include: { arguments: { orderBy: { turnNumber: 'asc' } }, topic: true } });
            if (!debate) throw new Error('NF'); if (debate.status !== 'active') throw new Error('Not active');
            const cTurns = debate.turnCount; const isUTurn = debate.userId === userId && cTurns % 2 === 0; if (!isUTurn) throw new Error('Not turn'); if (cTurns >= debate.maxTurns * 2) throw new Error('Max turns');
            const lArg = debate.arguments[debate.arguments.length - 1]; const sBVal = lArg?.stanceAfter ?? debate.initialStance;
            const newUserArgument = await tx.argument.create({ data: { debateId: debateId, userId: userId, turnNumber: cTurns + 1, argumentText: argumentText.trim(), stanceBefore: sBVal } });
            await tx.debate.update({ where: { debateId: debateId }, data: { turnCount: { increment: 1 } } }); // Increment for user turn
            return { savedUserArgument: newUserArgument, stanceBefore: sBVal, debateGoalDirection: debate.goalDirection, debateTopicId: debate.topicId, debateTopicName: debate.topic.name, previousArguments: debate.arguments, maxTurns: debate.maxTurns, currentTurnCountAfterUser: cTurns + 1 };
        });

        const { savedUserArgument, stanceBefore, debateGoalDirection, debateTopicId, debateTopicName, previousArguments, maxTurns, currentTurnCountAfterUser } = transactionResult;
        if (!savedUserArgument) { throw new Error("Transaction failed: savedUserArgument is null."); }

        // --- Step 2: RAG Retrieval (Call Service) ---
        console.log("Calling RAG Service to retrieve context...");
        const retrievedContext = await retrieveRelevantContext(argumentText.trim(), debateTopicId);

        // --- Step 3: Call AI Service ---
        console.log("Calling AI Service to generate response...");
        const aiInput: AiResponseInput = {
            debateTopicName, stanceBefore, debateGoalDirection, previousArguments,
            currentArgumentText: argumentText.trim(), retrievedContext
        };
        const aiResponse = await getAiDebateResponse(aiInput);
        const { aiResponseText, newStance, stanceShift, shiftReasoning } = aiResponse;

        // --- Step 4: Calculate Points & Update DB ---
        const pointsThisTurn = (() => { /* ... unchanged points calculation ... */ if (stanceShift < 0 && debateGoalDirection === 'left') return Math.abs(stanceShift); if (stanceShift > 0 && debateGoalDirection === 'right') return stanceShift; if ((stanceShift > 0 && debateGoalDirection === 'left') || (stanceShift < 0 && debateGoalDirection === 'right')) return -Math.abs(stanceShift); return 0; })();
        console.log(`Points calc: Shift=<span class="math-inline">\{stanceShift\}, Goal\=</span>{debateGoalDirection}, Points=${pointsThisTurn}`);

        let updatedArgument: Argument | null = null; let finalDebateStatus: string = 'active';
        try {
            updatedArgument = await prisma.argument.update({ where: { argumentId: savedUserArgument.argumentId }, data: { aiResponse: aiResponseText, stanceAfter: newStance, stanceShift: stanceShift, shiftReasoning: shiftReasoning } });
            const turnCountAfterAI = currentTurnCountAfterUser + 1; const debateEnded = turnCountAfterAI >= maxTurns * 2; finalDebateStatus = debateEnded ? 'completed' : 'active';
            await prisma.debate.update({ where: { debateId: debateId }, data: { turnCount: { increment: 1 }, pointsEarned: { increment: pointsThisTurn }, status: finalDebateStatus, ...(debateEnded && { finalStance: newStance, completedAt: new Date() }) } });
            await prisma.topic.update({ where: { topicId: debateTopicId }, data: { currentStance: newStance, stanceReasoning: shiftReasoning } });

            // --- Step 4b: Trigger Summary Generation (Call Service) if debate ended ---
            if (debateEnded) {
                // Need to reconstruct data or pass it from transactionResult
                const summaryInput: SummaryInputData = {
                    debateId: debateId,
                    topicName: debateTopicName,
                    initialStance: stanceBefore - stanceShift, // Recalculate initial from before/shift
                    goalDirection: debateGoalDirection,
                    pointsEarned: (await prisma.debate.findUnique({ where: { debateId }, select: { pointsEarned: true } }))?.pointsEarned ?? 0, // Fetch final points
                    // Fetch args again or pass sufficient data - passing previous args + updated last arg
                    arguments: [...previousArguments, updatedArgument] as any, // Cast might be needed depending on type strictness
                    finalStance: newStance // Pass final stance
                }
                generateAndSaveSummary(summaryInput).catch(e => { console.error(`BG Summ fail ${debateId}:`, e); });
            }
        } catch (dbUE) { console.error(`DB Upd fail ${debateIdString}:`, dbUE); return NextResponse.json({ e: 'Fail save AI resp', d: dbUE instanceof Error ? dbUE.message : '' }, { status: 500 }); }

        // --- Step 5: Generate and Save Embedding (Call Service) ---
        console.log("Calling RAG Service to save embedding...");
        const embeddingInput: EmbeddingData = {
            savedUserArgument, userArgumentText: argumentText.trim(), aiResponseText, shiftReasoning,
            stanceBefore, stanceAfter: newStance, debateId, topicId: debateTopicId
        };
        generateAndSaveEmbedding(embeddingInput)
            .catch(_embeddingError => { console.error(`Embed fail arg ${savedUserArgument?.argumentId}:`, _embeddingError); });

        if (!updatedArgument) { throw new Error("Argument update failed unexpectedly before return."); }
        return NextResponse.json(updatedArgument, { status: 200 });

        // Outer catch block remains the same
    } catch (_error: unknown) { /* ... unchanged outer error handling ... */ console.error(`General err proc arg ${debateIdString ?? '[unk ID]'}:`, _error); const msg = _error instanceof Error ? _error.message : 'ISE'; if (msg === 'Not turn') return NextResponse.json({ e: msg }, { status: 403 }); if (msg === 'NF') return NextResponse.json({ e: msg }, { status: 404 }); if (msg === 'Not active' || msg === 'Max turns') return NextResponse.json({ e: msg }, { status: 400 }); return NextResponse.json({ e: msg }, { status: 500 }); }
}