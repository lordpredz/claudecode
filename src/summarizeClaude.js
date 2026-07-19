import Anthropic from "@anthropic-ai/sdk";
import { buildSummaryPrompt } from "./prompt.js";

// Lê ANTHROPIC_API_KEY do ambiente automaticamente.
const client = new Anthropic();

export async function summarizeClaude(content, { claudeModel }) {
  const response = await client.messages.create({
    model: claudeModel,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildSummaryPrompt(content) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text.trim() : "";
}
