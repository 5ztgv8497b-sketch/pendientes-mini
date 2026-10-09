# Pendientes Mini — README / especificación resumida del MVP

## 1. Objetivo
Construir una PWA pequeña para iPhone que permita gestionar tareas locales y experimentar con instalación en Inicio, contador del icono, funcionamiento offline y notificaciones push reales.

El objetivo es aprender y obtener componentes reutilizables para otra plataforma, no desarrollar un sistema de tareas completo.

## 2. Alcance y arquitectura

### Fase 1: aplicación estática
- HTML, CSS y JavaScript puro, sin framework ni compilación obligatoria.
- Publicación en GitHub Pages.
- Lista de tareas guardada localmente en el dispositivo.
- Instalación en la pantalla de inicio mediante Safari.
- Contador del icono según tareas pendientes.
- Caché de la interfaz para uso offline después de la primera carga correcta.
- Botón de notificación local inmediata para probar permisos y presentación.

### Fase 2: push manual desde una computadora
- Mantener la misma PWA en GitHub Pages.
- Añadir suscripción a Web Push desde la app instalada.
- Exportar manualmente el JSON de suscripción.
- Crear un script Node.js que use la librería web-push para enviar un aviso.
- Ejecutar el script cuando se quiera probar; no necesita un servidor permanentemente activo.
- Sin API pública, base de datos, cuentas de usuario ni envío automático.

```text
GitHub Pages ──sirve archivos──> PWA instalada en iPhone
                                      │
                              genera suscripción
                                      │
                         exportación manual del JSON
                                      ▼
Computadora: script Node.js + clave privada + suscripción
                                      │
                               servicio Web Push
                                      │
                                      ▼
                  Service worker del iPhone → notificación
                                      │
                               usuario la toca
                                      ▼
                              abre/enfoca la PWA
```

GitHub Pages aloja únicamente la parte estática. El script local cumple la función de emisor de push. La computadora necesita conexión al ejecutar el envío; no necesita seguir encendida después para mantener un servidor.

## 3. Pantalla única

```text
Pendientes Mini
[ Nueva tarea…                      ] [Agregar]

☐ Probar formulario                  [Eliminar]
☐ Revisar laboratorio                [Eliminar]

2 pendientes

Estado: online / offline
Notificaciones: sin solicitar / permitidas / denegadas
Push: no configurado / suscrito

[Activar notificaciones]
[Probar notificación local]
[Suscribirse a push]
[Exportar suscripción]
```

Mostrar errores comprensibles y detectar capacidades antes de utilizarlas. Si una API no está disponible, la lista de tareas debe continuar funcionando.

## 4. Requisitos funcionales

| ID | Requisito | Resultado esperado |
|---|---|---|
| RF-01 | Agregar una tarea no vacía | Aparece en la lista y se guarda localmente. |
| RF-02 | Completar o reabrir una tarea | Cambian su estado y el total de pendientes. |
| RF-03 | Eliminar una tarea | Se elimina de la lista y del almacenamiento local. |
| RF-04 | Recuperar tareas | Al volver a abrir, se conserva el estado del mismo dispositivo. |
| RF-05 | Instalar como web app | Manifest e iconos preparados para abrir la PWA desde Inicio. |
| RF-06 | Actualizar badge | setAppBadge(total); con cero pendientes, clearAppBadge(). |
| RF-07 | Solicitar notificaciones | Solo desde una acción explícita del usuario. |
| RF-08 | Mostrar aviso local | El botón utiliza el service worker para mostrar una notificación inmediata. |
| RF-09 | Abrir offline | Interfaz y tareas locales utilizables después de preparar la caché online. |
| RF-10 | Suscribirse a push | Obtener o reutilizar la suscripción con la clave pública VAPID. |
| RF-11 | Exportar suscripción | Copiar o descargar el JSON para usarlo en la computadora. |
| RF-12 | Recibir push | El service worker muestra el aviso aunque la interfaz no esté abierta. |
| RF-13 | Abrir desde el aviso | Al tocarlo, abrir o enfocar la PWA dentro de su propia ruta. |

### Reglas del contador
- Contar solamente tareas no completadas.
- Recalcular al iniciar la app y después de agregar, completar, reabrir o eliminar.
- En iPhone, su visualización depende del permiso de notificaciones y de la configuración de globos del sistema.
- Si la API no existe o falla, mostrar el número dentro de la interfaz y continuar.
- El push de prueba no modifica tareas ni el badge. Así no hay conflicto entre el contador de pendientes y los avisos recibidos.

## 5. Flujos

### A. Primer uso e instalación
1. Abrir el sitio en Safari con conexión.
2. Agregarlo a Inicio como app web.
3. Abrirlo desde el icono.
4. Registrar el service worker y preparar la caché.
5. Mostrar la lista local y el estado de las capacidades.

### B. Gestión de tareas
1. Usuario agrega o cambia una tarea.
2. Actualizar la colección y guardarla en localStorage.
3. Renderizar la lista y el total.
4. Intentar actualizar el badge si está disponible.

### C. Permisos y notificación local
1. Usuario pulsa «Activar notificaciones».
2. Solicitar permiso desde esa interacción.
3. Si acepta, habilitar la prueba local y recalcular el badge.
4. Si rechaza, explicar el estado sin insistir automáticamente.
5. «Probar notificación local» muestra un aviso inmediato.

Esta prueba NO demuestra entrega remota ni programación de recordatorios.

