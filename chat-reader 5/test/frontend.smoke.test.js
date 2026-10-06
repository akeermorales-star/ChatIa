// Prueba de humo del script real de index.html con un DOM/Web Speech simulados (sin navegador).
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\n([\s\S]*)<\/script><\/body>/)[1];
const speechSrc = fs.readFileSync(new URL('../public/speech-text.js', import.meta.url), 'utf8');
const queueSrc = fs.readFileSync(new URL('../public/tts-queue.js', import.meta.url), 'utf8');
const filtersSrc = fs.readFileSync(new URL('../public/chat-filters.js', import.meta.url), 'utf8');

let clock = 1_000_000; const logs = [];
const els = {};
const mk = (id) => els[id] ||= { id, value: '', checked: false, textContent: '', innerHTML: '', children: [], style: {}, dataset: {},
  addEventListener(t, f) { (this.l ||= {})[t] = f; }, insertAdjacentHTML() {}, remove() {}, options: [], scrollHeight: 0, scrollTop: 0, clientHeight: 0 };
const def = { on: [false], ll: [true], rn: [true], dd: [false], eo: [true], ml: ['140'], gap: ['0'], pm: ['0'], rate: ['1'], vol: ['1'], eng: ['browser'], voice: [''], bw: [''], mu: [''], rm_all: [true], rm_cmd: [false], cmd: ['/'], do: [false] };
for (const [k, [v]] of Object.entries(def)) { const e = mk(k); typeof v === 'boolean' ? e.checked = v : e.value = v; }
mk('chat').insertAdjacentHTML = (_, h) => chatHtml.push(h); mk('eng_wrap'); mk('cmdrow'); mk('fbody').hidden = true; mk('fbtn').setAttribute = () => {}; mk('fsec').classList = { toggle: () => true };
mk('eng').options = [{ value: 'browser' }, { value: 'server', disabled: true, textContent: '' }];

const spoken = []; let pending = null;
let fakeVoices = [];
const store = { 'chatia.voice': JSON.stringify({ name: 'Gamma' }) }; // voz guardada de una visita anterior
const synth = { speak(u) { spoken.push(u.text); lastUtt = u; pending = u; }, cancel() { pending = null; }, resume() {}, getVoices: () => fakeVoices, paused: false };
let lastUtt = null; const chatHtml = [];
const timers = []; const fire = (ms) => { const t = timers.filter(x => x.ms === ms && !x.off).pop(); assert.ok(t, 'timer ' + ms + ' pendiente'); t.off = true; t.f(); };
const ctx = { console: { log: (...a) => logs.push(a.join(' ')) }, Date: { now: () => clock }, setTimeout: (f, ms) => { timers.push({ f, ms, off: false }); return timers.length; }, setInterval: () => 0, clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].off = true; }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
  document: { getElementById: mk, querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible', body: {} },
  window: { speechSynthesis: synth, addEventListener() {} }, location: { protocol: 'https:', host: 'x' }, self: {},
  SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  Worker: undefined, WebSocket: class {}, Blob: class {}, URL: { createObjectURL: () => '' }, alert() {}, JSON, Map, Set, Promise, Object, Number, String, Array, Math, DataView, Error };
ctx.window.WebSocket = ctx.WebSocket; vm.createContext(ctx);
vm.runInContext(queueSrc, ctx); ctx.TtsQueue = ctx.self.TtsQueue;
vm.runInContext(speechSrc, ctx); ctx.normalizeTextForSpeech = ctx.self.normalizeTextForSpeech;
vm.runInContext(filtersSrc, ctx); ctx.ChatFilters = ctx.self.ChatFilters;
vm.runInContext(script + '\n;globalThis.__t={enqueue,pump,tick,queue,speakNow,onEvent,loadVoices,save};', ctx);
const T = ctx.__t;
const finish = () => { const u = pending; pending = null; u.onend(); };

