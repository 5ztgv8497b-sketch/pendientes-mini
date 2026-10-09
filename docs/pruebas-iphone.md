# Guía de pruebas en iPhone — Pendientes Mini

Marca cada casilla en el orden indicado. Requisitos: iOS/iPadOS 16.4+,
conexión a internet, computadora con Node y el repo clonado.
URL: <https://5ztgv8497b-sketch.github.io/pendientes-mini/>

> Tras cada despliegue nuevo, espera ~10 min (caché del CDN de Pages).

## Fase 1 — App estática

### A. Primer uso e instalación (flujo A)
- [x] 1. Abrir la URL en Safari con conexión: la lista aparece vacía, sin errores.
- [x] 2. Compartir → «Agregar a Inicio»: nombre «Pendientes» e icono (fondo
  oscuro con marca de verificar) correctos.
- [x] 3. Abrir desde el icono: se abre a pantalla completa (sin barra de Safari).
- [x] 4. La línea «Estado» muestra `online`.

### B. Gestión de tareas (flujo B, RF-01…RF-04)
- [x] 1. Agregar 3 tareas (usa ficticias): aparecen arriba, contador «3 pendientes».
- [x] 2. Agregar texto vacío: mensaje de error, no se agrega nada.
- [x] 3. Completar una: queda tachada, contador «2 pendientes».
- [x] 4. Reabrirla: contador «3 pendientes» de nuevo.
- [x] 5. Eliminar una: desaparece, contador se actualiza.
- [x] 6. Cerrar la app por completo y reabrir: las tareas y sus estados se
  conservan.

### C. Badge (RF-06)
Prerrequisito: Ajustes → Notificaciones → Pendientes → estilo «Banners» o
similar (y permiso concedido en el paso C de abajo).
- [x] 1. Con 3 tareas pendientes, el icono en Inicio muestra **3**.
- [x] 2. Completar una y volver a Inicio: **2**.
- [x] 3. Completar/eliminar todas: el badge desaparece (limpio).
- [x] 4. Volver a abrir la app: el contador interno siempre coincide.

### D. Permisos y notificación local (flujo C, RF-07, RF-08)
- [x] 1. Pulsar «Activar notificaciones» → el sistema pide permiso → Permitir.
- [x] 2. «Notificaciones: permitidas» en el panel de estado; el botón queda
  deshabilitado.
- [x] 3. «Probar notificación local» habilitado → al pulsarlo llega un aviso
  inmediato con «Pendientes Mini / Notificación local de prueba.».
- [ ] 4. Denegar permiso (si quieres probarlo: Ajustes → la app →
  Notificaciones → Desactivar) NO rompe nada: la lista sigue funcionando y
  la app explica cómo reactivarlo. Reactívalo después.
- [x] 5. El badge sigue mostrando el número de pendientes correcto.

### E. Offline (flujo E, RF-09)
- [ ] 1. Con la app abierta una vez (caché preparada), activar modo avión.
- [ ] 2. Cerrar la app y reabrirla desde el icono: la interfaz carga completa,
  «Estado: offline».
- [ ] 3. Agregar, completar y eliminar tareas sin conexión: todo funciona y
  persiste.
- [ ] 4. Desactivar modo avión: «Estado: online» de nuevo.
- [ ] 5. Sin conexión NO se espera recibir push ni sincronizar nada.

## Fase 2 — Push manual (RF-10…RF-13)

### F. Suscripción y exportación (flujo D.1–D.5)
- [x] 1. En la computadora: `cd tools && npm install` (una sola vez) y
  `npm run claves` si aún no existe `tools/.env`. La clave pública debe estar
  ya en `public/config.js` (desplegada).
- [x] 2. En la app instalada (no en la pestaña de Safari): «Push: no suscrito»
  y botón «Suscribirse a push» habilitado.
- [x] 3. Pulsarlo: aparece el área de exportación con el JSON.
- [x] 4. «Copiar al portapapeles» (o copia manual manteniendo pulsado el
  texto) y pegarlo en un archivo nuevo de la computadora, FUERA del
  repositorio: `~/Documents/pendientes-suscripcion.json`. Nota: en Finder la
  carpeta se muestra como «Documentos», pero Terminal entiende `~/Documents`
  (sin tilde y en inglés: es el nombre real de la carpeta).
- [x] 5. Alternativa: «Descargar JSON» desde la app y guardarlo igualmente
  fuera del repo.
- [x] 6. «Push: suscrito» en el panel de estado.

### G. Envío y recepción (flujo D.6–D.10)

Todo lo de esta sección se ejecuta **en la Mac, en Terminal**, excepto los
pasos marcados «iPhone». La idea en una frase: tu iPhone ya exportó su
«dirección de entrega» (el JSON de suscripción); ahora la Mac le manda UN
aviso a esa dirección y el iPhone lo recibe aunque esté bloqueado.

Tu archivo de suscripción: `~/Documents/pendientes-suscripcion.json`.
Truco para no escribir rutas a mano: en el comando, escribe `--file ` (con un
espacio al final) y arrastra el archivo desde Finder hasta la ventana de
Terminal; macOS pega la ruta completa por ti.

