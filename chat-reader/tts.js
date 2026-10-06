// TTS opcional del servidor (gratuito): espeak-ng genera un WAV y se ENVÍA al navegador,
// que es quien lo reproduce. El servidor nunca reproduce audio.
// Si espeak-ng no está instalado (Render con runtime Node), simplemente queda desactivado.
import { spawn, execFile } from 'node:child_process';

let available = false;
export const ttsAvailable = () => available;
export const ttsInit = () => new Promise((res) =>
  execFile('espeak-ng', ['--version'], (err) => { available = !err; res(available); }));

const MAX_PARALLEL = 3, MAX_WAITING = 12;
let running = 0; const waiting = [];
const release = () => { running--; const n = waiting.shift(); if (n) n(); };
const acquire = () => new Promise((resolve, reject) => {
  if (running < MAX_PARALLEL) { running++; return resolve(); }
  if (waiting.length >= MAX_WAITING) return reject(new Error('busy'));
  waiting.push(() => { running++; resolve(); });
});

export async function synth(text, { lang = 'es', rate = 1 } = {}) {
  if (!available) throw new Error('tts-unavailable');
  await acquire();
  try {
    const voice = lang === 'en' ? 'en-us' : 'es-419';
    const wpm = Math.round(Math.min(330, Math.max(100, 165 * (Number(rate) || 1))));
    return await new Promise((resolve, reject) => {
      const p = spawn('espeak-ng', ['-v', voice, '-s', String(wpm), '--stdin', '--stdout'], { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks = []; let size = 0, done = false;
      const fin = (err, val) => { if (done) return; done = true; clearTimeout(kill); err ? reject(err) : resolve(val); };
      const kill = setTimeout(() => { p.kill('SIGKILL'); fin(new Error('timeout')); }, 5000);
      p.stdout.on('data', (c) => { size += c.length; if (size > 3e6) { p.kill('SIGKILL'); return fin(new Error('too-big')); } chunks.push(c); });
      p.on('error', fin);
      p.on('close', (code) => code === 0 && size > 44 ? fin(null, Buffer.concat(chunks)) : fin(new Error('espeak-exit-' + code)));
      p.stdin.on('error', () => {});
      p.stdin.end(text);          // por stdin: el texto nunca se interpreta como opción de línea de comandos
    });
  } finally { release(); }
}
