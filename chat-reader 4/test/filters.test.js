import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
const ctx = { self: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../public/chat-filters.js', import.meta.url), 'utf8'), ctx);
const { stripCommand, readFilter, pickVoices } = ctx.self.ChatFilters;

// ---- comando ----
assert.equal(stripCommand('/ hola, ¿cómo estás?', '/'), 'hola, ¿cómo estás?');
assert.equal(stripCommand('/hola', '/'), 'hola');
assert.equal(stripCommand('hola, ¿cómo estás?', '/'), null);
assert.equal(stripCommand('   / hola', '/'), 'hola');
assert.equal(stripCommand('!leer hola akeer', '!leer'), 'hola akeer');
assert.equal(stripCommand('!LEER hola', '!leer'), 'hola', 'sin distinguir mayúsculas');
assert.equal(stripCommand('hola akeer', '!leer'), null);
assert.equal(stripCommand('!leerme', '!leer'), null, 'comando con letras: debe ir separado');
assert.equal(stripCommand('/', '/'), null, 'solo el comando: nada que leer');
assert.equal(stripCommand('/hola', ''), 'hola', 'campo vacío = "/"');
// ---- combinación ----
const o = (x) => ({ mode: 'cmd', command: '/', donorsOnly: true, ...x });
assert.equal(readFilter('/hola', o({ isDonor: false })), null);
assert.equal(readFilter('hola', o({ isDonor: true })), null);
assert.equal(readFilter('/hola', o({ isDonor: true })), 'hola');
assert.equal(readFilter('hola', { mode: 'all' }), 'hola');
assert.equal(readFilter('hola', { mode: 'all', donorsOnly: true, isDonor: false }), null);
assert.equal(readFilter('hola', { mode: 'all', donorsOnly: true, isDonor: true }), 'hola');

// ---- voces ----
const V = (name, lang, extra = {}) => ({ name, lang, voiceURI: name + '|' + lang, localService: true, default: false, ...extra });
const names = (r) => r.map((x) => x.voice.name);
const distinct = (r) => new Set(r.map((x) => x.voice.name.replace(/\s*\(.*$/, ''))).size === r.length;
// macOS/Safari: decenas de voces, incluidas las de novedad y duplicadas por idioma
const mac = [V('Mónica', 'es-ES', { default: true }), V('Paulina', 'es-MX'), V('Jorge', 'es-ES'), V('Juan', 'es-MX'), V('Diego', 'es-AR'),
  V('Eddy (Español (España))', 'es-ES'), V('Eddy (Español (México))', 'es-MX'), V('Samantha', 'en-US'), V('Daniel', 'en-GB'), V('Karen', 'en-AU'), V('Fred', 'en-US'),
  V('Zarvox', 'en-US'), V('Bells', 'en-US'), V('Anna', 'de-DE'), V('Amira', 'ar-001'), V('Tingting', 'zh-CN'), V('Sinji', 'zh-HK'), V('Yuna', 'ko-KR'), V('Luciana', 'pt-BR')];
let r = pickVoices(mac);
assert.equal(r.length, 5); assert.ok(distinct(r), names(r).join());
assert.equal(r.filter((x) => /^es/.test(x.voice.lang)).length, 3); assert.equal(r.filter((x) => /^en/.test(x.voice.lang)).length, 2);
assert.ok(r.every((x) => /^(es|en)/.test(x.voice.lang)), 'solo español e inglés');
assert.ok(!names(r).some((n) => ['Zarvox', 'Bells', 'Anna', 'Yuna'].includes(n)), 'sin novedad ni otros idiomas');
assert.deepEqual(Array.from(r, (x) => x.flag), ['🇪🇸', '🇪🇸', '🇪🇸', '🇺🇸', '🇬🇧']); // inglés: una US y una GB
assert.equal(r[0].voice.name, 'Mónica', 'la predeterminada va primero'); assert.notEqual(r[0].voice.lang, r[1].voice.lang, 'variantes regionales distintas');
// la voz guardada siempre está en la lista (si es es/en)
r = pickVoices(mac, { chosen: { name: 'Diego' } }); assert.ok(names(r).includes('Diego'));
r = pickVoices(mac, { chosen: { uri: 'Karen|en-AU' } }); assert.ok(names(r).includes('Karen'));
// Windows/Edge y Chrome: nombres largos, solo cuentan voces distintas
const win = [V('Microsoft Helena - Spanish (Spain)', 'es-ES'), V('Microsoft Sabina - Spanish (Mexico)', 'es-MX'), V('Microsoft Pablo - Spanish (Spain)', 'es-ES'),
  V('Microsoft David - English (United States)', 'en-US'), V('Microsoft Zira - English (United States)', 'en-US'), V('Microsoft Hazel - English (United Kingdom)', 'en-GB'), V('Microsoft Hedda - German (Germany)', 'de-DE')];
r = pickVoices(win); assert.equal(r.length, 5); assert.equal(new Set(names(r)).size, 5);
assert.deepEqual(Array.from(r, (x) => x.flag), ['🇪🇸', '🇪🇸', '🇪🇸', '🇺🇸', '🇬🇧']);
// Android usa guion bajo en el idioma
r = pickVoices([V('es-es-x-eea-local', 'es_ES'), V('en-us-x-iom-local', 'en_US')]); assert.equal(r.length, 2);
// pocas voces: solo las disponibles, nada inventado; faltan españolas → se completa con inglesas hasta 5
r = pickVoices([V('A', 'es-ES'), V('B', 'en-US'), V('C', 'en-GB'), V('D', 'en-AU'), V('E', 'en-IN'), V('F', 'en-ZA')]);
assert.equal(r.length, 5); assert.equal(r.filter((x) => /^es/.test(x.voice.lang)).length, 1);
r = pickVoices([V('A', 'es-ES'), V('B', 'es-MX'), V('C', 'es-AR'), V('D', 'es-CO'), V('E', 'es-US'), V('F', 'en-US')]);
assert.equal(r.length, 5); assert.equal(r.filter((x) => /^en/.test(x.voice.lang)).length, 1, 'falta inglés → se completa con español');
assert.equal(pickVoices([V('Anna', 'de-DE')]).length, 0); assert.equal(pickVoices([]).length, 0);
assert.equal(pickVoices([V('Solo', 'es-ES')]).length, 1);
console.log('OK: pruebas de filtros y selección de voces');
