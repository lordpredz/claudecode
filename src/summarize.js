// Modelos pequenos (3B) seguem instruções soltas de forma inconsistente —
// às vezes resumem bem, às vezes só reescrevem o texto ou adicionam
// preâmbulo. Um formato de saída fixo + um exemplo completo (few-shot)
// ancora o estilo e reduz bastante essa variação.
const INSTRUCTIONS = `Você resume mensagens de WhatsApp (áudios transcritos e conversas encaminhadas) em português do Brasil.

Responda SEMPRE exatamente neste formato, sem nada antes ou depois:

RESUMO: <1 a 2 frases, direto ao ponto>
PONTOS-CHAVE:
- <ponto 1>
- <ponto 2 (se houver)>
TOM: <uma palavra ou expressão curta, ex: pedido, dúvida, reclamação, combinado, informal, urgente, informativo>

Regras:
- Não invente informações que não estejam no texto.
- Não repita o texto original — apenas resuma.
- Não adicione saudação, introdução ("aqui está o resumo") nem comentários sobre a tarefa.
- Se o conteúdo for confuso, incompleto ou não fizer sentido, diga isso no RESUMO em vez de inventar sentido.`;

const EXAMPLE = `Exemplo:

Conteúdo:
"""
oi bom dia, então eu queria saber se dá pra adiantar a entrega pra sexta invés de segunda, porque eu vou viajar. me fala se rolar
"""

Resposta:
RESUMO: Pedido para adiantar a entrega de segunda para sexta-feira, por causa de uma viagem.
PONTOS-CHAVE:
- Quer a entrega até sexta-feira, não segunda.
- Motivo: vai viajar.
TOM: pedido`;

const buildPrompt = (content) => `${INSTRUCTIONS}

${EXAMPLE}

Agora resuma o conteúdo abaixo, seguindo exatamente o mesmo formato:

Conteúdo:
"""
${content}
"""

Resposta:`;

// keep_alive: 0 faz o Ollama descarregar o modelo da RAM logo após a resposta,
// importante numa VPS com pouca memória onde whisper.cpp também precisa rodar.
// temperature baixa reduz a variação entre respostas pro mesmo tipo de conteúdo.
export async function summarize(content, { ollamaUrl, ollamaModel, ollamaTemperature }) {
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      prompt: buildPrompt(content),
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
