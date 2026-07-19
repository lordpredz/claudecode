// Agrupa itens (texto ou transcrição de áudio) recebidos em rajada no mesmo
// chat, e só dispara o processamento depois de `debounceMs` de inatividade.
// Isso é necessário porque o WhatsApp encaminha uma "conversa" como várias
// mensagens separadas, não como um bloco único.
export function createBatcher({ debounceMs, onFlush }) {
  const buffers = new Map();

  function add(jid, item) {
    let buf = buffers.get(jid);
    if (!buf) {
      buf = { items: [], timer: null };
      buffers.set(jid, buf);
    }
    buf.items.push(item);
    clearTimeout(buf.timer);
    buf.timer = setTimeout(() => flush(jid), debounceMs);
  }

  async function flush(jid) {
    const buf = buffers.get(jid);
    if (!buf) return;
    buffers.delete(jid);
    try {
      await onFlush(jid, buf.items);
    } catch (err) {
      console.error(`Erro ao processar lote do chat ${jid}:`, err);
    }
  }

  return { add };
}
