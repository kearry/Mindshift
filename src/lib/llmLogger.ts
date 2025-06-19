import fs from 'fs';
import path from 'path';

const logFilePath = path.join(process.cwd(), 'LLMLog.md');

export async function logLLMInteraction(provider: string, model: string, request: string, response: string) {
  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n**Provider:** ${provider}\n**Model:** ${model}\n### Request\n\n\`\`\`\n${request}\n\`\`\`\n### Response\n\n\`\`\`\n${response}\n\`\`\`\n`;
  await fs.promises.appendFile(logFilePath, entry);
}
