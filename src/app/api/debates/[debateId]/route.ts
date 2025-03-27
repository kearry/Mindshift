import { NextResponse } from 'next/server';
// Removed 'Debate' type import as it wasn't explicitly needed here
import { PrismaClient, Argument, User } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const prisma = new PrismaClient();
const openai = new OpenAI();
const openaiModel = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const summaryModel = process.env.OPENAI_SUMMARY_MODEL_NAME || "gpt-4o-mini";

interface RouteParams {
    debateId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

// Define a type for the data returned from the transaction
interface TransactionResult {
    savedUserArgument: Argument;
    stanceBefore: number;
    debateGoalDirection: string;
    debateTopicId: number;
    debateTopicName: string;
    previousArguments: Argument[];
    maxTurns: number;
    currentTurnCountAfterUser: number;
}

// Simpler types using Pick on imported Prisma types
type SummaryUserType = Pick<User, 'displayName' | 'username'>;
type SummaryArgumentType = Pick<Argument, 'turnNumber' | 'argumentText' | 'aiResponse' | 'stanceBefore' | 'stanceAfter' | 'shiftReasoning'> & { user: SummaryUserType | null };
// Removed unused SummaryTopicType:
// type SummaryTopicType = Pick<Topic, 'name'>;


// --- Function to Generate and Save Summary (remains the same logic) ---
async function generateAndSaveSummary(debateId: number): Promise<void> {
    console.log(`Generating summary for completed debate ${debateId}...`);
    try {
        const debateData = await prisma.debate.findUnique({ where: { debateId }, include: { topic: { select: { name: true } }, arguments: { orderBy: { turnNumber: 'asc' }, include: { user: { select: { displayName: true, username: true } } } } } });
        if (!debateData) throw new Error("Debate not found for summary generation.");
        const argsForSummary = debateData.arguments as SummaryArgumentType[]; // Use Type Assertion if needed
        const finalStance = argsForSummary[argsForSummary.length - 1]?.stanceAfter ?? debateData.initialStance;
        let summaryHistory = `Debate Topic: ${debateData.topic.name}\nInitial AI Stance: ${debateData.initialStance.toFixed(1)}/10\nUser Goal: Shift Stance ${debateData.goalDirection}\n\nArgument History:\n`;
        argsForSummary.forEach(arg => { summaryHistory += `Turn ${arg.turnNumber} (User: <span class="math-inline">\{arg\.user?\.displayName \|\| 'User'\}\)\:\\n</span>{arg.argumentText}\n`; if (arg.aiResponse) { summaryHistory += `AI Response (Stance ${arg.stanceBefore.toFixed(1)} -> <span class="math-inline">\{arg\.stanceAfter?\.toFixed\(1\)\}\)\:\\n</span>{arg.aiResponse}\n`; if (arg.shiftReasoning) summaryHistory += `Reasoning: ${arg.shiftReasoning}\n`; } summaryHistory += "\n"; });
        summaryHistory += `Final AI Stance: ${finalStance.toFixed(1)}/10\nPoints Earned by User: ${debateData.pointsEarned?.toFixed(1) ?? 0}\n`;
        const completion = await openai.chat.completions.create({ model: summaryModel, messages: [{ role: "system", content: `You are an AI assistant tasked with writing an analytical summary...` /* Shortened */ }, { role: "user", content: summaryHistory }], temperature: 0.6 });
        const summaryText = completion.choices[0]?.message?.content?.trim() || "[Summary generation failed]";
        await prisma.debate.update({ where: { debateId }, data: { status: 'completed', completedAt: new Date(), summaryArticle: summaryText, finalStance: finalStance } });
        console.log(`Summary saved for debate ${debateId}.`);
    } catch (error) { /* ... unchanged summary error handling ... */ console.error(`Failed to generate or save summary for debate ${debateId}:`, error); try { await prisma.debate.update({ where: { debateId }, data: { status: 'summary_failed', completedAt: new Date(), finalStance: (await prisma.debate.findUnique({ where: { debateId }, include: { arguments: { orderBy: { turnNumber: 'desc' }, take: 1 } } }))?.arguments[0]?.stanceAfter } }); } catch (updateError) { console.error(`Failed to update debate status after summary failure for debate ${debateId}:`, updateError); } }
}

// --- GET Handler (remains the same) ---
export async function GET(request: Request, context: RouteContext) { /* ... unchanged ... */ try { const params = await context.params; const debateId = parseInt(params.debateId, 10); if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 }); const debate = await prisma.debate.findUnique({ where: { debateId: debateId }, include: { topic: true, user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } }, arguments: { orderBy: { turnNumber: 'asc' }, include: { user: { select: { userId: true, username: true, displayName: true } } } }, } }); if (!debate) return NextResponse.json({ error: 'Debate not found' }, { status: 404 }); return NextResponse.json(debate); } catch (error) { let paramsForLogging = 'unknown'; try { const p = await context.params; paramsForLogging = JSON.stringify(p); } catch { /* ignore */ } console.error(`Error fetching debate (Params: ${paramsForLogging}):`, error); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); } }