// activar lector (enabledAt) y avanzar el reloj para que los mensajes sean "posteriores"
els.on.checked = true; els.on.l.change(); finish();   // termina el "Lector activado"
vm.runInContext("status('connected','@x')", ctx); clock += 3500; spoken.length = 0; // fin del periodo de gracia tras conectar
// ráfaga de 20 comentarios recibidos al instante (modo baja latencia: cola 3, 8 s)
for (let i = 1; i <= 20; i++) T.enqueue('c' + i, clock, 'id' + i);
// la primera ya empezó a sonar (cola vacía en ese momento), el resto compite por 3 plazas
assert.equal(spoken[0], 'c1'); assert.equal(T.queue.length, 3);
// pasa el tiempo mientras habla c1 (4 s por frase)
clock += 4000; finish();          // termina c1 → lee la más antigua de las 3 que quedan
assert.deepEqual([...spoken], ['c1', 'c18']); assert.equal(T.queue.length, 2);
clock += 4000; finish();          // c18 termina; pendientes c19, c20 con 8 s → justo en el límite
console.log(logs.filter(l => l.startsWith('[TTS]')).slice(-6).join('\n'));
clock += 1000; finish && pending && finish();
// con >8 s de antigüedad los restantes se descartan en vez de leerse
clock += 20000; T.pump();
assert.equal(T.queue.length, 0);
assert.ok(logs.some(l => l.includes('descartado por antigüedad')));
assert.ok(logs.some(l => l.includes('Cola llena, eliminando comentario antiguo')));
// id repetido no se vuelve a leer
const before = spoken.length; T.enqueue('c1 otra vez', clock, 'id1'); assert.equal(spoken.length, before);
// cambio de LIVE vacía todo
els.on.checked = true; T.enqueue('x', clock, 'n1'); T.enqueue('y', clock, 'n2');
els.tg = mk('tg'); els.tg.value = '@otro'; els.f = mk('f');
ctx.window.document = ctx.document; vm.runInContext("$('f').onsubmit({preventDefault(){}})", ctx);
assert.equal(T.queue.length, 0);

// --- voces: Safari las carga tarde (onvoiceschanged) y se restaura la guardada ---
const V = (name, lang, uri) => ({ name, lang, voiceURI: uri || name, localService: true, default: false });
fakeVoices = [V('Delta', 'pt-BR'), V('Beta', 'en-US'), V('Alfa', 'es-MX'), V('Gamma', 'es-ES')];
synth.onvoiceschanged();
const sel = els.voice.innerHTML;
assert.ok(!sel.includes('Delta') && !sel.includes('Otras voces'), 'sin voces de otros idiomas');
assert.ok(sel.includes('🇪🇸 Alfa — Español (México)'), sel); assert.ok(sel.includes('🇪🇸 Gamma — Español</option>'), sel); assert.ok(sel.includes('🇺🇸 Beta — Inglés</option>'), sel);
assert.ok(sel.indexOf('Alfa') < sel.indexOf('Beta') && sel.indexOf('Gamma') < sel.indexOf('Beta'), 'español primero');
assert.equal(els.voice.value, 'Gamma', 'recupera la voz guardada');
els.voice.value = 'Alfa'; els.voice.l.change();
assert.equal(JSON.parse(store['chatia.voice']).name, 'Alfa', 'guarda la elección');
// --- probar voz: texto exacto + voz/velocidad/volumen elegidos ---
els.rate.value = '1.4'; els.vol.value = '0.5'; spoken.length = 0; els.test.onclick();
assert.equal(spoken[0], 'Hola, esta es una prueba del lector de comentarios de ChatIa.');
assert.equal(lastUtt.voice.name, 'Alfa'); assert.equal(lastUtt.rate, 1.4); assert.equal(lastUtt.volume, 0.5);
finish();

// --- TTS reparado: «Probar voz» es una prueba directa e independiente ---
const PHRASE = 'Hola, esta es una prueba del lector de comentarios de ChatIa.';
// sin conexión, sin «Leer comentarios» y con estado interno «atascado» (busy/deadline/enabledAt/readyAt/gen): igual habla
els.on.checked = false; vm.runInContext("status('offline'); busy = true; deadline = 1; enabledAt = Infinity; readyAt = Infinity; gen = 7", ctx);
spoken.length = 0; els.test.onclick();
assert.equal(spoken[0], PHRASE, 'Probar voz habla sin TikTok ni «Leer comentarios» ni estado atascado');
finish(); assert.equal(vm.runInContext('busy', ctx), false); assert.equal(vm.runInContext('hold', ctx), false, 'nada queda bloqueado tras la prueba');
// cambiar de voz → Probar voz usa la elegida (voz nueva buscada de nuevo en getVoices)
els.voice.value = 'Gamma'; els.voice.l.change(); els.test.onclick(); assert.equal(lastUtt.voice.name, 'Gamma'); finish();
els.voice.value = 'Alfa'; els.voice.l.change(); els.test.onclick(); assert.equal(lastUtt.voice.name, 'Alfa'); finish();
// volumen 0 silencia de verdad (el 0 no se convierte en 1) y volumen 1 suena
els.vol.value = '0'; els.test.onclick(); assert.equal(lastUtt.volume, 0, 'volumen 0 = silencio'); finish();
els.vol.value = '1'; els.test.onclick(); assert.equal(lastUtt.volume, 1); finish();
// si ya hay algo hablando: se cancela y se espera un instante antes del speak() (Safari ignora cancel()+speak() simultáneos)
{ let cancels = 0; const oc = synth.cancel; synth.speaking = true; synth.cancel = () => { cancels++; pending = null; synth.speaking = false; };
  spoken.length = 0; els.test.onclick();
  assert.equal(cancels, 1); assert.equal(spoken.length, 0, 'tras cancelar espera antes de hablar'); fire(60); assert.equal(spoken[0], PHRASE); finish();
  // sin nada activo NO se llama a cancel(): habla en el mismo clic
  cancels = 0; spoken.length = 0; els.test.onclick(); assert.equal(cancels, 0); assert.equal(spoken[0], PHRASE); finish(); synth.cancel = oc; }
