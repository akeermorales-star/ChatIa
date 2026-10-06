// Normalización de eventos de tiktok-live-connector (sin dependencias, fácil de probar).
export const stringify = (o) => JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? v.toString() : v));

// No asume un nombre fijo: prueba los nombres conocidos y, si ninguno trae texto,
// busca cualquier propiedad de primer nivel cuyo nombre sugiera texto.
export function extractComment(d = {}) {
  const known = [d.comment, d.content, d.text, d.message, d.msg, d.data?.comment, d.data?.content];
  for (const v of known) if (typeof v === 'string' && v.trim()) return v.trim();
  for (const [k, v] of Object.entries(d))
    if (/comment|content|text|message/i.test(k) && typeof v === 'string' && v.trim()) return v.trim();
  return '';
}
export function normalizeUser(d = {}) {
  const u = d.user ?? d;
  const p = u.profilePicture ?? u.avatarThumb ?? u.avatarMedium;
  let url = p?.url ?? p?.urls ?? p?.urlList ?? u.profilePictureUrl ?? (typeof p === 'string' ? p : '');
  if (Array.isArray(url)) url = url[0];
  return {
    username: u.uniqueId || u.displayId || u.nickname || 'anónimo',
    nickname: u.nickname || '',
    profilePicture: typeof url === 'string' ? url : '',
  };
}
