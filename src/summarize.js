import { buildSummaryPrompt } from "./prompt.js";

// keep_alive: 0 faz o Ollama descarregar o modelo da RAM logo após a resposta,
// importante numa VPS com pouca memória onde whisper.cpp também precisa rodar.
// temperature baixa reduz a variação entre respostas pro mesmo tipo de conteúdo.
export async function summarize(content, { ollamaUrl, ollamaModel, ollamaTemperature }) {
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      prompt: buildSummaryPrompt(content),
      stream: false,
      keep_alive: 0,
      options: {
        temperature: ollamaTemperature,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama respondeu ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response.trim();
}
