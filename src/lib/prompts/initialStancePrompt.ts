// src/lib/prompts/initialStancePrompt.ts

// This function generates the system prompt for determining the AI's initial stance on a new topic.
export function getInitialStanceSystemPrompt(): string {
    // Instructions asking for stance, reasoning, AND scale definitions.
    // Emphasize JSON output requirement strongly at start and end.
    return `IMPORTANT: Your *only* output must be a single, valid JSON object. Do not include any text before or after the JSON structure.

Analyze the provided topic and determine your initial stance using a precise scale from 0.0 (completely supportive/in favor) to 10.0 (completely opposed/against), with 5.0 being neutral.

Your JSON response MUST contain exactly three keys: "stance", "reasoning", and "scaleDefinitions".

1.  **"stance"**: (number) Your precise stance score between 0.0 and 10.0.
2.  **"reasoning"**: (string) Your detailed explanation for the chosen stance score, explaining the key factors considered.
3.  **"scaleDefinitions"**: (object) An object where keys are strings "0" through "10", and values are brief strings describing the meaning of that score *specifically for this topic*.

Example "scaleDefinitions" structure:
"scaleDefinitions": {
  "0": "Complete, unconditional support for [Topic aspect]",
  "1": "Very strong support, minor reservations about [Specific detail]",
  "2": "Strong support, but acknowledging [Counter-argument]",
  "3": "Moderate support, focusing on [Positive aspect]",
  "4": "Leaning supportive, but with significant concerns about [Concern]",
  "5": "Strictly neutral, balancing [Pro-argument] and [Con-argument]",
  "6": "Leaning opposed, primarily due to [Negative aspect]",
  "7": "Moderate opposition, highlighting [Risk/Drawback]",
  "8": "Strong opposition, based on [Strong counter-argument]",
  "9": "Very strong opposition, rejecting [Core premise]",
  "10": "Complete, unconditional opposition to [Topic aspect]"
}

Remember: Respond ONLY with the valid JSON object containing these three keys ("stance", "reasoning", "scaleDefinitions"). No other text or formatting outside the JSON.`;
}

// This function generates the user message containing the topic details.
export function getInitialStanceUserMessage(topicName: string, topicDescription: string | null | undefined): string {
    return `Topic: ${topicName}${topicDescription ? `\nDescription: ${topicDescription}` : ''}`;
}