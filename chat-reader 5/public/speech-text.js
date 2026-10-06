// Limpia SOLO el texto que se manda al lector de voz (el comentario en pantalla no se toca).
// Sin dependencias del navegador: se prueba en Node.
(function (root, factory) {
  const fn = factory();
  if (typeof module === 'object' && module.exports) module.exports = { normalizeTextForSpeech: fn };
  else root.normalizeTextForSpeech = fn;
})(typeof self !== 'undefined' ? self : this, function () {
  // Emojis comunes → palabra. El resto de emojis simplemente no se lee.
  const EMOJI = {
    es: { '😂': 'risa', '🤣': 'risa', '😹': 'risa', '😆': 'risa', '😅': 'risa', '😁': 'sonrisa', '😀': 'sonrisa', '😃': 'sonrisa', '😄': 'sonrisa', '😊': 'sonrisa', '🙂': 'sonrisa',
      '😭': 'llanto', '😢': 'tristeza', '😍': 'enamorado', '🥰': 'cariño', '😘': 'beso', '😎': 'genial', '😮': 'sorpresa', '😱': 'susto', '😡': 'enojo', '🤔': 'pensando',
      '❤': 'corazón', '🧡': 'corazón', '💛': 'corazón', '💚': 'corazón', '💙': 'corazón', '💜': 'corazón', '🖤': 'corazón', '🤍': 'corazón', '💖': 'corazón', '💕': 'corazón', '💗': 'corazón', '💓': 'corazón', '💞': 'corazón',
      '👍': 'me gusta', '👎': 'no me gusta', '👏': 'aplausos', '🙌': 'celebración', '🙏': 'gracias', '🔥': 'fuego', '🎉': 'fiesta', '🥳': 'fiesta', '💪': 'fuerza', '👀': 'ojos', '💀': 'calavera', '😴': 'sueño', '🤯': 'asombro', '✨': 'brillos', '🌹': 'rosa', '👑': 'corona', '🎁': 'regalo', '😉': 'guiño' },
    en: { '😂': 'laughing', '🤣': 'laughing', '😹': 'laughing', '😆': 'laughing', '😅': 'laughing', '😁': 'smile', '😀': 'smile', '😃': 'smile', '😄': 'smile', '😊': 'smile', '🙂': 'smile',
      '😭': 'crying', '😢': 'sad', '😍': 'in love', '🥰': 'love', '😘': 'kiss', '😎': 'cool', '😮': 'surprise', '😱': 'shock', '😡': 'angry', '🤔': 'thinking',
      '❤': 'heart', '🧡': 'heart', '💛': 'heart', '💚': 'heart', '💙': 'heart', '💜': 'heart', '🖤': 'heart', '🤍': 'heart', '💖': 'heart', '💕': 'heart', '💗': 'heart', '💓': 'heart', '💞': 'heart',
      '👍': 'thumbs up', '👎': 'thumbs down', '👏': 'applause', '🙌': 'celebration', '🙏': 'thanks', '🔥': 'fire', '🎉': 'party', '🥳': 'party', '💪': 'strong', '👀': 'eyes', '💀': 'skull', '😴': 'sleepy', '🤯': 'mind blown', '✨': 'sparkles', '🌹': 'rose', '👑': 'crown', '🎁': 'gift', '😉': 'wink' },
  };
  const PICT = '(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator}{2})';
  const EMO_RUN = new RegExp(`(?:${PICT}(?:\\uFE0F|\\u200D${PICT}|\\p{Emoji_Modifier})*[\\s\\uFE0F]*)+`, 'gu');
  const EMO_ONE = new RegExp(PICT, 'gu');

  return function normalizeTextForSpeech(text, lang = 'es') {
    const en = lang === 'en', dict = EMOJI[en ? 'en' : 'es'];
    let t = String(text ?? '').normalize('NFC');          // NFC conserva ñ y tildes
    // 1) URLs / dominios
    t = t.replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
         .replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|me|tv|co|es|mx|gg|ly|xyz|app|info|live|link|page)(?:\/\S*)?(?![\p{L}\p{N}])/giu, ' ');
    // 2) emoticono de corazón y emojis comunes (una racha de emojis iguales se lee una sola vez)
    t = t.replace(/<3/g, ' ' + dict['❤'] + ' ');
    t = t.replace(EMO_RUN, (run) => {
      const words = [];
      for (const m of run.matchAll(EMO_ONE)) {
        const w = dict[m[0].replace(/\uFE0F/g, '')];
        if (w && words[words.length - 1] !== w) words.push(w);
      }
      return words.length ? ', ' + words.join(', ') + ', ' : ' ';
    });
    // 3) @menciones y #hashtags: se lee la palabra sin el símbolo; símbolos con significado
    t = t.replace(/[@#](?=[\p{L}\p{N}_])/gu, '')
         .replace(/&/g, en ? ' and ' : ' y ')
         .replace(/%/g, en ? ' percent' : ' por ciento')
         .replace(/\+/g, en ? ' plus ' : ' más ');
    // 4) cualquier otro símbolo raro se descarta (se conservan letras, números, tildes y puntuación básica)
    t = t.replace(/[^\p{L}\p{N}\p{M}\s.,;:!?¡¿'()-]/gu, ' ');
    t = t.replace(/(^|\s)-+(?=\s|$)/g, ' ');              // guiones sueltos
    // 5) letras exageradas: "holaaaaaa" → "holaaa"; risas: "jajajajajaja" → "jajaja"
    t = t.replace(/(\p{L})\1{3,}/gu, '$1$1$1');
    t = t.replace(/\b((?:[jh][aeiou]){2,})[jh]?(?![\p{L}\p{N}])/giu, (m, g) => g.slice(0, 6));
    // 6) puntuación repetida y espacios
    t = t.replace(/([.,;:!?¡¿])\1+/g, '$1').replace(/\s+/g, ' ');
    t = t.replace(/\s+([,.;:!?])/g, '$1').replace(/,(?:\s*,)+/g, ',').replace(/^[\s,]+/, '').replace(/[\s,]+$/, '');
    // sin letras ni números no hay nada que leer
    return /[\p{L}\p{N}]/u.test(t) ? t.trim() : '';
  };
});
