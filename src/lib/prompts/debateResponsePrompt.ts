// src/lib/prompts/debateResponsePrompt.ts

import type { Argument as PrismaArgument, User as PrismaUser } from '@prisma/client';

type ArgumentWithUser = PrismaArgument & {
    user: Pick<PrismaUser, 'userId' | 'username' | 'displayName'> | null;
};

export function getDebateResponseSystemPrompt(
    debateTopicName: string,
    stanceBefore: number,
    debateGoalDirection: string, // We'll ignore this parameter
    previousArguments: ArgumentWithUser[],
    retrievedContext: string
): string {

    const argumentHistory = previousArguments.length > 0
        ? previousArguments.map(arg => {
            const userIdentifier = arg.user?.displayName || arg.user?.username || 'User';
            return `${userIdentifier}: ${arg.argumentText}\nYour response: ${arg.aiResponse || '(pending)'}`;
        }).join('\n\n---\n\n')
        : 'This is the first argument.';

    return `You're discussing: "${debateTopicName}"

Your current position: ${stanceBefore}/10 (0=strongly support, 10=strongly oppose)

Previous discussion:
${argumentHistory}

${retrievedContext ? `\nRelevant context:\n${retrievedContext}` : ''}

The user will present an argument. Evaluate it honestly:
- Does it present new, valid information?
- Is the logic sound?
- Does it address weaknesses in your position or strengthen theirs?

Based on your evaluation, your stance may shift, stay the same, or even move in the opposite direction if the argument backfires.

Respond with JSON:
- "response": Your natural reply to their argument
- "new_stance": Your updated position (0-10)
- "reasoning": Brief explanation of any stance change

Be genuine in your evaluation. Strong arguments should move you; weak ones shouldn't.`;
}