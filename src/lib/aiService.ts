// src/lib/aiService.ts
import OpenAI from 'openai';
import { Argument, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const openai = new OpenAI(); // Reads OPENAI_API_KEY from env
const openaiModel = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const summaryModel = process.env.OPENAI_SUMMARY_MODEL_NAME || openaiModel;

// --- Types for getAiDebateResponse ---
export interface AiResponseInput {
    debateTopicName: string;
    stanceBefore: number;
    debateGoalDirection: string;
    previousArguments: Argument[];
    currentArgumentText: string;
    retrievedContext: string;
}

export interface AiResponseOutput {
    aiResponseText: string;
    newStance: number;
    stanceShift: number;
    shiftReasoning: string;
}

// --- Function to get AI Debate Response ---
export async function getAiDebateResponse(input: AiResponseInput): Promise<AiResponseOutput> {
    const { debateTopicName, stanceBefore, debateGoalDirection, previousArguments, currentArgumentText, retrievedContext } = input;

    // Default values in case of error
    let aiResponseText: string = "[AI response generation failed]";
    let newStance: number = stanceBefore;
    let stanceShift: number = 0;
    let shiftReasoning: string = "AI Error: Could not process response.";

    try {
        // Format previous arguments for context
        const argumentHistory = previousArguments.map(arg => {
            return `Turn ${arg.turnNumber}: User argument: ${arg.argumentText}\n` +
                `${arg.aiResponse ? `AI response: ${arg.aiResponse}\n` : ''}` +
                `${arg.stanceAfter ? `Stance change: ${arg.stanceBefore.toFixed(1)} → ${arg.stanceAfter.toFixed(1)}\n` : ''}`;
        }).join('\n');

        // Build system prompt with comprehensive context
        const systemPrompt = `You are an AI debating the topic "${debateTopicName}".
Your current stance is ${stanceBefore.toFixed(1)}/10 (0=fully supportive, 5=neutral, 10=fully opposed).
The user is trying to move your stance ${debateGoalDirection} on the scale.

RAG CONTEXT (retrieved from similar arguments):
${retrievedContext}

DEBATE HISTORY:
${argumentHistory}

INSTRUCTIONS:
1. Consider the user's new argument and how compelling it is.
2. Decide if and how much to shift your stance based on the merits of their argument.
3. Respond with thoughtful, nuanced reasoning.
4. You must return ONLY valid JSON with these fields:
   - "aiResponse": your debate response text
   - "newStance": your new stance as a number between 0-10
   - "reasoning": explanation for why you shifted (or didn't shift) your stance

Be fair but not too easy to persuade. Require good arguments to shift your position.`;

        console.log(`Calling OpenAI model ${openaiModel}...`);
        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: currentArgumentText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        // Parse and validate AI response
        const content = completion.choices[0]?.message?.content || '{}';
        const aiResult = JSON.parse(content);

        // Get AI response text
        aiResponseText = aiResult.aiResponse || "[AI failed to generate a response]";

        // Get and validate new stance
        const potentialStance = parseFloat(aiResult.newStance);
        if (!isNaN(potentialStance)) {
            newStance = Math.max(0, Math.min(10, potentialStance));
        }

        // Calculate stance shift
        stanceShift = newStance - stanceBefore;

        // Get reasoning for the shift
        shiftReasoning = aiResult.reasoning || "[No reasoning provided]";

        console.log(`OpenAI response: Stance changed from ${stanceBefore} to ${newStance}. Shift: ${stanceShift.toFixed(2)}`);

    } catch (aiError: unknown) {
        console.error("OpenAI call failed in aiService:", aiError);
        shiftReasoning = `AI Error: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`;
    }

    return { aiResponseText, newStance, stanceShift, shiftReasoning };
}

// Define interface for user data when included with arguments
interface ArgumentWithUser extends Argument {
    user?: {
        displayName?: string | null;
        username?: string;
    } | null;
}

// Define interface for summary input data
export interface SummaryInputData {
    debateId: number;
    topicName: string;
    initialStance: number;
    goalDirection: string;
    pointsEarned: number | null;
    arguments: Argument[];
    finalStance: number;
}

// --- Function to Generate and Save Summary ---
export async function generateAndSaveSummary(inputData: SummaryInputData): Promise<void> {
    const { debateId, topicName, initialStance, goalDirection, pointsEarned, arguments: args, finalStance } = inputData;

    console.log(`Generating summary for completed debate ${debateId}...`);

    try {
        // Format argument history for summary generation
        let summaryHistory = `Debate Topic: "${topicName}"
Initial AI Stance: ${initialStance.toFixed(1)}/10
User Goal: Shift stance ${goalDirection}
Final AI Stance: ${finalStance.toFixed(1)}/10
Points Earned by User: ${pointsEarned?.toFixed(1) ?? '0'}
Number of Turns: ${args.length}

ARGUMENT HISTORY:`;

        // Add each argument and response to the history
        args.forEach(arg => {
            // Check if arg has user property and cast if needed
            const argWithUser = arg as unknown as ArgumentWithUser;
            const username = argWithUser.user ?
                (argWithUser.user.displayName || argWithUser.user.username || 'User') : 'User';

            summaryHistory += `\n\nTurn ${arg.turnNumber} (${username}):\n${arg.argumentText}`;

            if (arg.aiResponse) {
                summaryHistory += `\n\nAI Response (Stance ${arg.stanceBefore.toFixed(1)} → ${arg.stanceAfter?.toFixed(1) || arg.stanceBefore.toFixed(1)}):\n${arg.aiResponse}`;

                if (arg.shiftReasoning) {
                    summaryHistory += `\n\nReasoning for stance shift: ${arg.shiftReasoning}`;
                }
            }
        });

        // System prompt for summary generation
        const systemPrompt = `You are an AI assistant writing an analytical summary of a completed debate. 
Your task is to create a well-structured summary article that:

1. Introduces the debate topic and the initial positions
2. Highlights the key arguments made by the user
3. Explains how and why the AI's stance shifted during the debate
4. Analyzes the most persuasive points and their impact
5. Provides a thoughtful conclusion about the overall effectiveness of the debate

Focus on the substance of the arguments rather than mechanics. Identify logical patterns, 
rhetorical strategies, and the evolution of the discussion. Write in a balanced, analytical tone.`;

        // Call OpenAI for summary generation
        console.log(`Calling OpenAI model ${summaryModel} for summary generation...`);
        const completion = await openai.chat.completions.create({
            model: summaryModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: summaryHistory }
            ],
            temperature: 0.7,
            max_tokens: 1500
        });

        const summaryText = completion.choices[0]?.message?.content?.trim() || "[Summary generation failed]";

        // Save summary to database
        await prisma.debate.update({
            where: { debateId },
            data: {
                status: 'completed',
                completedAt: new Date(),
                summaryArticle: summaryText,
                finalStance: finalStance
            }
        });

        console.log(`Summary successfully saved for debate ${debateId}.`);

    } catch (error: unknown) {
        console.error(`Failed to generate or save summary for debate ${debateId}:`, error);

        try {
            // Mark debate as having failed summary generation but still completed
            const lastArg = await prisma.argument.findFirst({
                where: { debateId },
                orderBy: { turnNumber: 'desc' }
            });

            await prisma.debate.update({
                where: { debateId },
                data: {
                    status: 'summary_failed',
                    completedAt: new Date(),
                    finalStance: lastArg?.stanceAfter
                }
            });

            console.log(`Marked debate ${debateId} as 'summary_failed'.`);

        } catch (updateError) {
            console.error(`Failed to update debate status after summary failure for debate ${debateId}:`, updateError);
        }
    }
}