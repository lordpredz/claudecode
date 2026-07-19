// Formato de saída fixo (RESUMO / PONTOS-CHAVE / TOM) + um exemplo completo
// (few-shot) — usado por todos os provedores de resumo (Ollama, Claude,
// Gemini) pra manter a mesma consistência de resposta entre eles.
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

export function buildSummaryPrompt(content) {
  return `${INSTRUCTIONS}

${EXAMPLE}

Agora resuma o conteúdo abaixo, seguindo exatamente o mesmo formato:

Conteúdo:
"""
${content}
"""

Resposta:`;
}
