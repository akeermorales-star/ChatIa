import assert from 'node:assert/strict';
import { createDonorRegistry } from '../adapters/donors.js';
const g = (userId, uniqueId, nickname = '') => ({ user: { userId, uniqueId, nickname }, giftId: 5655 });
let d = createDonorRegistry();
assert.equal(d.has(g(1n, 'ana')), false, 'nadie ha donado al inicio');
assert.equal(d.add(g(1n, 'ana')), true); assert.equal(d.add(g(1n, 'ana')), false, 'segundo regalo: ya registrado');
assert.equal(d.has(g('1', 'ana')), true, 'userId bigint o texto es lo mismo');
assert.equal(d.has(g(1n, 'ana_nuevo_nombre', 'Otro nick')), true, 'identifica por userId aunque cambie @usuario o nickname');
assert.equal(d.has(g(2n, 'ana')), false, 'mismo @usuario pero otro userId: NO es el donador');
assert.equal(d.has(g(3n, 'pedro')), false);
// sin userId: se usa el @usuario
assert.equal(d.add(g(undefined, 'Luis')), true); assert.equal(d.has(g(undefined, 'luis')), true); assert.equal(d.has(g(9n, 'luis')), true);
assert.equal(d.has(g('0', 'otro')), false);
// evento sin datos de usuario: no se inventa nada
assert.equal(d.add({}), false); assert.equal(d.add({ user: {} }), false); assert.equal(d.has({}), false);
// cada conexión/LIVE empieza vacía y clear() la vacía
d.clear(); assert.equal(d.has(g(1n, 'ana')), false); assert.equal(d.has(g(undefined, 'luis')), false);
assert.equal(createDonorRegistry().has(g(1n, 'ana')), false, 'otra sesión no comparte donadores');
console.log('OK: pruebas del registro de donadores');
