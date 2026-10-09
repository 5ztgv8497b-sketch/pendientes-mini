# Guía de pruebas en iPhone — Pendientes Mini

Marca cada casilla en el orden indicado. Requisitos: iOS/iPadOS 16.4+,
conexión a internet, computadora con Node y el repo clonado.
URL: <https://5ztgv8497b-sketch.github.io/pendientes-mini/>

> Tras cada despliegue nuevo, espera ~10 min (caché del CDN de Pages).

## Fase 1 — App estática

### A. Primer uso e instalación (flujo A)
- [ ] 1. Abrir la URL en Safari con conexión: la lista aparece vacía, sin errores.
- [ ] 2. Compartir → «Agregar a Inicio»: nombre «Pendientes» e icono (fondo
  oscuro con marca de verificar) correctos.
- [ ] 3. Abrir desde el icono: se abre a pantalla completa (sin barra de Safari).
- [ ] 4. La línea «Estado» muestra `online`.

### B. Gestión de tareas (flujo B, RF-01…RF-04)
- [ ] 1. Agregar 3 tareas (usa ficticias): aparecen arriba, contador «3 pendientes».
- [ ] 2. Agregar texto vacío: mensaje de error, no se agrega nada.
- [ ] 3. Completar una: queda tachada, contador «2 pendientes».
- [ ] 4. Reabrirla: contador «3 pendientes» de nuevo.
- [ ] 5. Eliminar una: desaparece, contador se actualiza.
- [ ] 6. Cerrar la app por completo y reabrir: las tareas y sus estados se
  conservan.

### C. Badge (RF-06)
Prerrequisito: Ajustes → Notificaciones → Pendientes → estilo «Banners» o
similar (y permiso concedido en el paso C de abajo).
- [ ] 1. Con 3 tareas pendientes, el icono en Inicio muestra **3**.
- [ ] 2. Completar una y volver a Inicio: **2**.
- [ ] 3. Completar/eliminar todas: el badge desaparece (limpio).
- [ ] 4. Volver a abrir la app: el contador interno siempre coincide.

### D. Permisos y notificación local (flujo C, RF-07, RF-08)
- [ ] 1. Pulsar «Activar notificaciones» → el sistema pide permiso → Permitir.
- [ ] 2. «Notificaciones: permitidas» en el panel de estado; el botón queda
  deshabilitado.
- [ ] 3. «Probar notificación local» habilitado → al pulsarlo llega un aviso
  inmediato con «Pendientes Mini / Notificación local de prueba.».
- [ ] 4. Denegar permiso (si quieres probarlo: Ajustes → la app →
  Notificaciones → Desactivar) NO rompe nada: la lista sigue funcionando y
  la app explica cómo reactivarlo. Reactívalo después.
- [ ] 5. El badge sigue mostrando el número de pendientes correcto.

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
- [ ] 1. En la computadora: `cd tools && npm install` (una sola vez) y
  `npm run claves` si aún no existe `tools/.env`. La clave pública debe estar
  ya en `public/config.js` (desplegada).
- [ ] 2. En la app instalada (no en la pestaña de Safari): «Push: no suscrito»
  y botón «Suscribirse a push» habilitado.
- [ ] 3. Pulsarlo: aparece el área de exportación con el JSON.
- [ ] 4. «Copiar al portapapeles» (o copia manual manteniendo pulsado el
  texto) y pegarlo en un archivo en la computadora, FUERA del repositorio,
  p. ej. `~/Documentos/pendientes-suscripcion.json`.
- [ ] 5. Alternativa: «Descargar JSON» desde la app y guardarlo igualmente
  fuera del repo.
- [ ] 6. «Push: suscrito» en el panel de estado.

### G. Envío y recepción (flujo D.6–D.10)
- [ ] 1. Validar sin enviar: `node tools/enviar.js --file ~/Documentos/pendientes-suscripcion.json --dry-run`
- [ ] 2. Cerrar la app instalada (deslizarla fuera del multitasking) y
  **bloquear el iPhone**, con Wi-Fi/datos activos.
- [ ] 3. Enviar: `node tools/enviar.js --file ~/Documentos/pendientes-suscripcion.json --title "Prueba real" --body "Enviado desde la Mac"`
- [ ] 4. El script imprime «Enviado.» con el endpoint enmascarado.
- [ ] 5. El aviso aparece en la **pantalla de bloqueo** (puede tardar unos
  segundos; requiere conectividad y estilo de aviso «Banners»).
- [ ] 6. Tocar el aviso: se desbloquea y abre/enfoca la app dentro de su ruta.
- [ ] 7. El aviso **no** altera las tareas ni el contador/badge (el número de
  pendientes es el mismo que antes del envío).
- [ ] 8. Repetir un envío con la app abierta en primer plano: llega como banner.

### H. Casos de error (opcional)
- [ ] Enviar con una suscripción vieja/alterada → mensaje claro de
  «suscripción no válida, vuelve a suscribirte» (404/410), exit 1.
- [ ] `enviar.js` sin archivo de suscripción → instrucción clara, exit 1.
- [ ] En modo avión, enviar push → no llega (TTL 120 s); al recuperar
  conexión puede llegar si no expiró, o simplemente no llega.

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
