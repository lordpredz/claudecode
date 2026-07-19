import Anthropic from "@anthropic-ai/sdk";

// Lê ANTHROPIC_API_KEY do ambiente automaticamente.
const client = new Anthropic();

const buildPrompt = (content) => `Você é um assistente que resume conversas e áudios do WhatsApp em português do Brasil, com uma análise real do conteúdo (não apenas repetir frases soltas).

Resuma o conteúdo abaixo:
- Comece com um resumo geral de 2 a 3 frases.
- Depois liste os pontos-chave em tópicos, se houver mais de um assunto.
- Quando fizer sentido, aponte o tom/intenção da mensagem (pedido, reclamação, dúvida, combinado, etc.).
- Não invente informações que não estejam no texto.

Conteúdo:
"""
${content}
"""

Resumo:`;

export async function summarizeClaude(content, { claudeModel }) {
  const response = await client.messages.create({
    model: claudeModel,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildPrompt(content) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text.trim() : "";
}
