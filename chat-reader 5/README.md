# Chat Reader — lector universal de chats LIVE (TikTok primero)

Pega un link o @usuario → Conectar → comentarios en tiempo real → lectura por voz del navegador.

## Importante: sobre TikTok
TikTok **no ofrece una API oficial pública** para leer comentarios, regalos o likes de un LIVE ajeno.
Este proyecto usa la librería **no oficial** [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector)
(conecta al servicio interno "Webcast"). Consecuencias:
- Puede dejar de funcionar cuando TikTok cambie su sistema; hay que actualizar la librería (`npm update tiktok-live-connector`).
- Necesita un servicio externo de "firmas" (EulerStream). Funciona sin clave con límites; para uso serio crea una clave gratis en eulerstream.com y ponla en `TIKTOK_SIGN_API_KEY` (solo en el servidor).
- No es un uso respaldado por TikTok: revisa sus términos antes de usarlo en público.
- Solo se leen eventos de LIVEs que estén en directo. No hace falta iniciar sesión.

## Estructura
- `adapters/tiktok.js` — única parte que conoce TikTok (parseo de enlace, eventos, reconexión).
- `adapters/index.js` — registro. Para YouTube/Twitch/Kick: crea `adapters/<plataforma>.js` con `connect(target, emit)` y regístralo.
- `adapters/donors.js` — registro (por sesión de LIVE) de quién envió al menos un regalo; solo uso interno.
- `server.js` — Express + WebSocket (`/ws`). `public/index.html` — interfaz y lector de voz. `public/chat-filters.js` — filtros de lectura (comando/donadores) y selección de las 5 voces.

## Local
```
npm install
cp .env.example .env   # opcional
node --env-file=.env server.js   # o: npm start
```
Abre http://localhost:3000

## Desplegar (Render / Railway / Fly.io / VPS)
Necesitas un host con **Node ≥18 y WebSockets** (no sirve Vercel/Netlify para el backend).
Render: New Web Service → repo → Build `npm install` → Start `npm start` → añade variables de entorno. Obtienes una URL https y funciona en PC, Mac, Android e iPhone.

## Variables de entorno
| Variable | Uso |
|---|---|
| `PORT` | Puerto (el hosting suele ponerlo) |
| `TIKTOK_SIGN_API_KEY` | Clave EulerStream, opcional, solo servidor |
| `ALLOWED_ORIGINS` | Orígenes permitidos para el WebSocket, opcional |

## Notas
- iPhone/Safari: activa «Leer comentarios» con un toque para desbloquear el audio; la pantalla debe seguir encendida y la pestaña abierta.
- **Latencia**: la cola de voz descarta comentarios con más de `MAX_COMMENT_AGE` (10 s) y guarda como máximo `MAX_QUEUE_SIZE` (5). «Modo baja latencia» (activado por defecto) usa 8 s y 3. Constantes al inicio del `<script>` de `public/index.html`; la lógica está en `public/tts-queue.js`.
- **Segundo plano**: el lector se mueve por eventos (llegada de comentario / fin de frase) y un latido en Worker; un tono inaudible mantiene activo el audio mientras «Leer comentarios» está marcado. El navegador no lo garantiza: ver limitaciones abajo.
- **Voz del servidor (opcional, gratis)**: con `espeak-ng` el servidor genera el audio y el navegador lo reproduce (Web Audio). Requiere desplegar con el `Dockerfile` incluido (Render → runtime Docker). Si no está instalado, la opción aparece desactivada.
- Pruebas: `node test/queue.test.js && node test/frontend.smoke.test.js` (no necesitan `npm install`).
- Las voces disponibles dependen del dispositivo.
- El historial visible conserva los últimos 3000 mensajes solo para que el navegador no se ponga lento; los contadores no tienen límite.
- **Voces**: el selector muestra como máximo 5 voces reales del dispositivo (hasta 3 en español + 2 en inglés, todas distintas; si faltan de un idioma se completa con el otro). No se inventan voces.
- **Filtros de lectura** (⚙️ Filtros; solo afectan a la voz, el comentario siempre se ve en el chat, y deben cumplirse TODOS los activos): «Con comando» (solo se leen los que empiezan por el comando y se lee sin él; un comando con letras como `!leer` debe ir separado por un espacio) y «Solo usuarios que donaron» (quien envió ≥1 regalo en el LIVE actual; los regalos no se leen ni se muestran, y la lista se vacía al desconectar o cambiar de LIVE).
- Pruebas: `npm test`.
- **Voz (TTS) y «Probar voz»**: todo el audio del navegador sale por un único motor (`speakText()` en `public/index.html`; la cola solo decide QUÉ se lee). Si la voz elegida falla o no arranca, reintenta una vez con la predeterminada del idioma. Ruta de logs de un comentario: `[CHAT] recibido` → `[FILTER] aceptado/rechazado (motivo)` → `[QUEUE] agregado/ignorado (motivo)` → `[TTS] HABLANDO` → `[TTS] TERMINADO`. «Probar voz» es una prueba directa: no depende de TikTok, de «Leer comentarios», de la cola, de los filtros ni del WebSocket, y usa la voz, velocidad y volumen elegidos (volumen 0 = silencio). Solo llama a `speechSynthesis.cancel()` si hay algo activo y, en ese caso, espera un instante antes de `speak()` (Safari puede ignorar `cancel()`+`speak()` simultáneos). Si el navegador no llega a empezar, reintenta una vez. Consola: `[TTS TEST] …` (disponible, voces, voz elegida, START/END/ERROR, estado final). Diagnóstico manual: `testSpeechDirect()` o `testSpeechDirect({cancel:false})` en la consola.
