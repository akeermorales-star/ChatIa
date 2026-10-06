// Filtros de LECTURA por voz y selección de voces. Nada de esto afecta lo que se muestra en el chat.
// Sin dependencias del navegador: se prueba en Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChatFilters = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------- filtros de lectura ----------
  // Devuelve el texto SIN el comando, o null si el comentario no empieza por el comando (o no queda nada que leer).
  function stripCommand(text, command) {
    const cmd = String(command || '').trim() || '/';          // campo vacío → "/"
    const t = String(text || '').trim();
    if (t.slice(0, cmd.length).toLowerCase() !== cmd.toLowerCase()) return null;
    const rest = t.slice(cmd.length);
    // un comando que termina en letra/número ("!leer") debe ir seguido de espacio o del final: "!leerme" no cuenta
    if (/[\p{L}\p{N}]$/u.test(cmd) && /^[\p{L}\p{N}]/u.test(rest)) return null;
    return rest.trim() || null;
  }
  // Devuelve el texto candidato a leer, o null si NO debe leerse. Deben cumplirse TODOS los filtros activos.
  function readFilter(text, { mode = 'all', command = '/', donorsOnly = false, isDonor = false } = {}) {
    if (donorsOnly && !isDonor) return null;
    const t = String(text || '').trim();
    if (mode === 'cmd') return stripCommand(t, command);
    return t;
  }

  // ---------- selección de voces (máx. 5: hasta 3 en español + 2 en inglés) ----------
  // Voces "de novedad" de macOS (efectos de sonido, no personas): no sirven para leer comentarios.
  const NOVELTY = new Set(['albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged', 'good news',
    'hysterical', 'jester', 'organ', 'pipe organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox']);
  const lang = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
  const isEs = (v) => /^es(-|$)/.test(lang(v));
  const isEn = (v) => /^en(-|$)/.test(lang(v));
  // "Eddy (Español (México))" y "Eddy (Español (España))" son la misma voz → una sola entrada
  const baseName = (v) => String(v.name || '').replace(/\s*[(\[].*$/, '').trim().toLowerCase();
  const sameVoice = (c, v) => !!c && ((c.uri && v.voiceURI === c.uri) || (c.name && v.name === c.name));

  function pickFrom(list, n, chosen, preferred) {
    const out = [], used = new Set(), rest = list.slice();
    while (out.length < n && rest.length) {
      let bi = 0, bs = Infinity;
      rest.forEach((v, i) => {
        // menor puntaje = mejor: la voz guardada, luego una variante regional distinta, luego (si hay) las regiones preferidas,
        // y después las voces locales del dispositivo (menos latencia) y la predeterminada.
        const s = (sameVoice(chosen, v) ? 0 : 100) + (used.has(lang(v)) ? 10 : 0) + (preferred && !preferred.includes(lang(v)) ? 5 : 0)
          + (v.localService ? 0 : 2) + (v.default ? 0 : 1);
        if (s < bs) { bs = s; bi = i; }
      });
      const [v] = rest.splice(bi, 1); out.push(v); used.add(lang(v));
    }
    return out;
  }

  // voices = speechSynthesis.getVoices(). Devuelve [{voice, flag}] (solo voces reales; nunca inventa ninguna).
  function pickVoices(voices, { chosen = null, max = 5 } = {}) {
    const seen = new Set(), uniq = [];
    const ordered = (voices || []).slice().sort((a, b) => (sameVoice(chosen, b) ? 1 : 0) - (sameVoice(chosen, a) ? 1 : 0)
      || String(a.name).localeCompare(String(b.name), 'es'));   // la guardada primero: si hay duplicados, gana esa
    for (const v of ordered) {
      const b = baseName(v);
      if (!b || NOVELTY.has(b) || !(isEs(v) || isEn(v)) || seen.has(b)) continue;
      seen.add(b); uniq.push(v);
    }
    const es = uniq.filter(isEs), en = uniq.filter(isEn);
    let nEs = Math.min(es.length, 3), nEn = Math.min(en.length, 2);
    if (nEs < 3) nEn = Math.min(en.length, max - nEs);          // faltan españolas → se completa con inglesas
    else if (nEn < 2) nEs = Math.min(es.length, max - nEn);     // faltan inglesas → se completa con españolas
    return [
      ...pickFrom(es, nEs, chosen, ['es-es', 'es-mx', 'es-us']).map((voice) => ({ voice, flag: '🇪🇸' })),
      ...pickFrom(en, nEn, chosen, ['en-us', 'en-gb']).sort((a, b) => (lang(a) === 'en-gb') - (lang(b) === 'en-gb')).map((voice) => ({ voice, flag: lang(voice) === 'en-gb' ? '🇬🇧' : '🇺🇸' })),
    ].slice(0, max);
  }
  return { stripCommand, readFilter, pickVoices };
});
