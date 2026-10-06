// Prueba de humo del script real de index.html con un DOM/Web Speech simulados (sin navegador).
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\n([\s\S]*)<\/script><\/body>/)[1];
const queueSrc = fs.readFileSync(new URL('../public/tts-queue.js', import.meta.url), 'utf8');

let clock = 1_000_000; const logs = [];
const els = {};
const mk = (id) => els[id] ||= { id, value: '', checked: false, textContent: '', innerHTML: '', children: [], style: {}, dataset: {},
  addEventListener(t, f) { (this.l ||= {})[t] = f; }, insertAdjacentHTML() {}, remove() {}, options: [], scrollHeight: 0, scrollTop: 0, clientHeight: 0 };
const def = { on: [false], ll: [true], rn: [true], dd: [false], eo: [true], ml: ['140'], gap: ['0'], pm: ['0'], rate: ['1'], vol: ['1'], lang: ['es'], eng: ['browser'], voice: [''], bw: [''], mu: [''] };
for (const [k, [v]] of Object.entries(def)) { const e = mk(k); typeof v === 'boolean' ? e.checked = v : e.value = v; }
mk('eng').options = [{ value: 'browser' }, { value: 'server', disabled: true, textContent: '' }];

const spoken = []; let pending = null;
const synth = { speak(u) { spoken.push(u.text); pending = u; }, cancel() { pending = null; }, resume() {}, getVoices: () => [], paused: false };
const ctx = { console: { log: (...a) => logs.push(a.join(' ')) }, Date: { now: () => clock }, setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, localStorage: {},
  document: { getElementById: mk, querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible', body: {} },
  window: { speechSynthesis: synth, addEventListener() {} }, location: { protocol: 'https:', host: 'x' }, self: {},
  SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  Worker: undefined, WebSocket: class {}, Blob: class {}, URL: { createObjectURL: () => '' }, alert() {}, JSON, Map, Set, Promise, Object, Number, String, Array, Math, DataView, Error };
ctx.window.WebSocket = ctx.WebSocket; vm.createContext(ctx);
vm.runInContext(queueSrc, ctx); ctx.TtsQueue = ctx.self.TtsQueue;
vm.runInContext(script + '\n;globalThis.__t={enqueue,pump,tick,queue,speakNow};', ctx);
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
console.log('OK: prueba de humo del frontend');
