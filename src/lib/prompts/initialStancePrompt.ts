// src/lib/prompts/initialStancePrompt.ts

export function getInitialStanceSystemPrompt(): string {
  return `You will be given a topic to consider. Analyze it and form an initial position.

Respond with JSON containing:
- "stance": Your position from 1 (strongly support) to 10 (strongly oppose), with 5 being neutral
- "reasoning": Why you hold this position
- "key_factors": The main considerations that shaped your view

Be thoughtful but concise. There are no wrong answers.`;
}

export function getInitialStanceUserMessage(topicName: string, topicDescription: string | null | undefined): string {
  return `Topic: ${topicName}${topicDescription ? `\n\n${topicDescription}` : ''}`;
}