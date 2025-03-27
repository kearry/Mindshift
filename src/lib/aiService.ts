// src/lib/aiService.ts
import OpenAI from 'openai';
import { Argument, Debate, Topic, User } from '@prisma/client'; // Import necessary Prisma types
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { PrismaClient } from '@prisma/client'; // Import PrismaClient for summary saving

const prisma = new PrismaClient(); // Initialize Prisma client for saving summary

const openai = new OpenAI(); // Reads OPENAI_API_KEY from env automatically
const openaiModel = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const summaryModel = process.env.OPENAI_SUMMARY_MODEL_NAME || openaiModel; // Use same model if not specified

// --- Types for getAiDebateResponse ---
export interface AiResponseInput {
    debateTopicName: string;
    stanceBefore: number;
    debateGoalDirection: string;
    previousArguments: Argument[]; // Use full Argument type
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
        // Build message history
        const messages: ChatCompletionMessageParam[] = [
            { role: "system", content: `You are debating topic "${debateTopicName}". Stance ${stanceBefore}/10. Goal <span class="math-inline">\{debateGoalDirection\}\. Context follows\.\\n</span>{retrievedContext}\nHistory:\n${previousArguments.map(arg => `User: ${arg.argumentText}\n${arg.aiResponse ? `Assistant: ${arg.aiResponse}\n` : ''}`).join('')}Evaluate latest user arg. Respond ONLY JSON: {"aiResponse": "...", "newStance": X.Y, "reasoning": "..."}` },
            { role: "user", content: currentArgumentText }
        ];

        console.log(`Calling OpenAI model ${openaiModel}...`);
        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: messages,
            response_format: { type: "json_object" }
        });

        const aiResult = JSON.parse(completion.choices[0]?.message?.content || '{}');
        aiResponseText = aiResult.aiResponse || "[AI failed response text]";
        let potentialStance = parseFloat(aiResult.newStance);
        if (isNaN(potentialStance)) potentialStance = stanceBefore;
        newStance = Math.max(0, Math.min(10, potentialStance));
        stanceShift = newStance - stanceBefore;
        shiftReasoning = aiResult.reasoning || "[AI failed reasoning]";
        console.log(`OpenAI response: Stance ${stanceBefore} -> ${newStance}. Shift: ${stanceShift}.`);

    } catch (aiError: unknown) {
        console.error("OpenAI call failed in aiService:", aiError);
        // Use default values defined above
        shiftReasoning = `AI Error: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`;
    }

    return { aiResponseText, newStance, stanceShift, shiftReasoning };
}


// --- Types for generateAndSaveSummary ---
// Define required types inline or import if needed elsewhere
type SummaryUserType = Pick<User, 'displayName' | 'username'>;
type SummaryArgumentType = Pick<Argument, 'turnNumber' | 'argumentText' | 'aiResponse' | 'stanceBefore' | 'stanceAfter' | 'shiftReasoning'> & { user: SummaryUserType | null };
// Define type for input data needed by summary function
interface SummaryInputData {
    debateId: number;
    topicName: string;
    initialStance: number;
    goalDirection: string;
    pointsEarned: number | null;
    arguments: SummaryArgumentType[];
}

// --- Function to Generate and Save Summary ---
export async function generateAndSaveSummary(inputData: SummaryInputData): Promise<void> {
    const { debateId, topicName, initialStance, goalDirection, pointsEarned, arguments: args } = inputData;
    console.log(`Generating summary for completed debate ${debateId}...`);
    try {
        const finalStance = args[args.length - 1]?.stanceAfter ?? initialStance;

        // Construct history string
        let summaryHistory = `Debate Topic: ${topicName}\nInitial AI Stance: ${initialStance.toFixed(1)}/10\nUser Goal: Shift Stance ${goalDirection}\n\nArgument History:\n`;
        args.forEach(arg => { summaryHistory += `T${arg.turnNumber}(User:<span class="math-inline">\{arg\.user?\.displayName\|\|'U'\}\)\:</span>{arg.argumentText}\n`; if (arg.aiResponse) { summaryHistory += `AI(Stance <span class="math-inline">\{arg\.stanceBefore\.toFixed\(1\)\}\-\></span>{arg.stanceAfter?.toFixed(1)}):${arg.aiResponse}\n`; if (arg.shiftReasoning) summaryHistory += `Rsn:${arg.shiftReasoning}\n`; } summaryHistory += "\n"; });
        summaryHistory += `Final AI Stance: ${finalStance.toFixed(1)}/10\nPoints Earned by User: ${pointsEarned?.toFixed(1) ?? 0}\n`;

        // Call LLM
        const completion = await openai.chat.completions.create({
            model: summaryModel, // Use separate model if defined
            messages: [
                { role: "system", content: `You are an AI assistant writing an analytical summary... Focus on final stance reasoning, opposing views, influential arguments...` /* Shortened Prompt */ },
                { role: "user", content: summaryHistory }
            ],
            temperature: 0.6
        });
        const summaryText = completion.choices[0]?.message?.content?.trim() || "[Summary generation failed]";

        // Save summary using Prisma client initialized in this file
        await prisma.debate.update({
            where: { debateId },
            data: { status: 'completed', completedAt: new Date(), summaryArticle: summaryText, finalStance: finalStance }
        });
        console.log(`Summary saved for debate ${debateId}.`);
    } catch (error: unknown) {
        console.error(`Failed to generate or save summary for debate ${debateId}:`, error);
        try {
            // Attempt to mark as failed, get final stance if possible
            const lastArg = await prisma.argument.findFirst({ where: { debateId }, orderBy: { turnNumber: 'desc' } });
            await prisma.debate.update({ where: { debateId }, data: { status: 'summary_failed', completedAt: new Date(), finalStance: lastArg?.stanceAfter } });
        } catch (updateError) {
            console.error(`Failed to update debate status after summary failure for debate ${debateId}:`, updateError);
        }
    } finally {
        // Handle prisma client connection if needed, e.g., in serverless environments
        // await prisma.$disconnect();
    }
}