// si el navegador no llega a empezar (sin onstart) se reintenta UNA vez y no se queda bloqueado
spoken.length = 0; els.test.onclick(); fire(3000); assert.equal(spoken.length, 1); fire(120); assert.equal(spoken.length, 2, 'reintento único'); finish();
assert.equal(vm.runInContext('hold', ctx), false);
// la prueba no compite con los comentarios: estos esperan a que termine y luego se leen
els.on.checked = true; vm.runInContext("enabledAt = 0; status('connected','@x')", ctx); clock += 3500; // (el test dejó enabledAt en Infinity a propósito)
els.test.onclick(); spoken.length = 0; T.enqueue('durante la prueba', clock, 'h1'); assert.equal(spoken.length, 0, 'espera a que acabe la prueba');
finish(); assert.equal(spoken[0], 'durante la prueba', 'luego se lee el comentario'); finish();

// --- UNA sola función base (speakText): si la voz elegida falla, reintenta UNA vez con la predeterminada del idioma ---
els.voice.value = 'Alfa'; els.voice.l.change(); spoken.length = 0; els.test.onclick();
assert.equal(lastUtt.voice.name, 'Alfa'); lastUtt.onerror({ error: 'synthesis-failed' }); fire(120);
assert.equal(spoken.length, 2, 'reintenta'); assert.equal(lastUtt.voice, undefined, 'el reintento no fuerza la voz que falló'); finish();
// not-allowed (Safari sin gesto de usuario): no se reintenta en bucle y no queda bloqueado
spoken.length = 0; els.test.onclick(); lastUtt.onerror({ error: 'not-allowed' }); assert.equal(spoken.length, 1);
assert.equal(vm.runInContext('hold', ctx), false); pending = null;
// --- RUTA 2 completa con logs: [CHAT] → [FILTER] → [QUEUE] → [TTS]; el 2.º comentario suena después del 1.º ---
{ const m0 = logs.length, L = () => logs.slice(m0).join('\n'); spoken.length = 0; els.gap.value = '0';
  T.onEvent({ kind: 'chat', user: 'maria', text: 'primer comentario', at: clock, id: 'e2e1' });
  for (const k of ['[CHAT] comentario recibido', '[FILTER] comentario aceptado', '[QUEUE] comentario agregado']) assert.ok(L().includes(k), k);
  assert.deepEqual([...spoken], ['maria dice: primer comentario']);
  T.onEvent({ kind: 'chat', user: 'maria', text: 'segundo comentario', at: clock, id: 'e2e2' });
  assert.equal(spoken.length, 1, 'el 2.º espera a que termine el 1.º');
  lastUtt.onstart(); assert.ok(L().includes('[TTS] HABLANDO: maria dice: primer comentario'));
  finish(); assert.ok(L().includes('[TTS] TERMINADO'));
  assert.deepEqual([...spoken], ['maria dice: primer comentario', 'maria dice: segundo comentario']); finish();
  // un comentario rechazado por filtro deja su motivo en el log
  els.rm_cmd.checked = true; els.rm_all.checked = false; els.cmd.value = '/';
  T.onEvent({ kind: 'chat', user: 'pepe', text: 'sin comando', at: clock, id: 'e2e3' });
  assert.ok(L().includes('[FILTER] comentario rechazado (sin el comando o nada que leer)')); assert.equal(spoken.length, 2);
  els.rm_cmd.checked = false; els.rm_all.checked = true; els.cmd.value = '/'; }
