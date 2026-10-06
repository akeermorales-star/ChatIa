import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
const ctx = { self: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../public/speech-text.js', import.meta.url), 'utf8'), ctx);
const n = ctx.self.normalizeTextForSpeech;
const cases = [
  ['holaaaaaaa 😂😂😂', 'holaaa, risa'],
  ['mira https://tiktok.com/@x/video/123 qué bueno', 'mira qué bueno'],
  ['visita www.miweb.com ya', 'visita ya'],
  ['¡Qué tal, niño! Está muy bueno', '¡Qué tal, niño! Está muy bueno'],
  ['te quiero ❤️❤️ mucho', 'te quiero, corazón, mucho'],
  ['jajajajajajajaja', 'jajaja'],
  ['qué????? no!!!!!', 'qué? no!'],
  ['*** ~~~ ||| ___', ''],
  ['😂😂', 'risa'],
  ['👍🔥', 'me gusta, fuego'],
  ['@maria #live genial', 'maria live genial'],
  ['50% + 20 & más', '50 por ciento más 20 y más'],
  ['   muchos    espacios  ', 'muchos espacios'],
  ['síííííííí claro', 'sííí claro'],
  ['🇲🇽 viva', 'viva'],
  ['I love it 😭😭', 'I love it, llanto'],
];
for (const [i, o] of cases) assert.equal(n(i), o, `entrada: ${i}`);
assert.equal(n('lol 😂', 'en'), 'lol, laughing');
assert.equal(n(null), '');
console.log('OK: normalizeTextForSpeech (' + (cases.length + 2) + ' casos)');
