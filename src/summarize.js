const buildPrompt = (content) => `Você é um assistente que resume conversas e áudios do WhatsApp em português do Brasil.

Resuma o conteúdo abaixo de forma clara e objetiva:
- Comece com um resumo geral de 2 a 3 frases.
- Depois liste os pontos-chave em tópicos, se houver mais de um assunto.
- Não invente informações que não estejam no texto.

Conteúdo:
"""
${content}
"""

Resumo:`;

// keep_alive: 0 faz o Ollama descarregar o modelo da RAM logo após a resposta,
// importante numa VPS com pouca memória onde whisper.cpp também precisa rodar.
export async function summarize(content, { ollamaUrl, ollamaModel }) {
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      prompt: buildPrompt(content),
      stream: false,
      keep_alive: 0,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama respondeu ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response.trim();
}
