import { buildSummaryPrompt } from "./prompt.js";

// Usa a API REST direto (fetch), sem SDK extra — mesmo padrão do
// summarize.js (Ollama). Chave grátis em aistudio.google.com/apikey.
export async function summarizeGemini(content, { geminiApiKey, geminiModel }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildSummaryPrompt(content) }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini respondeu ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Resposta do Gemini sem texto: ${JSON.stringify(data)}`);
  }
  return text.trim();
}
