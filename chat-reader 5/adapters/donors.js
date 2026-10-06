// Registro de donadores de UNA sesión de LIVE (se crea en cada connect() y se vacía al desconectar).
// Los regalos NO se envían al navegador ni se leen: solo sirven para saber quién ya donó.
// Identificador estable: userId de TikTok. El @usuario (uniqueId) solo se usa si el evento no trae userId.
export function createDonorRegistry() {
  const ids = new Set();       // userId de quienes enviaron algún regalo
  const handles = new Set();   // @usuario (minúsculas) de todos los donadores
  const noId = new Set();      // @usuario de regalos que llegaron SIN userId
  const idOf = (d) => { const v = (d?.user ?? d)?.userId; const s = v == null ? '' : String(v); return s && s !== '0' ? s : ''; };
  const handleOf = (d) => { const u = d?.user ?? d ?? {}; return String(u.uniqueId || u.displayId || '').toLowerCase(); };
  return {
    // Devuelve true si es un donador nuevo en esta sesión; false si ya estaba o el evento no identifica al usuario.
    add(d) {
      const id = idOf(d), h = handleOf(d);
      if (!id && !h) return false;
      const had = id ? ids.has(id) : handles.has(h);
      if (id) ids.add(id); else noId.add(h);
      if (h) handles.add(h);
      return !had;
    },
    has(d) {
      const id = idOf(d), h = handleOf(d);
      if (id) return ids.has(id) || (!!h && noId.has(h));
      return !!h && handles.has(h);
    },
    clear() { ids.clear(); handles.clear(); noId.clear(); },
    get size() { return handles.size + ids.size; },
  };
}
