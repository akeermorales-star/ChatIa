import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { adapters } from './adapters/index.js';
import { ttsInit, ttsAvailable, synth } from './tts.js';
await ttsInit();
console.log('[TTS servidor]', ttsAvailable() ? 'espeak-ng disponible' : 'no disponible (se usa la voz del navegador)');

const app = express();
app.use(express.static('public'));
app.get('/health', (_, res) => res.send('ok'));
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

wss.on('connection', (ws, req) => {
  if (allowed.length && !allowed.includes(req.headers.origin)) return ws.close(1008, 'origin');
  let session = null;
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  // serverAt = momento en que el servidor recibió el evento (el cliente lo usa para medir la antigüedad real)
  const emit = { status: (state, msg) => send({ type: 'status', state, msg }), event: (e) => e.kind === 'chat'
      ? send({ type: 'chat', id: e.id, serverAt: Date.now(), username: e.username, nickname: e.nickname, comment: e.comment, profilePicture: e.profilePicture })
      : null }; // ChatIa solo usa comentarios: regalos, likes, seguidores y entradas no se envían al navegador
  send({ type: 'hello', tts: ttsAvailable() });
  const stop = () => { session?.disconnect(); session = null; };

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'connect') {
      stop();
      const a = adapters[m.platform || 'tiktok'];
      if (!a) return emit.status('error', 'Plataforma no soportada');
      session = a.connect(String(m.target).slice(0, 200), emit);
    } else if (m.type === 'disconnect') { stop(); emit.status('offline', '');
    } else if (m.type === 'ping') {
      // Latido de la app: es tráfico ENTRANTE para Render (evita que se duerma) y permite al cliente detectar conexiones muertas.
      send({ type: 'pong', t: m.t });
    } else if (m.type === 'tts' && Number.isInteger(m.id) && typeof m.text === 'string' && m.text.length <= 300) {
      // Audio generado en el servidor y reproducido por el navegador: [4 bytes id][WAV]
      synth(m.text, { lang: m.lang === 'en' ? 'en' : 'es', rate: m.rate }).then((wav) => {
        if (ws.readyState !== 1) return;
        const head = Buffer.alloc(4); head.writeUInt32BE(m.id);
        ws.send(Buffer.concat([head, wav]), { binary: true });
      }).catch(() => send({ type: 'tts_error', id: m.id }));
    }
  });
  ws.on('close', stop);
  const ping = setInterval(() => ws.readyState === 1 && ws.ping(), 25000);
  ws.on('close', () => clearInterval(ping));
});

server.listen(process.env.PORT || 3000, () => console.log('Listo en puerto', process.env.PORT || 3000));
