import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// public/tts-queue.js es un script de navegador (UMD): se carga como tal, igual que en la página.
const ctx = { self: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../public/tts-queue.js', import.meta.url), 'utf8'), ctx);
const TtsQueue = ctx.self.TtsQueue;

let t = 0; const logs = []; const drops = [];
const limits = { maxAge: 10000, maxQueue: 5 };
const q = TtsQueue.create({ getLimits: () => limits, now: () => t, log: m => logs.push(m), onDrop: (it, why) => drops.push([it.text, why]) });

// 1) cola llena: 20 comentarios de golpe, solo quedan los 5 más recientes
for (let i = 1; i <= 20; i++) q.push({ id: 'm' + i, text: 'c' + i, receivedAt: t });
assert.equal(q.length, 5);
assert.deepEqual([...q.peek().map(x => x.text)], ['c16', 'c17', 'c18', 'c19', 'c20']);
assert.equal(drops.filter(d => d[1] === 'full').length, 15);

// 2) no se vuelve a encolar un id ya recibido
assert.equal(q.push({ id: 'm20', text: 'c20 dup', receivedAt: t }), false);

// 3) antigüedad: tras 11 s todo lo pendiente se descarta
t = 11000; assert.equal(q.next(), null); assert.equal(q.length, 0);
assert.ok(logs.some(l => l.startsWith('[TTS] Comentario descartado por antigüedad: 11.0s')));

// 4) mezcla: uno viejo (a 9 s) se descarta cuando cruza el límite, el nuevo se lee
t = 20000; q.push({ id: 'a', text: 'viejo', receivedAt: 20000 }); q.push({ id: 'b', text: 'nuevo', receivedAt: 29500 });
t = 30500; const n = q.next(); assert.equal(n.text, 'nuevo');
assert.ok(logs.some(l => l.startsWith('[TTS] Leyendo comentario recibido hace: 1.0s')));

// 5) modo baja latencia (8 s, cola 3)
limits.maxAge = 8000; limits.maxQueue = 3;
for (let i = 1; i <= 10; i++) q.push({ id: 'n' + i, text: 'n' + i, receivedAt: t });
assert.equal(q.length, 3); t += 8001; assert.equal(q.next(), null);

// 6) simulación de 60 s: llegan 1 comentario/seg, la voz tarda 3 s por frase.
//    El retraso medio de lo que SÍ se lee nunca supera maxAge y no crece con el tiempo.
limits.maxAge = 8000; limits.maxQueue = 3; q.clearAll(); drops.length = 0;
const lag = []; let busyUntil = 0; const start = t;
for (let s = 0; s < 120; s++) {
  t = start + s * 1000; q.push({ id: 'x' + s, text: 'x' + s, receivedAt: t });
  if (t >= busyUntil) { const it = q.next(); if (it) { lag.push(t - it.receivedAt); busyUntil = t + 3000; } }
}
console.log('leídos:', lag.length, '| descartados:', drops.length, '| retraso máx al empezar a leer:', Math.max(...lag) / 1000 + 's');
assert.ok(Math.max(...lag) <= 8000);

// 7) clearAll vacía todo
q.push({ id: 'z', text: 'z', receivedAt: t }); q.clearAll(); assert.equal(q.length, 0);
console.log('OK: todas las pruebas de la cola pasaron');
