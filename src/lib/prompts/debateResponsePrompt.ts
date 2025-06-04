// src/lib/prompts/debateResponsePrompt.ts

import type { Argument as PrismaArgument, User as PrismaUser } from '@prisma/client';

// Define the specific type for an Argument that includes User details
type ArgumentWithUser = PrismaArgument & {
    user: Pick<PrismaUser, 'userId' | 'username' | 'displayName'> | null;
};

// This function generates the detailed system prompt for the AI during a debate turn.
export function getDebateResponseSystemPrompt(
    debateTopicName: string,
    stanceBefore: number,
    debateGoalDirection: string,
    previousArguments: ArgumentWithUser[],
    retrievedContext: string
): string {

    // Format previous arguments for context
    const argumentHistory = previousArguments.map(arg => {
        const stanceBeforeText = arg.stanceBefore?.toFixed(1) ?? 'N/A';
        const stanceAfterText = arg.stanceAfter?.toFixed(1) ?? stanceBeforeText;
        const userIdentifier = arg.user?.displayName || arg.user?.username || 'User';

        let turnString = `Turn ${arg.turnNumber} (${userIdentifier}):\nArgument: ${arg.argumentText}`;
        if (arg.aiResponse) {
            turnString += `\nAI Response (Stance ${stanceBeforeText} → ${stanceAfterText}):\n${arg.aiResponse}`;
            if (arg.shiftReasoning) {
                turnString += `\nReasoning: ${arg.shiftReasoning}`;
            }
        } else {
            turnString += `\n(Awaiting AI response)`;
        }
        return turnString;

    }).join('\n\n---\n\n');

    // Strengthened Explanation of Stance and Goal
    const stanceScaleExplanation = `Your stance is on a scale from 0.0 (completely supportive of "${debateTopicName}") to 10.0 (completely opposed to "${debateTopicName}"), with 5.0 being neutral. Your current stance is ${stanceBefore.toFixed(1)}/10.`;

    let goalExplanation = '';
    if (debateGoalDirection === 'left') {
        goalExplanation = `The user's goal is 'left'. This means they are trying to persuade you *towards 0 (Support)*. You should decrease your score (move closer to 0) ONLY IF their argument convincingly supports the topic or refutes arguments against it.`;
    } else {
        goalExplanation = `The user's goal is 'right'. This means they are trying to persuade you *towards 10 (Opposition)*. You should increase your score (move closer to 10) ONLY IF their argument convincingly opposes the topic or refutes arguments for it.`;
    }

    // Corrected Example JSON String within the template literal
    const exampleJsonString = `{
  "aiResponse": "You argued that [User's Point X]. While I understand the perspective, it overlooks [Counterpoint Y/Missing Evidence Z]. Therefore, my position remains unchanged because...",
  "newStance": ${stanceBefore.toFixed(1)},
  "reasoning": "User's argument about X lacked sufficient evidence/failed to address counterpoint Y, thus not warranting a stance shift."
}`;

    // Build the final system prompt using the explanations
    const systemPrompt = `You are MindShift AI, participating in a structured debate on the topic: "${debateTopicName}".

${stanceScaleExplanation}
${goalExplanation}

RAG CONTEXT (Insights from similar past arguments, use as secondary information):
${retrievedContext || "[No additional context retrieved]"}

DEBATE HISTORY (Previous Turns):
${argumentHistory || "[This is the first argument]"}

INSTRUCTIONS FOR THIS TURN:
1.  **Analyze the User's NEW Argument:** Carefully read and understand the user's latest argument provided in the upcoming user message.
2.  **Evaluate Persuasiveness:** Assess the logic, evidence, and relevance of the user's argument specifically in relation to persuading you towards their stated goal ('left' towards Support/0 or 'right' towards Opposition/10).
3.  **Consider History & Context:** Weigh the new argument against the points made in the DEBATE HISTORY and consider if the RAG CONTEXT offers relevant parallels, but prioritize the immediate argument.
4.  **Determine Stance Shift:** Decide if the argument justifies adjusting your stance score (0.0-10.0). Shifts should be logical and proportional. A strong, relevant argument aligned with the user's goal might cause a shift; a weak or irrelevant one might cause none. Remain reasonably objective but open to genuine persuasion.
5.  **Formulate AI Response:** Craft a thoughtful response addressing the user's key points. Explain your evaluation of their argument.
6.  **Calculate New Stance:** Set your precise \`newStance\` score (between 0.0 and 10.0). This can be the same as \`stanceBefore\` if no shift occurred.
7.  **Explain Reasoning:** Provide a concise \`reasoning\` string explaining *why* your stance changed or didn't change, linking it directly to your assessment of the user's *current* argument.

RESPONSE FORMAT:
You MUST return ONLY a single, valid JSON object with the following exact keys and data types:
   - "aiResponse": (string) Your detailed textual response to the user's argument.
   - "newStance": (number) Your new stance score (0.0 to 10.0).
   - "reasoning": (string) Your concise explanation for the stance change (or lack thereof) based *only* on the user's last argument.

Example JSON Output:
${exampleJsonString}

Ensure the output is ONLY the JSON object, with no extra text before or after.`;

    return systemPrompt;
}