// --- POST Handler (remains the same) ---
export async function POST(request: Request, context: RouteContext) { /* ... unchanged ... */ const session = await getServerSession(authOptions); const userIdString = session?.user?.id; const userId = userIdString ? parseInt(userIdString, 10) : null; if (!session || !userId || isNaN(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); let debateIdString: string | undefined; let debateId: number; try { const params = await context.params; debateIdString = params.debateId; debateId = parseInt(debateIdString, 10); if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID' }, { status: 400 }); const body = await request.json(); const { argumentText } = body; if (!argumentText?.trim()) return NextResponse.json({ error: 'Argument text required' }, { status: 400 }); const transactionResult: TransactionResult = await prisma.$transaction(async (tx) => { const debate = await tx.debate.findUnique({ where: { debateId: debateId }, include: { arguments: { orderBy: { turnNumber: 'asc' } }, topic: true } }); if (!debate) throw new Error('Debate not found'); if (debate.status !== 'active') throw new Error('Debate is not active'); const currentCompletedTurns = debate.turnCount; const isUserTurn = debate.userId === userId && currentCompletedTurns % 2 === 0; if (!isUserTurn) throw new Error('Not your turn'); if (currentCompletedTurns >= debate.maxTurns * 2) throw new Error('Max turns reached'); const lastArgument = debate.arguments[debate.arguments.length - 1]; const stanceBeforeValue = lastArgument?.stanceAfter ?? debate.initialStance; const newUserArgument = await tx.argument.create({ data: { debateId: debateId, userId: userId, turnNumber: currentCompletedTurns + 1, argumentText: argumentText.trim(), stanceBefore: stanceBeforeValue } }); await tx.debate.update({ where: { debateId: debateId }, data: { turnCount: { increment: 1 } } }); return { savedUserArgument: newUserArgument, stanceBefore: stanceBeforeValue, debateGoalDirection: debate.goalDirection, debateTopicId: debate.topicId, debateTopicName: debate.topic.name, previousArguments: debate.arguments, maxTurns: debate.maxTurns, currentTurnCountAfterUser: currentCompletedTurns + 1 }; }); const { savedUserArgument, stanceBefore, debateGoalDirection, debateTopicId, debateTopicName, previousArguments, maxTurns, currentTurnCountAfterUser } = transactionResult; let aiResponseText: string, newStance: number, stanceShift: number, shiftReasoning: string; try { const messages: ChatCompletionMessageParam[] = [{ role: "system", content: `You are debating the topic "${debateTopicName}". Your current stance is ${stanceBefore}/10 (0=supportive, 10=opposed). The user wants to shift you ${debateGoalDirection}. Evaluate their arguments in the context of the history, provide a response, your new stance (0-10), and brief reasoning for any stance change. Respond ONLY with a valid JSON object containing two keys: "aiResponse": "...", "newStance": X.Y, "reasoning": "..."}` }]; previousArguments.forEach(arg => { messages.push({ role: "user", content: arg.argumentText }); if (arg.aiResponse) messages.push({ role: "assistant", content: arg.aiResponse }); }); messages.push({ role: "user", content: argumentText.trim() }); console.log(`Calling OpenAI model ${openaiModel} for debate ${debateId}, user turn ${savedUserArgument.turnNumber} with ${messages.length} total messages.`); const completion = await openai.chat.completions.create({ model: openaiModel, messages: messages, response_format: { type: "json_object" } }); const aiResult = JSON.parse(completion.choices[0]?.message?.content || '{}'); aiResponseText = aiResult.aiResponse || "[AI failed to generate response text]"; let potentialStance = parseFloat(aiResult.newStance); if (isNaN(potentialStance)) potentialStance = stanceBefore; newStance = Math.max(0, Math.min(10, potentialStance)); stanceShift = newStance - stanceBefore; shiftReasoning = aiResult.reasoning || "[AI failed to provide reasoning]"; console.log(`OpenAI response: Stance ${stanceBefore} -> ${newStance}. Shift: ${stanceShift}.`); } catch (aiError) { console.error("OpenAI call failed:", aiError); aiResponseText = "[AI processing failed]"; newStance = stanceBefore; stanceShift = 0; shiftReasoning = `AI Error: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`; } let pointsThisTurn = 0; if (stanceShift < 0 && debateGoalDirection === 'left') pointsThisTurn = Math.abs(stanceShift); else if (stanceShift > 0 && debateGoalDirection === 'right') pointsThisTurn = stanceShift; else if ((stanceShift > 0 && debateGoalDirection === 'left') || (stanceShift < 0 && debateGoalDirection === 'right')) pointsThisTurn = -Math.abs(stanceShift); let updatedArgument: Argument; let finalDebateStatus: string = 'active'; try { updatedArgument = await prisma.argument.update({ where: { argumentId: savedUserArgument.argumentId }, data: { aiResponse: aiResponseText, stanceAfter: newStance, stanceShift: stanceShift, shiftReasoning: shiftReasoning } }); const turnCountAfterAI = currentTurnCountAfterUser + 1; const debateEnded = turnCountAfterAI >= maxTurns * 2; finalDebateStatus = debateEnded ? 'completed' : 'active'; await prisma.debate.update({ where: { debateId: debateId }, data: { turnCount: { increment: 1 }, pointsEarned: { increment: pointsThisTurn }, status: finalDebateStatus, ...(debateEnded && { finalStance: newStance, completedAt: new Date() }) } }); await prisma.topic.update({ where: { topicId: debateTopicId }, data: { currentStance: newStance, stanceReasoning: shiftReasoning } }); if (debateEnded) { generateAndSaveSummary(debateId).catch(summaryError => { console.error(`Background summary generation failed for debate ${debateId}:`, summaryError); }); } return NextResponse.json(updatedArgument, { status: 200 }); } catch (dbUpdateError) { console.error(`Error updating DB after AI response for debate ${debateIdString}:`, dbUpdateError); return NextResponse.json({ error: 'Failed to save AI response', detail: dbUpdateError instanceof Error ? dbUpdateError.message : '' }, { status: 500 }); } } catch (error: unknown) { console.error(`General error processing argument for debate ${debateIdString ?? '[unknown ID]'}:`, error); const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'; if (errorMessage === 'Not your turn') return NextResponse.json({ error: errorMessage }, { status: 403 }); if (errorMessage === 'Debate not found') return NextResponse.json({ error: errorMessage }, { status: 404 }); if (errorMessage === 'Debate is not active' || errorMessage === 'Max turns reached') return NextResponse.json({ error: errorMessage }, { status: 400 }); return NextResponse.json({ error: errorMessage }, { status: 500 }); } }