- [x ] 1. **Ensayo, no envía nada.** En Terminal, dentro de la carpeta del
  proyecto:
  ```bash
  cd ~/Documents/Proyectos/recordatorios-mini
  node tools/enviar.js --file ~/Documents/pendientes-suscripcion.json --dry-run
  ```
  Esperado: `Dry-run OK. No se envió nada.` más el endpoint enmascarado.
  Si sale esto, las claves y el JSON están correctos y puedes continuar.
- [x ] 2. **iPhone:** cierra la app del todo (desliza desde abajo, pausa en
  medio, desliza la app hacia arriba en el multitasking) y **bloquea el
  teléfono**, con Wi-Fi o datos activos. Estar bloqueado no estorba; no tener
  internet sí.
- [x ] 3. **Enviar de verdad** (Terminal):
  ```bash
  node tools/enviar.js --file ~/Documents/pendientes-suscripcion.json --title "Prueba real" --body "Enviado desde la Mac"
  ```
- [x ] 4. El Terminal imprime `Enviado.` y el endpoint enmascarado.
- [x ] 5. **iPhone:** en unos segundos el aviso aparece en la **pantalla de
  bloqueo**: «Prueba real / Enviado desde la Mac». Si no llega: Ajustes →
  Notificaciones → Pendientes → activar con «Banners» y pantalla de bloqueo,
  apagar Concentración/No molestar y reenviar (el aviso solo espera 2 minutos
  en cola: TTL 120 s).
- [x ] 6. **iPhone:** tocar el aviso → pide desbloquear → abre o enfoca la app
  dentro de su propia ruta.
- [x ] 7. Comprobar que las tareas y el contador «N pendientes» son **los
  mismos** que antes del envío: el push de prueba no modifica la lista ni el
  badge (es a propósito).
- [x ] 8. Extra: con la app abierta en primer plano, reenvía el comando del
  paso 3: el aviso llega como banner.

**Si algo falla:**

| Lo que viste en Terminal | Qué significa | Qué hacer |
|---|---|---|
| `No se pudo leer la suscripción en: …` | La ruta del archivo no existe | Arrastra el archivo al Terminal después de `--file` |
| `Dry-run OK` pero el aviso nunca llega | Ajustes del iPhone o sin internet | Banners activos, Concentración apagada, con conexión; TTL 2 min |
| `El servicio push respondió 404/410` | La suscripción caducó | En la app: Suscribirse a push → exportar de nuevo |
| `respondió 401/403` | Las claves VAPID no coinciden | Re-suscríbete con la clave pública actual |

### H. Casos de error (opcional)
- [ ] Enviar con una suscripción vieja/alterada → mensaje claro de
  «suscripción no válida, vuelve a suscribirte» (404/410), exit 1.
- [ ] `enviar.js` sin archivo de suscripción → instrucción clara, exit 1.
- [ ] En modo avión, enviar push → no llega (TTL 120 s); al recuperar
  conexión puede llegar si no expiró, o simplemente no llega.

### I. Recordatorios y tema (funciones nuevas)
- [ ] 1. Crear una tarea con «Recordatorio» a 1–2 minutos, con la app abierta:
  al llegar la hora (máx. 30 s después), llega el aviso «⏰ Recordatorio» y la
  tarea queda marcada «avisado».
- [ ] 2. Crear una tarea con recordatorio en el pasado (o esperar vencida con
  la app cerrada): al abrir la app, el aviso suena de inmediato.
- [ ] 3. Completar una tarea con recordatorio pendiente: ya no dispara aviso.
- [ ] 4. El botón 🌙/☀️ de la cabecera alterna oscuro/claro; el cambio
  persiste al cerrar y reabrir la app.
- [ ] 5. Recordatorio: con la app cerrada NO suena (limitación de iOS); el
  aviso aparece al reabrirla. Para sonido bloqueado, usa el push (sección G).

## Seguridad (verificación final)
- [ ] `git status` limpio: ni `tools/.env` ni `*.json` de suscripción en el repo.
- [ ] <https://5ztgv8497b-sketch.github.io/pendientes-mini/tools/enviar.js> → 404.
- [ ] <https://5ztgv8497b-sketch.github.io/pendientes-mini/.env> → 404.
- [ ] El código fuente de la app publicada solo contiene la clave pública VAPID.
- [ ] En capturas o logs no aparece el JSON de suscripción completo.

## Resultados
| Prueba | Fecha | Resultado | Notas |
|---|---|---|---|
| Instalación en Inicio | | ☐ OK / ☐ Fallo | |
| CRUD + persistencia | | ☐ OK / ☐ Fallo | |
| Badge 3→2→limpio | | ☐ OK / ☐ Fallo | |
| Notificación local | | ☐ OK / ☐ Fallo | |
| Offline | | ☐ OK / ☐ Fallo | |
| Suscripción + exportación | | ☐ OK / ☐ Fallo | |
| Push con app cerrada y bloqueado | | ☐ OK / ☐ Fallo | |
| Tocar aviso abre la app | | ☐ OK / ☐ Fallo | |
