# Pendientes Mini

PWA mínima para iPhone: lista de tareas 100 % local con **recordatorios por
fecha/hora**, instalable en Inicio, con contador en el icono (badge), uso
offline, temas claro/oscuro y **Web Push real** enviado a mano desde tu
computadora. Proyecto de aprendizaje: obtén componentes reutilizables
(almacenamiento, badge, permisos, service worker, push, recordatorios), no un
gestor completo.

**No es**: backend, API, base de datos, cuentas de usuario, sync entre
dispositivos ni recordatorios programados. No envíes datos sensibles: usa
tareas ficticias.

- **App publicada**: <https://5ztgv8497b-sketch.github.io/pendientes-mini/>
- **Requisitos push/badge en iPhone**: iOS/iPadOS 16.4+ y la app **instalada
  en Inicio** (en una pestaña de Safari el push no está disponible).

---

## Estructura

```text
public/        ← ÚNICA carpeta publicada en GitHub Pages (workflow de Actions)
  index.html   Pantalla única (tareas + estado + acciones)
  styles.css   Estilos (safe-areas iOS, tema claro/oscuro)
  app.js       Módulos: Almacenamiento, Badge, Permisos, ControlSW, Push, Recordatorios, Interfaz
  theme.js     Aplica el tema claro/oscuro guardado antes del primer render
  config.js    SOLO la clave pública VAPID
  manifest.webmanifest   display: standalone (requisito de push en iOS)
  sw.js        Precache versionado, offline, handlers push/notificationclick
  icons/       192 (any), 512 (maskable), 180 (apple-touch-icon)
tools/         ← NO se publica: claves VAPID y envío de push
  generar-claves.js   Genera tools/.env con el par de claves
  enviar.js           Envía UN push de prueba a una suscripción exportada
  .env.example        Nombres de variables (sin valores)
docs/          Guías de prueba en iPhone y módulos reutilizables
.github/workflows/deploy.yml   Publica solo public/ en Pages
```

La separación está garantizada por el workflow: el artifact de Pages se crea
únicamente desde `public/`. `.env`, suscripciones y `node_modules` están en
`.gitignore`.

## Publicación

Automática: cada push a `main` despliega `public/`. También puedes redesplegar
sin cambios de código desde **Actions → Deploy a Pages → Run workflow** (útil
tras cambiar `config.js`).

Primer uso del repo (ya hecho): Settings → Pages → Source: **GitHub Actions**.

Nota: el CDN de Pages cachea ~10 min; tras un despliegue, espera un poco antes
de verificar en el iPhone.

## Actualizar la app (service worker)

1. Edita los archivos en `public/`.
2. Si cambió cualquier archivo del shell, sube `VERSION` en `sw.js`
   (p. ej. `v1` → `v2`): fuerza la renovación de la caché.
3. `config.js` no necesita bump (el SW lo pide a la red primero).
4. Push a `main` y espera el despliegue. Al reabrir la app instalada, el SW
   nuevo toma control y la página se recarga una sola vez.

## Claves VAPID (una sola vez)

```bash
cd tools
npm install
npm run claves
```

- Escribe `tools/.env` con `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (archivo ignorado por Git; permisos 600).
- Copia la clave **pública** impresa en `public/config.js` y despliega.
- La **privada** nunca sale de tu computadora: no va en el frontend, ni en el
  repo, ni en capturas.
- `npm run claves` se niega a sobrescribir `.env` salvo `--force` (rotar las
  claves invalida las suscripciones ya exportadas).

## Probar push en el iPhone (resumen)

1. Abre la URL publicada en Safari → Compartir → **Agregar a Inicio**.
2. Abre la app desde el icono → **Activar notificaciones** → Permitir.
3. **Suscribirse a push** → **Exportar suscripción** → copia o descarga el JSON
   y guárdalo **fuera del repositorio** (p. ej. `~/Documents/`).
4. En la computadora:
   ```bash
   node tools/enviar.js --file ~/Documents/pendientes-suscripcion.json \
        --title "Hola" --body "Prueba de push"
   ```
5. Con la app cerrada y el iPhone bloqueado (con conexión), el aviso debe
   aparecer; al tocarlo se abre/enfoca la app.

Checklist completa: [docs/pruebas-iphone.md](docs/pruebas-iphone.md).

### Opciones de envío

```
--file   Ruta del JSON de suscripción (default: tools/subscription.json)
--title  Título (default: "Pendientes Mini")
--body   Mensaje (default español)
--url    Destino interno al tocar el aviso (default: "./")
--ttl    Segundos de vigencia si el equipo no está conectado (default: 120)
--dry-run  Valida configuración y suscripción sin enviar nada
```

Salidas de error: **404/410** → la suscripción expiró, vuelve a suscribirte y
exportar; **401/403** → las claves VAPID no coinciden con la suscripción.

## Recordatorios (fecha/hora por tarea)

Al crear una tarea puedes elegir «Recordatorio (opcional)» con fecha y hora:

- Con la app **abierta**, el aviso suena puntual (revisión cada 30 s).
- Si la app estaba cerrada a la hora, al **abrirla** el recordatorio vencido
  suena de inmediato y queda marcado «avisado».
- Los completados ya no disparan su recordatorio.

**Limitación de iOS (documentada a propósito):** una app web no puede
despertarse sola con el teléfono bloqueado o la app cerrada — la API estándar
de notificaciones programadas (`showTrigger`) no existe en WebKit. Para avisos
con el teléfono bloqueado existe el push desde la Mac (sección siguiente).
El botón 🌙/☀️ de la cabecera alterna tema oscuro/claro; sin elección, sigue
la preferencia del sistema.

## Seguridad y privacidad

- La clave privada VAPID vive solo en `tools/.env` (gitignored, jamás se
  publica ni se imprime); el emisor es tu computadora, no hay servidor.
- El JSON de suscripción equivale a la capacidad de notificarte: guárdalo
  fuera del repo y no lo compartas ni lo pegues en logs o capturas.
- CSP estricta sin JS/CSS inline; el texto de las tareas se renderiza con
  `textContent` (nunca HTML); el destino de apertura del aviso se valida
  contra el scope de la app (sin open redirects).
- Sin analítica, sin terceros, sin telemetría: las tareas nunca salen del
  dispositivo.
- El push de prueba no modifica tareas ni badge.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| El badge no aparece | Falta el permiso de notificaciones o el estilo de aviso de la app en Ajustes → Notificaciones. |
| «Push: no disponible» | Estás en una pestaña de Safari: instala la app en Inicio (iOS 16.4+). |
| «Push: no configurado» | `config.js` sin clave pública; pégala y redespliega. |
| El push no llega | Revisa conectividad, modo No molestar/Focus, y que el estilo de aviso sean banners. El aviso solo se guarda en cola durante el TTL (120 s por defecto). |
| 404/410 al enviar | Suscripción expirada: re-suscríbete y exporta de nuevo. |
| 401/403 al enviar | Regeneraste las claves VAPID: re-suscríbete con la clave pública actual. |
| Tareas no compartidas entre Safari y la app instalada | Esperado en iOS: cada contenedor tiene su propio almacenamiento. |
| Copiar no funciona en la app instalada | Usa el área de exportación: selecciona el texto y copia a mano, o descarga el JSON. |
