// src/lib/prompts/initialStancePrompt.ts

export function getInitialStanceSystemPrompt(): string {
  return `You will be given a topic to consider. Analyze it and form an initial position.

Respond with JSON containing:
- "stance": Your position from 0 (strongly support) to 10 (strongly oppose), with 5 being neutral
- "reasoning": Why you hold this position
- "scaleDefinitions": An object with keys "0" through "10", each describing what that stance level means for this specific topic. These help users understand what arguments might persuade you toward different positions.

Example scaleDefinitions format:
{
"0": "Complete support because [specific reason for this topic]",
"5": "Neutral, balancing [key trade-off for this topic]",
"10": "Complete opposition due to [specific concern for this topic]"
}

Make each definition specific to the topic, not generic.`;
}

export function getInitialStanceUserMessage(topicName: string, topicDescription: string | null | undefined): string {
  return `Topic: ${topicName}${topicDescription ? `\n\n${topicDescription}` : ''}`;
}