// --- normalización: la voz recibe texto limpio, la pantalla el original ---
vm.runInContext("status('connected','@x')", ctx); clock += 3500; // el submit anterior reinició la conexión
els.on.checked = true; spoken.length = 0; els.gap.value = '0';
T.onEvent({ kind: 'chat', user: 'ana_lia', text: 'holaaaaaaa 😂😂😂', at: clock, id: 'z1' });
assert.equal(spoken[0], 'ana lia dice: holaaa, risa');
assert.ok(chatHtml.at(-1).includes('holaaaaaaa 😂😂😂'), 'la pantalla muestra el comentario original');
finish();
T.onEvent({ kind: 'gift', user: 'x', text: 'rosa', count: 1 }); // regalos ignorados
assert.equal(spoken.length, 1);

// --- filtros de lectura: afectan SOLO a la voz; el comentario siempre aparece en pantalla ---
els.rn.checked = false; els.dd.checked = false; let seq = 0;
const tryRead = (user, text, donor = false) => { // devuelve [lo que dijo la voz, ¿apareció en pantalla?]
  spoken.length = 0; const n = chatHtml.length; clock += 50;
  T.onEvent({ kind: 'chat', user, text, at: clock, id: 'f' + (++seq), donor });
  const r = [...spoken]; if (pending) finish(); return [r, chatHtml.length === n + 1 && chatHtml.at(-1).includes(text.replace(/&/g, '&amp;'))];
};
// modo «Todos» (como siempre)
assert.deepEqual(tryRead('ana', 'hola, ¿cómo estás?'), [['hola, ¿cómo estás?'], true]);
// modo «Con comando» con "/"
els.rm_cmd.checked = true; els.rm_all.checked = false; els.cmd.value = '/';
assert.deepEqual(tryRead('ana', '/ hola, ¿cómo estás?'), [['hola, ¿cómo estás?'], true], 'lee sin la barra');
assert.deepEqual(tryRead('ana', 'hola, ¿cómo estás?'), [[], true], 'sin comando: no se lee pero SÍ se ve');
assert.deepEqual(tryRead('ana', '/'), [[], true], 'solo el comando: nada que leer');
// comando personalizado
els.cmd.value = '!leer';
assert.deepEqual(tryRead('ana', '!leer hola akeer'), [['hola akeer'], true]);
assert.deepEqual(tryRead('ana', 'hola akeer'), [[], true]);
// campo vacío = "/"
els.cmd.value = '';
assert.deepEqual(tryRead('ana', '/hola'), [['hola'], true]);
// solo donadores (modo Todos)
els.rm_cmd.checked = false; els.rm_all.checked = true; els.do.checked = true;
assert.deepEqual(tryRead('pedro', 'hola', false), [[], true], 'no donó: se ve, no se lee');
assert.deepEqual(tryRead('luisa', 'hola', true), [['hola'], true], 'donó: se lee');
// combinación comando + donador: deben cumplirse TODOS
els.rm_cmd.checked = true; els.rm_all.checked = false; els.cmd.value = '/';
assert.deepEqual(tryRead('pedro', '/hola', false), [[], true], 'no donó + comando → no se lee');
assert.deepEqual(tryRead('luisa', 'hola', true), [[], true], 'donó sin comando → no se lee');
assert.deepEqual(tryRead('luisa', '/hola', true), [['hola'], true], 'donó + comando → solo "hola"');
// los comentarios filtrados no ensucian el «no repetir»: "/hola" tras un "hola" sin comando sigue leyéndose
els.dd.checked = true; els.do.checked = false;
assert.deepEqual(tryRead('a', 'buenas', false), [[], true]);
assert.deepEqual(tryRead('a', '/buenas', false), [['buenas'], true]);
assert.deepEqual(tryRead('b', '/buenas', false), [[], true], 'repetido: no se lee otra vez');
els.dd.checked = false; els.rm_cmd.checked = false; els.rm_all.checked = true;
// persistencia: el modo y el comando se guardan en localStorage
els.rm_cmd.checked = true; els.rm_all.checked = false; els.cmd.value = '!leer'; els.do.checked = true; els.do.type = 'checkbox'; T.save();
const saved = JSON.parse(ctx.localStorage.cs); assert.equal(saved.rm, 'cmd'); assert.equal(saved.cmd, '!leer'); assert.equal(saved.do, true);
console.log('OK: prueba de humo del frontend');
