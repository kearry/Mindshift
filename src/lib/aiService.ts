// src/lib/aiService.ts - Simplified approach for Ollama
import OpenAI from 'openai';
import { Argument, PrismaClient } from '@prisma/client';
import { getOllamaRawResponse, extractJsonObject } from './ollamaService';
import { getInitialStanceSystemPrompt, getInitialStanceUserMessage } from './prompts/initialStancePrompt';
import { logLLMInteraction } from './llmLogger';

const prisma = new PrismaClient();

const openai = new OpenAI(); // Reads OPENAI_API_KEY from env

const defaultLLMProvider = process.env.DEFAULT_LLM_PROVIDER === 'ollama' ? 'ollama' : 'openai';
const defaultOpenAIModel = process.env.OPENAI_MODEL_NAME || 'gpt-4o-mini';
const defaultLLMModel = process.env.DEFAULT_LLM_MODEL || defaultOpenAIModel;
const summaryModel = process.env.OPENAI_SUMMARY_MODEL_NAME || defaultOpenAIModel;


// --- Types for getAiInitialStance ---
export interface InitialStanceInput {
    topicName: string;
    topicDescription?: string | null;
    llmProvider?: 'openai' | 'ollama';
    llmModel?: string;
}

export interface InitialStanceOutput {
    stance: number;
    reasoning: string;
    scaleDefinitions: Record<string, string> | null;
    model: string;
}

// --- Function to determine initial stance for a new topic ---
export async function getAiInitialStance(
    input: InitialStanceInput
): Promise<InitialStanceOutput> {
    const {
        topicName,
        topicDescription,
        llmProvider = defaultLLMProvider,
        llmModel = defaultLLMModel
    } = input;

    let stance = 5.0;
    let reasoning = "Default neutral stance assigned.";
    let scaleDefinitions: Record<string, string> | null = null;
    let usedModel = `${llmProvider}:${llmModel}`;

    try {
        const systemPrompt = getInitialStanceSystemPrompt();
        const userMessage = getInitialStanceUserMessage(topicName, topicDescription);

        if (llmProvider === 'openai') {
            console.log(`Calling OpenAI model ${llmModel} for initial stance...`);
            const completion = await openai.chat.completions.create({
                model: llmModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                response_format: { type: 'json_object' }
            });
            const content = completion.choices[0]?.message?.content || '{}';
            await logLLMInteraction('openai', llmModel, `System: ${systemPrompt}\nUser: ${userMessage}`, content);
            const aiResult = JSON.parse(content);
            usedModel = `openai:${llmModel}`;
            if (typeof aiResult.stance === 'number') {
                const s = parseFloat(aiResult.stance.toString());
                if (!isNaN(s)) stance = Math.max(0, Math.min(10, s));
            }
            if (typeof aiResult.reasoning === 'string' && aiResult.reasoning.trim().length > 0) {
                reasoning = aiResult.reasoning.trim();
            }
            if (aiResult.scaleDefinitions && typeof aiResult.scaleDefinitions === 'object') {
                scaleDefinitions = aiResult.scaleDefinitions as Record<string, string>;
            }
        } else if (llmProvider === 'ollama') {
            console.log(`Calling Ollama model ${llmModel} for initial stance...`);
            const response = await getOllamaRawResponse(
                llmModel,
                userMessage,
                systemPrompt
            );
            await logLLMInteraction('ollama', llmModel, `System: ${systemPrompt}\nUser: ${userMessage}`, response);
            usedModel = `ollama:${llmModel}`;
            const jsonString = extractJsonObject(response);
            if (!jsonString) {
                console.error('Failed to extract JSON from Ollama response:', response);
                throw new Error('Invalid Ollama response format');
            }
            let aiResult: any;
            try {
                aiResult = JSON.parse(jsonString);
            } catch (err) {
                console.error('Failed to parse Ollama JSON for initial stance:', err);
                throw new Error('Ollama JSON parse error');
            }

            if (typeof aiResult.stance === 'number') {
                const s = parseFloat(aiResult.stance.toString());
                if (!isNaN(s)) stance = Math.max(0, Math.min(10, s));
            }
            if (typeof aiResult.reasoning === 'string' && aiResult.reasoning.trim().length > 0) {
                reasoning = aiResult.reasoning.trim();
            }
            if (aiResult.scaleDefinitions && typeof aiResult.scaleDefinitions === 'object') {
                scaleDefinitions = aiResult.scaleDefinitions as Record<string, string>;
            }
        }
    } catch (error) {
        console.error('Error getting initial stance:', error);
        throw error;
    }

    return { stance, reasoning, scaleDefinitions, model: usedModel };
}

// --- Types for getAiDebateResponse ---
export interface AiResponseInput {
    debateTopicName: string;
    stanceBefore: number;
    debateGoalDirection: string;
    previousArguments: Argument[];
    currentArgumentText: string;
    retrievedContext: string;
    // Add LLM selection parameters
    llmProvider?: 'openai' | 'ollama';
    llmModel?: string;
}

