import "dotenv/config";
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { createBatcher } from "./batcher.js";
import { transcribeAudioMessage } from "./transcribe.js";
import { summarize } from "./summarize.js";

const config = {
  whisperBin: process.env.WHISPER_BIN || "./whisper.cpp/build/bin/whisper-cli",
  whisperModel: process.env.WHISPER_MODEL || "./whisper.cpp/models/ggml-base.bin",
  whisperLang: process.env.WHISPER_LANG || "pt",
  ollamaUrl: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.2:3b-instruct-q4_K_M",
  debounceMs: Number(process.env.DEBOUNCE_MS || 8000),
};

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// IDs das mensagens que o próprio bot enviou, para não reprocessar as
// respostas dele mesmo quando elas aparecem em messages.upsert.
const sentIds = new Set();

function hasAudio(msg) {
  return Boolean(msg.message?.audioMessage);
}

// Só tratamos texto como "conteúdo pra resumir" quando é encaminhado — texto
// digitado na hora, numa conversa normal, é ignorado. Isso é o que permite o
// bot rodar no número pessoal sem responder a toda mensagem trocada com
// qualquer contato. Mensagens encaminhadas chegam como extendedTextMessage
// com contextInfo.isForwarded; texto digitado normalmente chega como
// `conversation` (string simples), sem essa marcação.
function extractForwardedText(msg) {
  const ext = msg.message?.extendedTextMessage;
  if (ext?.contextInfo?.isForwarded && ext.text) return ext.text;
  return null;
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    syncFullHistory: false,
  });

  // WhatsApp pode endereçar o chat "Mensagem para você mesmo" tanto pelo JID
  // clássico (numero@s.whatsapp.net) quanto pelo novo @lid (migração de
  // privacidade do WhatsApp) — guardamos os dois para reconhecer o self-chat.
  let selfJids = new Set();

  const batcher = createBatcher({
    debounceMs: config.debounceMs,
    onFlush: async (jid, items) => {
      const joined = items.map((i) => i.text).join("\n\n---\n\n");
      logger.info({ jid, count: items.length }, "Gerando resumo do lote recebido");

      let summary;
      try {
        summary = await summarize(joined, config);
      } catch (err) {
        logger.error(err, "Falha ao chamar o Ollama");
        summary = "(não foi possível gerar o resumo — veja os logs do bot)";
      }

      const reply =
        `📝 *Transcrição/Conteúdo:*\n${joined}\n\n` +
        `📌 *Resumo:*\n${summary}`;

      const sent = await sock.sendMessage(jid, { text: reply });
      if (sent?.key?.id) sentIds.add(sent.key.id);
    },
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nEscaneie o QR code abaixo com o WhatsApp (Aparelhos conectados > Conectar um aparelho):\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      const jids = [jidNormalizedUser(sock.user.id)];
      if (sock.user.lid) jids.push(jidNormalizedUser(sock.user.lid));
      selfJids = new Set(jids);
      logger.info({ selfJids: [...selfJids] }, "Conectado ao WhatsApp — aceitando mensagens de qualquer contato");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : undefined;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode }, "Conexão encerrada");
      if (shouldReconnect) {
        start().catch((err) => logger.error(err, "Falha ao reconectar"));
      } else {
        logger.error("Sessão deslogada. Apague a pasta auth/ e escaneie o QR novamente.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.id && sentIds.has(msg.key.id)) {
          sentIds.delete(msg.key.id);
          continue;
        }

        // Fora do self-chat, só processamos o que os OUTROS mandam pra você —
        // uma mensagem que você mesmo manda pra um amigo não deve gerar uma
        // resposta do bot dentro dessa conversa.
        const isSelfChat = selfJids.has(msg.key.remoteJid);
        if (!isSelfChat && msg.key.fromMe) continue;

        if (hasAudio(msg)) {
          logger.info({ jid: msg.key.remoteJid }, "Transcrevendo áudio recebido");
          const text = await transcribeAudioMessage(msg, { logger, ...config });
          batcher.add(msg.key.remoteJid, { text: `🎧 ${text}` });
          continue;
        }

        const text = extractForwardedText(msg);
        if (text) {
          batcher.add(msg.key.remoteJid, { text });
        }
      } catch (err) {
        logger.error(err, "Erro processando mensagem recebida");
      }
    }
  });
}

start().catch((err) => {
  console.error("Falha ao iniciar o bot:", err);
  process.exit(1);
});
