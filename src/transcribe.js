import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} saiu com código ${code}: ${stderr}`));
    });
  });
}

// Recebe uma mensagem de áudio do Baileys, baixa a mídia, converte para wav
// 16kHz mono (formato que o whisper.cpp espera) e roda a transcrição.
export async function transcribeAudioMessage(msg, { logger, whisperBin, whisperModel, whisperLang }) {
  const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger });
  return transcribeBuffer(buffer, { whisperBin, whisperModel, whisperLang });
}

export async function transcribeBuffer(buffer, { whisperBin, whisperModel, whisperLang }) {
  const dir = await mkdtemp(join(tmpdir(), "transcript-bot-"));
  const oggPath = join(dir, "input.ogg");
  const wavPath = join(dir, "input.wav");
  const outBase = join(dir, "output");

  try {
    await writeFile(oggPath, buffer);
    await run("ffmpeg", ["-y", "-i", oggPath, "-ar", "16000", "-ac", "1", wavPath]);

    const langArgs = whisperLang && whisperLang !== "auto" ? ["-l", whisperLang] : [];
    await run(whisperBin, [
      "-m", whisperModel,
      "-f", wavPath,
      "-otxt",
      "-of", outBase,
      "-nt",
      ...langArgs,
    ]);

    const text = await readFile(`${outBase}.txt`, "utf8");
    return text.trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
