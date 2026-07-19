# transcript-bot

Bot de WhatsApp que recebe áudios e mensagens encaminhadas no chat
"Mensagem para você mesmo", transcreve o áudio (whisper.cpp), resume o
conteúdo (Ollama, rodando localmente) e responde no mesmo chat com a
transcrição e o resumo.

100% local: nenhuma API paga é usada. Pensado para rodar numa VPS modesta
(2 vCPU / 4 GB RAM, sem GPU).

Usa [Baileys](https://github.com/WhiskeySockets/Baileys), uma biblioteca
**não-oficial** que fala o protocolo do WhatsApp Web/multi-device — não é a
API oficial da Meta. Funciona bem para uso pessoal, mas está fora dos termos
de uso do WhatsApp; use com moderação (não é um bot de disparo em massa).

## Como funciona

1. Você abre no seu WhatsApp o chat "Mensagem para você mesmo" e encaminha
   pra lá um áudio, ou uma ou várias mensagens de uma conversa.
2. O bot detecta as mensagens novas nesse chat:
   - Áudio → baixa, converte pra wav e transcreve com `whisper.cpp`.
   - Texto → usa o texto direto.
3. Como mensagens encaminhadas chegam uma a uma, o bot **agrupa** tudo que
   chegar dentro de uma janela de inatividade (padrão 8s, configurável) antes
   de gerar o resumo — assim uma conversa inteira vira um resumo só, não um
   por mensagem.
4. Chama o Ollama localmente pra gerar o resumo em português.
5. Responde no mesmo chat com a transcrição/texto completo + o resumo.

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
`llama3.2:3b-instruct-q4_K_M` (resumo). Ao final ele cria o `.env` a partir
do `.env.example` — os caminhos padrão já batem com o que o script gera.

Revise o `.env` se quiser mudar algo (ver seção [Configuração](#configuração)).

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
| `MONITOR_JID` | (vazio = self-chat) | JID do chat a monitorar. Deixe vazio para usar automaticamente "Mensagem para você mesmo". |
| `WHISPER_BIN` | `./whisper.cpp/build/bin/whisper-cli` | Binário compilado do whisper.cpp |
| `WHISPER_MODEL` | `./whisper.cpp/models/ggml-base.bin` | Modelo de transcrição |
| `WHISPER_LANG` | `pt` | Idioma forçado na transcrição (`auto` para detectar) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Endpoint do Ollama |
| `OLLAMA_MODEL` | `llama3.2:3b-instruct-q4_K_M` | Modelo usado no resumo |
| `DEBOUNCE_MS` | `8000` | Janela de agrupamento das mensagens encaminhadas |

## Ajustando para os recursos da sua VPS (4 GB RAM)

- O modelo `ggml-base` do whisper (~148 MB) e o `llama3.2:3b-instruct-q4_K_M`
  (~2 GB) foram escolhidos para caber com folga em 4 GB de RAM, rodando um de
  cada vez (nunca transcrição e resumo em paralelo).
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
3. Acompanhe os logs em tempo real com `journalctl -u transcript-bot -f`
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
- **Resumo demora muito**: normal em CPU sem GPU; um resumo curto com o
  modelo de 3B costuma levar alguns segundos a ~1 minuto num 2 vCPU. Se for
  inaceitável, troque para um modelo Ollama menor (ver seção acima).
- **Bot responde ao próprio resumo em loop**: não deveria acontecer — o
  código ignora mensagens cujo ID foi gerado pelo próprio bot
  (`src/index.js`, `sentIds`). Se acontecer, abra uma issue com o log.
