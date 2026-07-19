import { buildSummaryPrompt } from "./prompt.js";

// API compatível com o formato da OpenAI (chat completions). Chave grátis,
// sem cartão, em console.groq.com/keys.
export async function summarizeGroq(content, { groqApiKey, groqModel }) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [{ role: "user", content: buildSummaryPrompt(content) }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq respondeu ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Resposta do Groq sem texto: ${JSON.stringify(data)}`);
  }
  return text.trim();
}