export interface AiResponseOutput {
    aiResponseText: string;
    newStance: number;
    stanceShift: number;
    shiftReasoning: string;
    model?: string; // Track which provider and model generated the response (e.g., "openai:gpt-4o-mini")
}

// --- Function to get AI Debate Response (supports both OpenAI and Ollama) ---
export async function getAiDebateResponse(input: AiResponseInput): Promise<AiResponseOutput> {
    const {
        debateTopicName,
        stanceBefore,
        debateGoalDirection,
        previousArguments,
        currentArgumentText,
        retrievedContext,
        llmProvider = defaultLLMProvider, // Default provider from env
        llmModel = defaultLLMModel // Default model from env
    } = input;

    // Default values in case of error
    let aiResponseText: string = "[AI response generation failed]";
    let newStance: number = stanceBefore;
    let stanceShift: number = 0;
    let shiftReasoning: string = "AI Error: Could not process response.";
    // Track which provider and model were actually used
    let usedModel: string = `${llmProvider}:${llmModel}`;

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

At the end of your response, include these two lines (and ONLY these two lines) in this EXACT format:
NEW_STANCE: [number between 0-10]
REASONING: [brief explanation for your stance shift or lack thereof]

Example format:
<Your debate response text here...>

NEW_STANCE: 7.5
REASONING: The argument was somewhat persuasive but didn't fully address key concerns.

Be fair but not too easy to persuade. Require good arguments to shift your position.`;

        if (llmProvider === 'openai') {
            console.log(`Calling OpenAI model ${llmModel}...`);
            const completion = await openai.chat.completions.create({
                model: llmModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: currentArgumentText }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            });

            // Parse OpenAI response
            const content = completion.choices[0]?.message?.content || '{}';
            await logLLMInteraction('openai', llmModel, `System: ${systemPrompt}\nUser: ${currentArgumentText}`, content);
            const aiResult = JSON.parse(content);
            usedModel = `openai:${llmModel}`; // Track provider and model used

            // Get AI response text
            aiResponseText = aiResult.aiResponse || "[AI failed to generate a response]";

            // Get and validate new stance
            const potentialStance = parseFloat(aiResult.newStance);
            if (!isNaN(potentialStance)) {
                newStance = Math.max(0, Math.min(10, potentialStance));
            }

            // Get reasoning for the shift
            shiftReasoning = aiResult.reasoning || "[No reasoning provided]";

        } else if (llmProvider === 'ollama') {
            console.log(`Calling Ollama model ${llmModel} with simplified approach...`);

            // Use the simpler approach for Ollama - get raw text
            const response = await getOllamaRawResponse(
                llmModel,
                currentArgumentText,
                systemPrompt
            );
            await logLLMInteraction('ollama', llmModel, `System: ${systemPrompt}\nUser: ${currentArgumentText}`, response);

            usedModel = `ollama:${llmModel}`;

            // Extract the stance and reasoning
            const stanceMatch = response.match(/NEW_STANCE:\s*(\d+(\.\d+)?)/);
            const reasoningMatch = response.match(/REASONING:\s*(.+?)(\n|$)/);

            // Extract stance if found
            if (stanceMatch && stanceMatch[1]) {
                const extractedStance = parseFloat(stanceMatch[1]);
                if (!isNaN(extractedStance)) {
                    newStance = Math.max(0, Math.min(10, extractedStance));
                }
            }

            // Extract reasoning if found
            if (reasoningMatch && reasoningMatch[1]) {
                shiftReasoning = reasoningMatch[1].trim();
            }

            // Remove the stance and reasoning lines from the response text
            let cleanedResponse = response;
            if (stanceMatch) {
                cleanedResponse = cleanedResponse.replace(/NEW_STANCE:\s*(\d+(\.\d+)?)(\n|$)/, '');
            }
            if (reasoningMatch) {
                cleanedResponse = cleanedResponse.replace(/REASONING:\s*(.+?)(\n|$)/, '');
            }

            // Trim any extra whitespace
            aiResponseText = cleanedResponse.trim();

            // Fallback if response is empty
            if (!aiResponseText) {
                aiResponseText = response;
            }
        }

        // Calculate stance shift
        stanceShift = newStance - stanceBefore;

        console.log(`${llmProvider} response: Stance changed from ${stanceBefore} to ${newStance}. Shift: ${stanceShift.toFixed(2)}`);

    } catch (aiError: unknown) {
        console.error(`${llmProvider} call failed in aiService:`, aiError);
        shiftReasoning = `AI Error: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`;
    }

    return { aiResponseText, newStance, stanceShift, shiftReasoning, model: usedModel };
}

// Other functions remain unchanged
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
        await logLLMInteraction('openai', summaryModel, `System: ${systemPrompt}\nUser: ${summaryHistory}`, completion.choices[0]?.message?.content || '');

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