import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { adapters } from './adapters/index.js';

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
  const emit = { status: (state, msg) => send({ type: 'status', state, msg }), event: (event) => send({ type: 'event', event }) };
  const stop = () => { session?.disconnect(); session = null; };

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'connect') {
      stop();
      const a = adapters[m.platform || 'tiktok'];
      if (!a) return emit.status('error', 'Plataforma no soportada');
      session = a.connect(String(m.target).slice(0, 200), emit);
    } else if (m.type === 'disconnect') { stop(); emit.status('offline', ''); }
  });
  ws.on('close', stop);
  const ping = setInterval(() => ws.readyState === 1 && ws.ping(), 25000);
  ws.on('close', () => clearInterval(ping));
});

server.listen(process.env.PORT || 3000, () => console.log('Listo en puerto', process.env.PORT || 3000));
