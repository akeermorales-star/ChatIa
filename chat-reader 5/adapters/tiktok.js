import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { extractComment, normalizeUser, stringify } from './normalize.js';
import { createDonorRegistry } from './donors.js';

// No existe API oficial pública de TikTok para leer comentarios LIVE.
// Esto usa la librería no oficial tiktok-live-connector (servicio interno "Webcast").
// Puede romperse si TikTok cambia algo.
export const parseTarget = (s = '') => {
  const m = s.trim().match(/tiktok\.com\/@([\w.]+)/i) || s.trim().match(/^@?([\w.]+)$/);
  return m ? m[1] : null;
};
const who = (d) => { const u = normalizeUser(d); return { user: u.username, nick: u.nickname, avatar: u.profilePicture }; };

export function connect(target, emit) {
  const id = parseTarget(target);
  if (!id) { emit.status('error', 'Enlace o usuario no válido'); return { disconnect() {} }; }
  let conn, closed = false, tries = 0, timer;
  const donors = createDonorRegistry(); // quién envió al menos un regalo en ESTE LIVE (solo uso interno; no se lee ni se muestra)

  const start = async () => {
    emit.status(tries ? 'reconnecting' : 'connecting', `@${id}`);
    const opts = process.env.TIKTOK_SIGN_API_KEY ? { signApiKey: process.env.TIKTOK_SIGN_API_KEY } : {};
    conn = new TikTokLiveConnection(id, opts);
    conn.on(ControlEvent.CONNECTED, () => { tries = 0; emit.status('connected', `@${id}`); });
    conn.on(ControlEvent.DISCONNECTED, () => retry('Conexión perdida'));
    conn.on(ControlEvent.ERROR, (e) => console.error('[tiktok]', e?.message || e));
    conn.on(WebcastEvent.CHAT, (d) => {
      // Log temporal para ver la estructura real del evento (desactívalo con DEBUG_CHAT=0)
      if (process.env.DEBUG_CHAT !== '0') console.log('[RAW CHAT] claves:', Object.keys(d).join(','), '|', stringify(d).slice(0, 1500));
      const u = normalizeUser(d), comment = extractComment(d);
      if (!comment || !comment.trim()) { console.log('[CHAT SIN TEXTO, descartado]', u.username); return; }
      console.log(`[CHAT RECEIVED] ${u.username}: ${comment}`);
      const mid = d.msgId ?? d.common?.msgId; // id único del mensaje: evita releer el mismo comentario
      emit.event({ kind: 'chat', ...u, comment, id: mid != null ? String(mid) : '', donor: donors.has(d) });
    });
    conn.on(WebcastEvent.GIFT, (d) => {
      if (donors.add(d)) console.log('[DONOR] regalo recibido de', who(d).user, '→ puede ser leído con el filtro de donadores');
      emit.event({ kind: 'gift', ...who(d),
        text: d.giftName ?? d.giftDetails?.giftName ?? 'un regalo', count: d.repeatCount || 1 });
    });
    conn.on(WebcastEvent.LIKE, (d) => emit.event({ kind: 'like', ...who(d), count: d.likeCount || 1 }));
    conn.on(WebcastEvent.FOLLOW, (d) => emit.event({ kind: 'follow', ...who(d) }));
    conn.on(WebcastEvent.MEMBER, (d) => emit.event({ kind: 'join', ...who(d) }));
    try { await conn.connect(); }
    catch (e) { retry(e?.message || 'No se pudo conectar (¿el usuario está en LIVE?)'); }
  };
  const retry = (why) => {
    if (closed) return;
    try { conn?.disconnect(); } catch {}
    tries++;
    const wait = Math.min(30000, 2000 * 2 ** Math.min(tries, 4));
    emit.status('reconnecting', `${why}. Reintentando en ${Math.round(wait / 1000)} s…`);
    clearTimeout(timer); timer = setTimeout(start, wait);
  };
  start();
  return { disconnect() { closed = true; clearTimeout(timer); donors.clear(); try { conn?.disconnect(); } catch {} } };
}
