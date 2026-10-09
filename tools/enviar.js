/* Envía UNA notificación Web Push de prueba desde esta computadora.
 *
 * Uso:
 *   node enviar.js [--file ruta/subscription.json] [--title "Título"]
 *                  [--body "Mensaje"] [--url "./"] [--ttl 120] [--dry-run]
 *
 * - Lee claves VAPID y subject de tools/.env (generados por generar-claves.js).
 * - Lee la suscripción desde un archivo local FUERA del repositorio.
 * - Nunca imprime secretos, la suscripción completa ni el endpoint íntegro.
 * - Códigos de salida: 0 éxito, 1 error.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const DIR = __dirname;

/* ---------- argumentos ---------- */

function valorDeBandera(nombre, predeterminado) {
  const args = process.argv.slice(2);
  const i = args.indexOf(nombre);
  if (i === -1 || i + 1 >= args.length) return predeterminado;
  return args[i + 1];
}

const archivoSub = path.resolve(DIR, valorDeBandera('--file', 'subscription.json'));
const titulo = valorDeBandera('--title', 'Pendientes Mini');
const cuerpo = valorDeBandera('--body', 'Notificación de prueba desde tu computadora.');
const destino = valorDeBandera('--url', './');
const ttl = Number.parseInt(valorDeBandera('--ttl', '120'), 10);
const dryRun = process.argv.slice(2).includes('--dry-run');

if (!Number.isFinite(ttl) || ttl < 0) {
  console.error('El TTL debe ser un número de segundos ≥ 0.');
  process.exit(1);
}

/* ---------- .env (parser mínimo, sin dependencias) ---------- */

function leerEnv(ruta) {
  const vars = {};
  let crudo;
  try {
    crudo = fs.readFileSync(ruta, 'utf8');
  } catch {
    return null;
  }
  for (const linea of crudo.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const igual = limpia.indexOf('=');
    if (igual === -1) continue;
    const clave = limpia.slice(0, igual).trim();
    const valor = limpia.slice(igual + 1).trim();
    if (clave) vars[clave] = valor;
  }
  return vars;
}

const env = leerEnv(path.join(DIR, '.env'));
if (!env || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
  console.error('Faltan las claves VAPID en tools/.env.');
  console.error('Genera las claves con:  node tools/generar-claves.js');
  process.exit(1);
}

/* ---------- suscripción ---------- */

function leerSuscripcion(ruta) {
  let crudo;
  try {
    crudo = fs.readFileSync(ruta, 'utf8');
  } catch {
    console.error(`No se pudo leer la suscripción en: ${ruta}`);
    console.error('Exporta el JSON desde la app instalada y guárdalo fuera del repositorio.');
    process.exit(1);
  }
  try {
    return JSON.parse(crudo);
  } catch {
    console.error(`El archivo ${ruta} no contiene JSON válido.`);
    process.exit(1);
  }
}

function endpointEnmascarado(endpoint) {
  try {
    const url = new URL(endpoint);
    const cola = String(url.pathname).slice(-6);
    return `${url.host}/…${cola}`;
  } catch {
    return '(endpoint ilegible)';
  }
}

const suscripcion = leerSuscripcion(archivoSub);

const formaValida =
  suscripcion &&
  typeof suscripcion.endpoint === 'string' &&
  suscripcion.endpoint.startsWith('https://') &&
  suscripcion.keys &&
  typeof suscripcion.keys.p256dh === 'string' &&
  typeof suscripcion.keys.auth === 'string';

if (!formaValida) {
  console.error('La suscripción no tiene la forma esperada');
  console.error('(endpoint https, keys.p256dh y keys.auth). Vuelve a suscribirte y exportar.');
  process.exit(1);
}

const payload = JSON.stringify({ title: titulo, body: cuerpo, url: destino });

/* ---------- envío ---------- */

webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

if (dryRun) {
  console.log('Dry-run OK. No se envió nada.');
  console.log(`  Suscripción : ${endpointEnmascarado(suscripcion.endpoint)}`);
  console.log(`  Payload     : ${Buffer.byteLength(payload)} bytes (título: "${titulo}")`);
  console.log(`  TTL         : ${ttl} s, codificación aes128gcm`);
  process.exit(0);
}

const opciones = { TTL: ttl, contentEncoding: 'aes128gcm' };

webpush
  .sendNotification(suscripcion, payload, opciones)
  .then(() => {
    console.log('Enviado.');
    console.log(`  Endpoint : ${endpointEnmascarado(suscripcion.endpoint)}`);
    console.log('  Si el iPhone está desbloqueado, el aviso llega como banner;');
    console.log('  bloqueado, aparece en la pantalla de bloqueo.');
    process.exit(0);
  })
  .catch((error) => {
    const codigo = error && error.statusCode;
    if (codigo === 404 || codigo === 410) {
      console.error(`El servicio push respondió ${codigo}: la suscripción ya no es válida.`);
      console.error('Abre la app instalada, pulsa «Suscribirse a push», exporta el JSON');
      console.error('y reemplaza el archivo de suscripción.');
    } else if (codigo === 401 || codigo === 403) {
      console.error(`El servicio push respondió ${codigo}: las claves VAPID no coinciden`);
      console.error('con las que crearon la suscripción (¿regeneraste las claves?).');
      console.error('Vuelve a suscribirte en la app con la clave pública actual.');
    } else if (codigo) {
      console.error(`El servicio push respondió ${codigo}. Revisa conexión y suscripción.`);
    } else {
      console.error(`No se pudo enviar (${error && error.name ? error.name : 'error desconocido'}).`);
      console.error('Causas comunes: sin conexión a internet, o el JSON de suscripción');
      console.error('está truncado o alterado (keys.p256dh debe ser la clave completa).');
      console.error('Si dudas, vuelve a suscribirte y exportar desde la app.');
    }
    process.exit(1);
  });
