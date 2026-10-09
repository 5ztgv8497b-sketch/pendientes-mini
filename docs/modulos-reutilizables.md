# Módulos reutilizables — Pendientes Mini

Los módulos viven en `public/app.js` como objetos autocontenidos (vanilla JS,
sin dependencias). Están pensados para extraerse a archivos propios y
reasentarse en otra plataforma con cambios mínimos. Aquí está el contrato de
cada uno: qué expone, qué asume y qué NO hace.

---

## 1. `Almacenamiento` — persistencia local validada

Colección de tareas en `localStorage` bajo una clave versionada
(`pendientes-mini:v1:tasks`). Cargar una versión nueva de la app nunca borra
datos: el versionado es de la clave, no del caché.

```js
Almacenamiento.cargar()            // → Task[]  (valida y repara lo ilegible)
Almacenamiento.guardar()           // → boolean (false si localStorage falla)
Almacenamiento.agregar(texto)      // → Task | null (recorta a 500, rechaza vacío)
Almacenamiento.alternar(id)        // → Task | null
Almacenamiento.eliminar(id)        // → boolean
Almacenamiento.pendientes()        // → número (solo !completed)
Almacenamiento.todas()             // → Task[]
Almacenamiento.disponible()        // → boolean
```

- `Task = { id, text, completed, createdAt }`; ids con `crypto.randomUUID()`
  y fallback determinista.
- **Defensivo por diseño**: JSON corrupto, entradas no-objeto, textos vacíos o
  campos ausentes se reparan o descartan sin lanzar excepciones; si
  `localStorage` lanza (Safari private mode antiguo), la app sigue en memoria.
- Puro: sin DOM. Reutilizable en cualquier web app con almacenamiento local.

## 2. `Badge` — contador del icono (Badging API)

```js
Badge.disponible()        // → boolean ('setAppBadge' in navigator)
Badge.actualizar(total)   // 0 → clearAppBadge(); n → setAppBadge(n)
```

- Silencioso ante todo: envuelve `try/catch` y `.catch()` (la API devuelve
  promesas). Si la plataforma no soporta badge, el número se muestra en la
  interfaz y nada falla.
- Cuándo llamarlo: al iniciar, tras cada mutación y al volver a primer plano
  (`visibilitychange`) para re-sincronizar.
- En iOS el badge existe solo en la app instalada y requiere el permiso de
  notificaciones.

## 3. `Permisos` — notificaciones con gesto obligatorio

```js
Permisos.soportadas()   // → boolean
Permisos.estado()       // → 'no-disponible' | 'sin-solicitar' | 'permitidas' | 'denegadas'
Permisos.solicitar()    // → Promise<'granted'|'denied'|'default'>
```

- **Regla crítica (iOS):** `solicitar()` debe invocarse de inmediato dentro
  del handler de click, ANTES de cualquier `await`: iOS consume la activación
  de usuario si hay asincronía previa y el permiso se deniega sin preguntar.
- Compatible con la forma promesa y la de callback de Safari.
- Si el usuario denegó: explicar cómo reactivar (Ajustes), sin insistir con
  diálogos automáticos.

## 4. `ControlSW` — registro de service worker

```js
ControlSW.disponible()      // → boolean
ControlSW.registrar()       // → Promise<Registration|null> (null si falla; no lanza)
ControlSW.obtenerRegistro() // → Registration|null (caché local)
ControlSW.alReemplazarse()  // recarga única cuando un SW controlante es reemplazado
```

- Registro con ruta relativa `./sw.js`: funciona bajo cualquier subruta
  (GitHub Pages sirve en `/repo/`).
- Fallos de registro degradan la app (sin offline ni push) pero nunca la
  bloquean: la lista de tareas es independiente.
- Recarga única solo si la página YA estaba controlada (evita recargar en la
  primera visita).

## 5. `Push` — suscripción Web Push con VAPID

```js
Push.soportado()        // → boolean (serviceWorker + PushManager)
Push.configurado()      // → boolean (hay clave pública en Config)
Push.enAppInstalada()   // → boolean (display-mode standalone / navigator.standalone)
Push.actual()           // → Promise<PushSubscription|null>
Push.suscribir()        // → Promise<PushSubscription> (rechaza con Error códificado)
Push.cancelar()         // → Promise<void>
```

- Errores de `suscribir()`: `'no-soportado'`, `'no-configurado'`,
  `'permiso-faltante'`, más `AbortError` nativo.
- **Reutiliza** la suscripción si su `applicationServerKey` coincide con la
  clave configurada; si difiere, cancela y crea una nueva (rotación de
  claves); si el motor no expone la clave, reutiliza (el emisor detecta el
  caso obsoleto con 404/410).
- El POST de suscripción va al servicio push (dominio externo): la CSP debe
  permitirlo en `connect-src` (aquí: `'self' https:`).
- Exportación (3 niveles, en `Interfaz`): `navigator.clipboard` en el gesto →
  textarea seleccionado + `execCommand('copy')` (el portapapeles es
  intermitente en PWAs standalone de iOS) → descarga por Blob URL.

## Side del service worker (`public/sw.js`)

- **Caché versionada**: `install` precachea el shell; `activate` borra cachés
  viejas. `fetch`: cache-first, navegaciones con fallback a `index.html`,
  `config.js` network-first (rotar la clave VAPID no exige bump de versión).
- **`push`**: parseo tolerante del payload (JSON opcional, strings recortados
  a 200 con defaults), URL de destino validada contra
  `self.registration.scope`. Jamás toca tareas ni badge.
- **`notificationclick`**: enfoca una ventana existente dentro del scope;
  si no hay, abre la URL validada. Confinar al scope evita open redirects.
- Actualización: bump de `VERSION` + redespliegue; el cliente se recarga una
  vez solo.

## Notas de migración a otra plataforma

- Los cinco módulos son agnósticos del dominio de «tareas»: solo
  `Almacenamiento` conoce el modelo; los demás son genéricos.
- Para Android/escritorio no se requiere `display: standalone` para push, y
  el badge funciona sin permiso de notificaciones; la detección por
  capacidades ya cubre ambas plataformas.
- Para un backend real de envíos, reemplaza `tools/enviar.js` por tu
  servidor conservando el contrato del payload `{title, body, url}` y las
  validaciones del SW.
