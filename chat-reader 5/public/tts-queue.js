// Cola de voz con control de antigüedad. Sin dependencias del navegador: se prueba en Node.
// Cada item: { id?, text, receivedAt }  (receivedAt = Date.now() cuando llegó el comentario)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TtsQueue = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function create({ getLimits, now = Date.now, log = () => {}, onDrop = () => {} }) {
    const items = [];
    const seen = new Set();      // ids ya recibidos: nunca se vuelve a leer el mismo comentario
    const seenOrder = [];
    const remember = (id) => {
      seen.add(id); seenOrder.push(id);
      if (seenOrder.length > 1000) seen.delete(seenOrder.shift());
    };
    const ageOf = (it) => now() - it.receivedAt;

    return {
      // Devuelve false si el id ya se había recibido.
      push(item) {
        if (item.id) { if (seen.has(item.id)) return false; remember(item.id); }
        items.push(item);
        const { maxQueue } = getLimits();
        while (items.length > maxQueue) {            // cola llena: se pierde el MÁS ANTIGUO
          const d = items.shift();
          log('[TTS] Cola llena, eliminando comentario antiguo');
          onDrop(d, 'full');
        }
        return true;
      },
      // Quita de la cabeza los que ya superaron la antigüedad máxima (están ordenados por llegada).
      prune() {
        const { maxAge } = getLimits();
        while (items.length && ageOf(items[0]) > maxAge) {
          const d = items.shift();
          log(`[TTS] Comentario descartado por antigüedad: ${(ageOf(d) / 1000).toFixed(1)}s`);
          onDrop(d, 'age');
        }
      },
      // Siguiente comentario legible (ya sacado de la cola) o null.
      next() {
        this.prune();
        const it = items.shift() || null;
        if (it) log(`[TTS] Leyendo comentario recibido hace: ${(ageOf(it) / 1000).toFixed(1)}s`);
        return it;
      },
      // ¿Sigue siendo válido un item que ya salió de la cola (p. ej. tras generar el audio)?
      isFresh(item) {
        const { maxAge } = getLimits(); const a = ageOf(item);
        if (a > maxAge) { log(`[TTS] Comentario descartado por antigüedad: ${(a / 1000).toFixed(1)}s`); onDrop(item, 'age'); return false; }
        return true;
      },
      clear() { items.length = 0; },
      clearAll() { items.length = 0; seen.clear(); seenOrder.length = 0; },
      get length() { return items.length; },
      peek() { return items.slice(); },
    };
  }
  return { create };
});
