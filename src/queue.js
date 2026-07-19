// Serializa os jobs pesados (transcrição com whisper.cpp e resumo com
// Ollama) para nunca rodar mais de um ao mesmo tempo. Numa VPS de poucos
// recursos, rodar duas transcrições (ou uma transcrição + um resumo) em
// paralelo pode estourar a RAM e derrubar o processo do Ollama (OOM kill).
let tail = Promise.resolve();

export function enqueue(task) {
  const result = tail.then(task);
  tail = result.catch(() => {});
  return result;
}
