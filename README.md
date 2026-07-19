# transcript-bot

Bot de WhatsApp que roda no seu número pessoal e transcreve áudios e resume
conversas encaminhadas — tanto no seu próprio chat "Mensagem para você
mesmo" quanto vindo de qualquer outro contato (seus amigos podem usar
diretamente, sem você precisar encaminhar nada).

A transcrição de áudio (`whisper.cpp`) roda 100% local e grátis. O resumo é
gerado, por padrão, pela API do **Groq** usando a camada grátis (sem
cartão) — mas isso depende da conta/região não ter restrição de cota
(Gemini, por exemplo, pode retornar `limit: 0` dependendo da conta). Também
dá pra trocar pra Gemini, Ollama (100% local) ou Claude (paga, melhor
qualidade) via `.env`. Todos usam o mesmo prompt estruturado (formato fixo +
exemplo) pra dar mais consistência às respostas. Pensado para rodar numa VPS
modesta (2 vCPU / 4 GB RAM, sem GPU).

Usa [Baileys](https://github.com/WhiskeySockets/Baileys), uma biblioteca
**não-oficial** que fala o protocolo do WhatsApp Web/multi-device — não é a
API oficial da Meta. Funciona bem para uso pessoal, mas está fora dos termos
de uso do WhatsApp; use com moderação (não é um bot de disparo em massa).
Como roda no seu número pessoal, há risco (baixo, mas real) de o WhatsApp
identificar comportamento automatizado.

## Como funciona

1. Qualquer contato (incluindo você mesmo, no chat "Mensagem para você
   mesmo") manda um áudio, ou encaminha uma ou várias mensagens de uma
   conversa, diretamente pro seu número.
2. O bot decide o que processar:
   - **Áudio** → sempre transcrito, não importa quem mandou (baixa, converte
     pra wav, roda `whisper.cpp`).
   - **Texto** → só é processado se for **encaminhado** (o WhatsApp marca
     mensagens encaminhadas). Texto digitado normalmente, numa conversa
     comum, é ignorado — isso evita que o bot tente "resumir" seu papo do
     dia a dia com os contatos.
   - Mensagens que **você mesmo** manda para outra pessoa (fora do seu
     self-chat) também são ignoradas, pelo mesmo motivo.
3. Como mensagens encaminhadas chegam uma a uma, o bot **agrupa** tudo que
   chegar dentro de uma janela de inatividade (padrão 8s, configurável, por
   chat) antes de gerar o resumo — assim uma conversa inteira vira um resumo
   só, não um por mensagem.
4. Gera o resumo em português — via Groq (padrão, nuvem grátis), Gemini,
   Ollama (local) ou Claude (nuvem, paga), conforme `SUMMARY_PROVIDER` no
   `.env`.
5. Responde no mesmo chat (visível para quem mandou) com a
   transcrição/texto completo + o resumo.

## Deploy na VPS

Pré-requisito: Ubuntu/Debian, 2 vCPU / 4 GB RAM (testado), acesso SSH com
sudo.

```bash
git clone <url-do-seu-repo> transcript-bot
cd transcript-bot
bash scripts/setup-vps.sh
```

O script instala ffmpeg, Node.js 20, compila o `whisper.cpp`, baixa o modelo
`ggml-base` (transcrição) e instala o Ollama + baixa o modelo
`llama3.2:3b-instruct-q4_K_M` (resumo local, caso você opte por ele). Ao
final ele cria o `.env` a partir do `.env.example` — os caminhos padrão já
batem com o que o script gera.

Por padrão o `.env` vem configurado com `SUMMARY_PROVIDER=groq`. Pra
funcionar, gere uma chave grátis em
[console.groq.com/keys](https://console.groq.com/keys) e preencha
`GROQ_API_KEY` no `.env` da VPS (crie a chave direto lá, não cole a chave
numa conversa de chat). Se preferir tudo 100% local (sem depender de
internet/API externa pro resumo), mude `SUMMARY_PROVIDER=ollama`. Se quiser
pagar por uma qualidade melhor, `SUMMARY_PROVIDER=claude` (ver seção
[Configuração](#configuração)).

### Subir como serviço (systemd)

```bash
sudo cp deploy/transcript-bot.service /etc/systemd/system/transcript-bot.service
sudo nano /etc/systemd/system/transcript-bot.service   # ajuste User= e WorkingDirectory=
sudo systemctl daemon-reload
sudo systemctl enable --now transcript-bot
```

### Primeiro login (escanear o QR)

```bash
journalctl -u transcript-bot -f
```

Um QR code vai aparecer no log. No WhatsApp do celular: **Aparelhos
conectados > Conectar um aparelho** e escaneie. As credenciais ficam salvas
em `auth/` (fica no disco da VPS) — não precisa escanear de novo a menos que
desconecte a sessão.

## Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `WHISPER_BIN` | `./whisper.cpp/build/bin/whisper-cli` | Binário compilado do whisper.cpp |
| `WHISPER_MODEL` | `./whisper.cpp/models/ggml-base.bin` | Modelo de transcrição |
| `WHISPER_LANG` | `pt` | Idioma forçado na transcrição (`auto` para detectar) |
| `SUMMARY_PROVIDER` | `groq` | `groq`, `gemini` (nuvem, grátis), `ollama` (local, grátis) ou `claude` (nuvem, paga) |
| `GROQ_API_KEY` | (vazio) | Chave grátis (console.groq.com/keys) — só necessária se `SUMMARY_PROVIDER=groq` |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Modelo Groq usado no resumo |
| `GEMINI_API_KEY` | (vazio) | Chave grátis (aistudio.google.com/apikey) — só necessária se `SUMMARY_PROVIDER=gemini` |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo Gemini usado no resumo |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Endpoint do Ollama — só usado se `SUMMARY_PROVIDER=ollama` |
| `OLLAMA_MODEL` | `llama3.2:3b-instruct-q4_K_M` | Modelo local usado no resumo — só usado se `SUMMARY_PROVIDER=ollama` |
| `OLLAMA_TEMPERATURE` | `0.3` | Mais baixo = respostas mais consistentes entre chamadas parecidas |
| `ANTHROPIC_API_KEY` | (vazio) | Chave da API da Anthropic — só necessária se `SUMMARY_PROVIDER=claude` |
| `CLAUDE_MODEL` | `claude-opus-4-8` | Modelo Claude usado no resumo |
| `DEBOUNCE_MS` | `8000` | Janela de agrupamento das mensagens encaminhadas |

**Sobre a consistência do resumo**: modelos menores seguem instruções
soltas de forma inconsistente. O prompt compartilhado em
[src/prompt.js](src/prompt.js) (usado por todos os provedores) define um
**formato de saída fixo** (`RESUMO` / `PONTOS-CHAVE` / `TOM`) mais um
**exemplo completo** (few-shot) pra ancorar o estilo. No Ollama,
`OLLAMA_TEMPERATURE` baixo (0.3) reduz ainda mais a variação entre respostas
parecidas. Groq, Gemini e Claude tendem a seguir o formato com mais
consistência que o Ollama (modelo local de 3B), por serem modelos maiores.

**Limites da camada grátis**: tanto Groq quanto Gemini têm limite de
requisições por minuto/dia na camada grátis, e o Gemini também pode negar a
cota grátis inteira dependendo da conta/região (retorna `limit: 0` em vez de
"cota esgotada" — nesse caso não adianta esperar, é preciso trocar de
provedor ou ativar faturamento). Pro volume de um bot pessoal isso costuma
bastar no Groq, mas se aparecer erro de `429` nos logs, espere um pouco ou
troque `SUMMARY_PROVIDER` temporariamente.

## Ajustando para os recursos da sua VPS (4 GB RAM)

Com `SUMMARY_PROVIDER=groq`, `gemini` ou `claude`, o resumo roda na nuvem —
só o `whisper.cpp` consome recursos da VPS, então a pressão de RAM é bem
menor. As dicas abaixo valem pra quem usa `SUMMARY_PROVIDER=ollama`.

- O modelo `ggml-base` do whisper (~148 MB) e o `llama3.2:3b-instruct-q4_K_M`
  (~2 GB) foram escolhidos para caber com folga em 4 GB de RAM, rodando um de
  cada vez (nunca transcrição e resumo local em paralelo).
- Se a transcrição estiver com qualidade ruim e sobrar RAM/CPU nos testes,
  troque para o modelo `small`:
  ```bash
  bash whisper.cpp/models/download-ggml-model.sh small
  # depois, no .env:
  WHISPER_MODEL=./whisper.cpp/models/ggml-small.bin
  ```
- Se o processo tomar OOM (ver `dmesg | grep -i oom` ou `journalctl -u transcript-bot`
  com o processo morrendo sem motivo aparente), troque o LLM por um menor:
  ```bash
  ollama pull qwen2.5:1.5b-instruct
  # no .env:
  OLLAMA_MODEL=qwen2.5:1.5b-instruct
  ```
- Monitore com `htop` ou `free -h` durante um teste real (mandando um áudio)
  pra ver o pico de uso.

## Testando

1. Depois do serviço no ar e do QR escaneado, abra "Mensagem para você
   mesmo" no WhatsApp e mande um áudio. Em alguns segundos deve chegar a
   transcrição + resumo.
2. Encaminhe várias mensagens de uma conversa de uma vez — confirme que
   chega **um resumo só**, agrupando tudo (respeitando a janela de
   `DEBOUNCE_MS`).
3. Peça pra um amigo mandar um áudio direto pro seu número — deve funcionar
   igual ao self-chat, respondendo na conversa com ele.
4. Manda uma mensagem de texto normal (não encaminhada) pra alguém, ou peça
   pra um amigo te mandar um "oi" comum — confirme que o bot **não**
   responde nesse caso (só áudio e texto encaminhado geram resposta).
5. Acompanhe os logs em tempo real com `journalctl -u transcript-bot -f`
   caso algo não volte.

## Rodando localmente (sem VPS) para desenvolvimento

Requer `node`, `ffmpeg`, `whisper.cpp` compilado e `ollama` instalados na
máquina local. Depois:

```bash
npm install
cp .env.example .env   # ajuste os caminhos dos binários/modelos
npm start
```

## Troubleshooting

- **QR não aparece / sessão cai direto**: apague a pasta `auth/` e reinicie
  o serviço para gerar um QR novo.
- **`ffmpeg: command not found`**: rode `scripts/setup-vps.sh` de novo ou
  instale manualmente com `sudo apt-get install ffmpeg`.
- **Resumo demora muito**: com `SUMMARY_PROVIDER=ollama`, é normal em CPU
  sem GPU — um resumo curto com o modelo de 3B costuma levar alguns segundos
  a ~1 minuto num 2 vCPU. Se for inaceitável, troque para `groq`/`gemini`/
  `claude` ou para um modelo Ollama menor (ver seção acima).
- **Erro de autenticação com o Claude** (`AuthenticationError` /
  `401` nos logs): confira se `ANTHROPIC_API_KEY` está preenchida
  corretamente no `.env` da VPS e reinicie o serviço.
- **Erro `401`/chave inválida com o Groq**: confira se `GROQ_API_KEY` está
  preenchida e é uma chave válida gerada em
  [console.groq.com/keys](https://console.groq.com/keys).
- **Erro `400`/chave inválida com o Gemini**: confira se `GEMINI_API_KEY`
  está preenchida e é uma chave válida gerada em
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- **Erro `429`** (Groq ou Gemini): estourou o limite da camada grátis
  (requisições por minuto/dia) — espere um pouco ou troque
  `SUMMARY_PROVIDER` temporariamente. No Gemini, se o erro mostrar
  `limit: 0` em vez de um número de cota consumida, é restrição de
  conta/região, não uso — esperar não resolve, só trocar de provedor ou
  ativar faturamento.
- **Bot responde ao próprio resumo em loop**: não deveria acontecer — o
  código ignora mensagens cujo ID foi gerado pelo próprio bot
  (`src/index.js`, `sentIds`). Se acontecer, abra uma issue com o log.