### D. Suscripción y envío remoto
1. Generar una vez el par de claves VAPID en la computadora.
2. Configurar únicamente la clave pública en la PWA.
3. Abrir la app instalada y autorizar notificaciones.
4. Pulsar «Suscribirse a push»; reutilizar una suscripción existente cuando sea posible.
5. Exportar su JSON y guardarlo localmente en la computadora.
6. Cerrar la PWA y bloquear el iPhone, manteniendo conectividad.
7. Ejecutar el script de envío con título y mensaje de prueba.
8. El servicio push entrega el mensaje al service worker.
9. El service worker muestra la notificación.
10. Al tocarla, abrir o enfocar la PWA.

### E. Uso offline
1. Cargar e instalar correctamente con conexión.
2. Activar modo avión.
3. Abrir la PWA y gestionar tareas locales.
4. No esperar recepción push sin conectividad ni sincronización entre dispositivos.

## 6. Datos y organización propuesta

### Modelo de tarea
```json
{
  "id": "identificador-unico",
  "text": "Revisar laboratorio",
  "completed": false,
  "createdAt": "fecha ISO"
}
```

Guardar la colección en una clave versionada de localStorage. Renderizar el texto como texto, no como HTML proporcionado por el usuario.

### Archivos
```text
/public/                     ← publicar solo esta carpeta en Pages
  index.html
  styles.css
  app.js
  config.js                  ← clave pública VAPID
  manifest.webmanifest
  sw.js
  icons/
    icon-192.png
    icon-512.png
/tools/                      ← no publicar en Pages
  package.json
  generar-claves.js
  enviar.js
  .env.example               ← nombres de variables, sin secretos
.gitignore
README.md
```

La suscripción y las claves privadas se guardan fuera del repositorio o en archivos locales ignorados por Git. La organización puede ajustarse si el programador prefiere otro mecanismo de publicación que mantenga esta separación.

### Script de envío
- Instalar la dependencia web-push.
- Leer la clave privada y la configuración VAPID desde el entorno.
- Leer el JSON de suscripción desde un archivo local.
- Enviar un payload JSON con título, cuerpo y destino interno de la app.
- Informar éxito o error sin exponer secretos ni la suscripción completa.
- Si la suscripción ya no es válida, indicar que se debe volver a suscribir/exportar.
- El comando orientativo de prueba será: `node tools/enviar.js`.

## 7. Seguridad y compatibilidad
- Nunca publicar la clave privada VAPID en GitHub ni incluirla en el frontend.
- No confundir la clave pública VAPID con la privada: solo la pública va en la PWA.
- No registrar ni publicar el JSON de suscripción en logs o capturas compartidas.
- Trabajar sobre HTTPS y probar en la PWA instalada, no solamente en una pestaña de Safari.
- Preparar manifest con nombre, iconos, start_url, scope y display standalone.
- Resolver las rutas respecto a la ubicación real de despliegue: Pages puede publicar bajo una subruta del repositorio.
- Registrar el service worker dentro de la ruta de la app y no asumir que se sirve en la raíz del dominio.
- No borrar tareas al actualizar la caché de archivos.
- Validar payloads de push y limitar el destino de apertura a la propia app.
- No prometer entrega instantánea: conectividad, permisos y ajustes del sistema afectan la recepción o presentación.

## 8. Criterios de aceptación

### Fase 1
- [ ] Sitio publicado y usable desde el iPhone.
- [ ] Instalación en Inicio con nombre e icono correctos.
- [ ] Agregar, completar, reabrir y eliminar tareas funciona.
- [ ] Tareas persisten al cerrar y abrir en el mismo dispositivo.
- [ ] Con permisos y globos habilitados, tres tareas muestran 3; completar una muestra 2; completar todas limpia el badge.
- [ ] Denegar permisos no rompe la app.
- [ ] Notificación local funciona cuando está autorizada.
- [ ] Interfaz y lista funcionan offline después de la carga inicial.

### Fase 2
- [ ] Exportación de una suscripción válida desde la app instalada.
- [ ] Script ejecutado desde la computadora envía un push real.
- [ ] Aviso recibido con la interfaz cerrada y el iPhone bloqueado, con conexión y ajustes de notificaciones adecuados.
- [ ] Tocar el aviso abre o enfoca la app.
- [ ] El aviso no altera tareas ni el contador de pendientes.
- [ ] No hay secretos ni suscripciones publicados en el repositorio o Pages.

## 9. Fuera de alcance
- Login, múltiples usuarios y sincronización entre dispositivos.
- Backend público, API, base de datos o panel administrativo.
- Recordatorios programados, cron y envíos automáticos.
- Envío desde el frontend utilizando claves privadas.
- Frameworks, analítica y funciones comerciales.
- Datos reales sensibles: utilizar tareas ficticias durante el experimento.

## 10. Entregables del programador
1. Código de la PWA y publicación de prueba en GitHub Pages.
2. Scripts locales para generar claves y enviar push.
3. README con instalación, configuración, publicación, exportación de suscripción y comando de envío.
4. Instrucciones de prueba en iPhone y checklist de resultados.
5. Documentación breve de módulos reutilizables: almacenamiento, badge, permisos, service worker y push.

## 11. Base técnica de la especificación
- GitHub Pages: hosting estático. https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- WebKit: Web Push y Badging en apps de Inicio de iOS. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Librería web-push: suscripciones, VAPID y envío desde Node.js. https://github.com/web-push-libs/web-push
- Operación offline con service workers. https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
