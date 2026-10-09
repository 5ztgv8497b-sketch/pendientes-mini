/* Genera el par de claves VAPID y escribe tools/.env.
 *
 * Uso:
 *   node generar-claves.js [--subject mailto:tu-correo@ejemplo.com] [--force]
 *
 * - Se niega a sobrescribir un .env existente salvo que se pase --force
 *   (regenerar la clave invalida la clave pública ya desplegada en la app).
 * - Imprime SOLO la clave pública y la línea para config.js. La privada
 *   queda únicamente en tools/.env (ignorado por Git).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const DIR = __dirname;
const ENV_PATH = path.join(DIR, '.env');

const args = process.argv.slice(2);

function valorDeBandera(nombre) {
  const i = args.indexOf(nombre);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}

const forzar = args.includes('--force');
const subject = valorDeBandera('--subject') || 'mailto:tu-correo@ejemplo.com';

if (!/^mailto:.+@.+/i.test(subject)) {
  console.error('El subject debe tener formato "mailto:correo@dominio".');
  process.exit(1);
}

if (fs.existsSync(ENV_PATH) && !forzar) {
  console.error('Ya existe tools/.env. Regenerar las claves invalida la suscripción');
  console.error('y la clave pública desplegada. Si de verdad quieres rotarlas:');
  console.error('  node generar-claves.js --force');
  process.exit(1);
}

const claves = webpush.generateVAPIDKeys();

const contenido = [
  '# Generado por generar-claves.js — NO publicar ni compartir.',
  `VAPID_PUBLIC_KEY=${claves.publicKey}`,
  `VAPID_PRIVATE_KEY=${claves.privateKey}`,
  `VAPID_SUBJECT=${subject}`,
  '',
];

fs.writeFileSync(ENV_PATH, contenido.join('\n'), { mode: 0o600 });

console.log('Claves VAPID generadas en tools/.env (archivo ignorado por Git).');
console.log('');
console.log('Siguiente paso: copia la clave PÚBLICA en public/config.js:');
console.log('');
console.log(`window.PENDIENTES_CONFIG = { vapidPublicKey: '${claves.publicKey}' };`);
console.log('');
console.log('La clave privada no se muestra: vive solo en tools/.env.');
console.log('Después de cambiar config.js, despliega de nuevo la app.');
