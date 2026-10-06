// Registro de plataformas. Para añadir YouTube/Twitch/Kick: crea adapters/<nombre>.js
// con la misma firma y regístralo aquí. El frontend no cambia.
//
// Contrato: connect(target, emit) => { disconnect() }
//   emit.status(state, msg)   state: connecting|connected|reconnecting|offline|error
//   emit.event({kind, user, nick, avatar, text, count})   kind: chat|gift|like|follow|join
import * as tiktok from './tiktok.js';
export const adapters = { tiktok };
