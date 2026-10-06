import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

// No existe API oficial pública de TikTok para leer comentarios LIVE.
// Esto usa la librería no oficial tiktok-live-connector (servicio interno "Webcast").
// Puede romperse si TikTok cambia algo.
export const parseTarget = (s = '') => {
  const m = s.trim().match(/tiktok\.com\/@([\w.]+)/i) || s.trim().match(/^@?([\w.]+)$/);
  return m ? m[1] : null;
};
const pic = (u = {}) => {
  const p = u.profilePicture ?? u.avatarThumb;
  const url = p?.url ?? p?.urls ?? u.profilePictureUrl;
  return Array.isArray(url) ? url[0] : url || '';
};
const who = (d) => {
  const u = d.user ?? d;
  return { user: u.uniqueId || u.nickname || 'anónimo', nick: u.nickname, avatar: pic(u) };
};

export function connect(target, emit) {
  const id = parseTarget(target);
  if (!id) { emit.status('error', 'Enlace o usuario no válido'); return { disconnect() {} }; }
  let conn, closed = false, tries = 0, timer;

  const start = async () => {
    emit.status(tries ? 'reconnecting' : 'connecting', `@${id}`);
    const opts = process.env.TIKTOK_SIGN_API_KEY ? { signApiKey: process.env.TIKTOK_SIGN_API_KEY } : {};
    conn = new TikTokLiveConnection(id, opts);
    conn.on(ControlEvent.CONNECTED, () => { tries = 0; emit.status('connected', `@${id}`); });
    conn.on(ControlEvent.DISCONNECTED, () => retry('Conexión perdida'));
    conn.on(ControlEvent.ERROR, (e) => console.error('[tiktok]', e?.message || e));
    conn.on(WebcastEvent.CHAT, (d) => emit.event({ kind: 'chat', ...who(d), text: d.comment }));
    conn.on(WebcastEvent.GIFT, (d) => emit.event({ kind: 'gift', ...who(d),
      text: d.giftName ?? d.giftDetails?.giftName ?? 'un regalo', count: d.repeatCount || 1 }));
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
  return { disconnect() { closed = true; clearTimeout(timer); try { conn?.disconnect(); } catch {} } };
}
