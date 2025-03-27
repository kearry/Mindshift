import { NextResponse } from 'next/server';
import { PrismaClient, Argument, Debate, Topic, User } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const prisma = new PrismaClient();
const openai = new OpenAI();
const openaiModel = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const summaryModel = process.env.OPENAI_SUMMARY_MODEL_NAME || "gpt-4o-mini"; // Use same or different model for summary

interface RouteParams {
    debateId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

type SummaryArgument = Pick<Argument, 'turnNumber' | 'argumentText' | 'aiResponse' | 'stanceBefore' | 'stanceAfter' | 'shiftReasoning'> & { user: Pick<User, 'displayName' | 'username'> | null };
type SummaryDebate = Pick<Debate, 'debateId' | 'initialStance' | 'finalStance' | 'goalDirection' | 'pointsEarned'> & { topic: Pick<Topic, 'name'>, arguments: SummaryArgument[] };


// --- Function to Generate and Save Summary (Updated Prompt) ---
async function generateAndSaveSummary(debateId: number): Promise<void> {
    console.log(`Generating summary for completed debate ${debateId}...`);
    try {
        const debateData = await prisma.debate.findUnique({
            where: { debateId },
            include: {
                topic: { select: { name: true } },
                arguments: { orderBy: { turnNumber: 'asc' }, include: { user: { select: { displayName: true, username: true } } } }
            }
        });
        if (!debateData) throw new Error("Debate not found for summary generation.");
        const finalStance = debateData.arguments[debateData.arguments.length - 1]?.stanceAfter ?? debateData.initialStance;

        // Construct history string (no changes here)
        let summaryHistory = `Debate Topic: ${debateData.topic.name}\nInitial AI Stance: ${debateData.initialStance.toFixed(1)}/10\nUser Goal: Shift Stance ${debateData.goalDirection}\n\nArgument History:\n`;
        debateData.arguments.forEach(arg => { summaryHistory += `Turn ${arg.turnNumber} (User: ${arg.user?.displayName || 'User'}):\n${arg.argumentText}\n`; if (arg.aiResponse) { summaryHistory += `AI Response (Stance ${arg.stanceBefore.toFixed(1)} -> ${arg.stanceAfter?.toFixed(1)}):\n${arg.aiResponse}\n`; if (arg.shiftReasoning) summaryHistory += `Reasoning: ${arg.shiftReasoning}\n`; } summaryHistory += "\n"; });
        summaryHistory += `Final AI Stance: ${finalStance.toFixed(1)}/10\nPoints Earned by User: ${debateData.pointsEarned?.toFixed(1) ?? 0}\n`;

        // --- Call LLM with Updated Summary Prompt ---
        const completion = await openai.chat.completions.create({
            model: summaryModel,
            messages: [
                { // <--- HERE: Updated System Prompt
                    role: "system",
                    content: `You are an AI assistant tasked with writing an analytical summary of a completed debate between a user and an AI (yourself). Your goal is NOT to give a chronological blow-by-blow account. Instead, generate an engaging article that:
1.  Clearly states your final stance (${finalStance.toFixed(1)}/10) on the topic "${debateData.topic.name}".
2.  Explains the core reasoning behind *why* you ended with that final stance, referencing the key arguments or evidence from the debate history that solidified it.
3.  Briefly discusses common arguments or viewpoints *opposing* your final stance (you may need to infer these based on the topic or the user's arguments) and explain *why* you were ultimately not persuaded by them during this specific debate, or why your final reasoning outweighs them.
4.  Highlights 1-2 specific arguments (either from the user or your own previous responses) that were particularly influential in causing stance shifts during the debate.
5.  Concludes with a concise takeaway about the debate's outcome or the topic itself.
Provide the output as a single block of text suitable for an article.`
                },
                { // User message providing the context
                    role: "user",
                    content: summaryHistory
                }
            ],
            temperature: 0.6, // Slightly lower temperature might encourage more focused analysis
        });

        const summaryText = completion.choices[0]?.message?.content?.trim() || "[Summary generation failed]";

        // Save summary and final state
        await prisma.debate.update({ where: { debateId }, data: { status: 'completed', completedAt: new Date(), summaryArticle: summaryText, finalStance: finalStance } });
        console.log(`Summary saved for debate ${debateId}.`);

    } catch (error) { /* ... unchanged summary error handling ... */
        console.error(`Failed to generate or save summary for debate ${debateId}:`, error); try { await prisma.debate.update({ where: { debateId }, data: { status: 'summary_failed', completedAt: new Date(), finalStance: (await prisma.debate.findUnique({ where: { debateId }, include: { arguments: { orderBy: { turnNumber: 'desc' }, take: 1 } } }))?.arguments[0]?.stanceAfter } }); } catch (updateError) { console.error(`Failed to update debate status after summary failure for debate ${debateId}:`, updateError); }
    }
}


// --- GET Handler (remains the same) ---
export async function GET(request: Request, context: RouteContext) { /* ... unchanged ... */
    try { const params = await context.params; const debateId = parseInt(params.debateId, 10); if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 }); const debate = await prisma.debate.findUnique({ where: { debateId: debateId }, include: { topic: true, user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } }, arguments: { orderBy: { turnNumber: 'asc' }, include: { user: { select: { userId: true, username: true, displayName: true } } } }, } }); if (!debate) return NextResponse.json({ error: 'Debate not found' }, { status: 404 }); return NextResponse.json(debate); } catch (error) { let paramsForLogging = 'unknown'; try { const p = await context.params; paramsForLogging = JSON.stringify(p); } catch { /* ignore */ } console.error(`Error fetching debate (Params: ${paramsForLogging}):`, error); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

// --- POST Handler (remains the same) ---
export async function POST(request: Request, context: RouteContext) { /* ... unchanged ... */
    const session = await getServerSession(authOptions); const userIdString = session?.user?.id; const userId = userIdString ? parseInt(userIdString, 10) : null; if (!session || !userId || isNaN(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); let debateIdString: string | undefined; let debateId: number; try { const params = await context.params; debateIdString = params.debateId; debateId = parseInt(debateIdString, 10); if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID' }, { status: 400 }); const body = await request.json(); const { argumentText } = body; if (!argumentText?.trim()) return NextResponse.json({ error: 'Argument text required' }, { status: 400 }); const transactionResult = await prisma.$transaction(async (tx) => { const debate = await tx.debate.findUnique({ where: { debateId: debateId }, include: { arguments: { orderBy: { turnNumber: 'asc' } }, topic: true } }); if (!debate) throw new Error('Debate not found'); if (debate.status !== 'active') throw new Error('Debate is not active'); const currentCompletedTurns = debate.turnCount; const isUserTurn = debate.userId === userId && currentCompletedTurns % 2 === 0; if (!isUserTurn) throw new Error('Not your turn'); if (currentCompletedTurns >= debate.maxTurns * 2) throw new Error('Max turns reached'); const lastArgument = debate.arguments[debate.arguments.length - 1]; const stanceBeforeValue = lastArgument?.stanceAfter ?? debate.initialStance; const newUserArgument = await tx.argument.create({ data: { debateId: debateId, userId: userId, turnNumber: currentCompletedTurns + 1, argumentText: argumentText.trim(), stanceBefore: stanceBeforeValue } }); await tx.debate.update({ where: { debateId: debateId }, data: { turnCount: { increment: 1 } } }); return { savedUserArgument: newUserArgument, stanceBefore: stanceBeforeValue, debateGoalDirection: debate.goalDirection, debateTopicId: debate.topicId, debateTopicName: debate.topic.name, previousArguments: debate.arguments, maxTurns: debate.maxTurns, currentTurnCountAfterUser: currentCompletedTurns + 1 }; }); const { savedUserArgument, stanceBefore, debateGoalDirection, debateTopicId, debateTopicName, previousArguments, maxTurns, currentTurnCountAfterUser } = transactionResult; let aiResponseText: string, newStance: number, stanceShift: number, shiftReasoning: string; try { const messages: ChatCompletionMessageParam[] = [{ role: "system", content: `You are debating the topic "${debateTopicName}". Your current stance is ${stanceBefore}/10 (0=supportive, 10=opposed). The user wants to shift you ${debateGoalDirection}. Evaluate their arguments in the context of the history, provide a response, your new stance (0-10), and brief reasoning for any stance change. Respond ONLY with a valid JSON object containing two keys: "aiResponse": "...", "newStance": X.Y, "reasoning": "..."}` }]; previousArguments.forEach(arg => { messages.push({ role: "user", content: arg.argumentText }); if (arg.aiResponse) messages.push({ role: "assistant", content: arg.aiResponse }); }); messages.push({ role: "user", content: argumentText.trim() }); console.log(`Calling OpenAI model ${openaiModel} for debate ${debateId}, user turn ${savedUserArgument.turnNumber} with ${messages.length} total messages.`); const completion = await openai.chat.completions.create({ model: openaiModel, messages: messages, response_format: { type: "json_object" } }); const aiResult = JSON.parse(completion.choices[0]?.message?.content || '{}'); aiResponseText = aiResult.aiResponse || "[AI failed to generate response text]"; let potentialStance = parseFloat(aiResult.newStance); if (isNaN(potentialStance)) potentialStance = stanceBefore; newStance = Math.max(0, Math.min(10, potentialStance)); stanceShift = newStance - stanceBefore; shiftReasoning = aiResult.reasoning || "[AI failed to provide reasoning]"; console.log(`OpenAI response: Stance ${stanceBefore} -> ${newStance}. Shift: ${stanceShift}.`); } catch (aiError) { console.error("OpenAI call failed:", aiError); aiResponseText = "[AI processing failed]"; newStance = stanceBefore; stanceShift = 0; shiftReasoning = `AI Error: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`; } let pointsThisTurn = 0; if (stanceShift < 0 && debateGoalDirection === 'left') pointsThisTurn = Math.abs(stanceShift); else if (stanceShift > 0 && debateGoalDirection === 'right') pointsThisTurn = stanceShift; else if ((stanceShift > 0 && debateGoalDirection === 'left') || (stanceShift < 0 && debateGoalDirection === 'right')) pointsThisTurn = -Math.abs(stanceShift); let updatedArgument: Argument; let finalDebateStatus: string = 'active'; try { updatedArgument = await prisma.argument.update({ where: { argumentId: savedUserArgument.argumentId }, data: { aiResponse: aiResponseText, stanceAfter: newStance, stanceShift: stanceShift, shiftReasoning: shiftReasoning } }); const turnCountAfterAI = currentTurnCountAfterUser + 1; const debateEnded = turnCountAfterAI >= maxTurns * 2; finalDebateStatus = debateEnded ? 'completed' : 'active'; await prisma.debate.update({ where: { debateId: debateId }, data: { turnCount: { increment: 1 }, pointsEarned: { increment: pointsThisTurn }, status: finalDebateStatus, ...(debateEnded && { finalStance: newStance, completedAt: new Date() }) } }); await prisma.topic.update({ where: { topicId: debateTopicId }, data: { currentStance: newStance, stanceReasoning: shiftReasoning } }); if (debateEnded) { generateAndSaveSummary(debateId).catch(summaryError => { console.error(`Background summary generation failed for debate ${debateId}:`, summaryError); }); } return NextResponse.json(updatedArgument, { status: 200 }); } catch (dbUpdateError) { console.error(`Error updating DB after AI response for debate ${debateIdString}:`, dbUpdateError); return NextResponse.json({ error: 'Failed to save AI response', detail: dbUpdateError instanceof Error ? dbUpdateError.message : '' }, { status: 500 }); } } catch (error: unknown) { console.error(`General error processing argument for debate ${debateIdString ?? '[unknown ID]'}:`, error); const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'; if (errorMessage === 'Not your turn') return NextResponse.json({ error: errorMessage }, { status: 403 }); if (errorMessage === 'Debate not found') return NextResponse.json({ error: errorMessage }, { status: 404 }); if (errorMessage === 'Debate is not active' || errorMessage === 'Max turns reached') return NextResponse.json({ error: errorMessage }, { status: 400 }); return NextResponse.json({ error: errorMessage }, { status: 500 }); }
}