/* Pendientes Mini — lógica de la app (sin framework, sin build).
 *
 * Módulos reutilizables (ver docs/modulos-reutilizables.md):
 *   Config, Almacenamiento, Badge, Permisos, ControlSW, Push,
 *   Recordatorios, Interfaz (incluye el conmutador de tema).
 *
 * Reglas fijas:
 *   - El texto de las tareas se renderiza SIEMPRE con textContent, nunca HTML.
 *   - El permiso de notificaciones se pide SOLO desde un gesto del usuario.
 *   - Los recordatorios suenan con la app abierta (iOS no permite temporizadores
 *     en segundo plano en apps web); los vencidos se muestran al abrirla.
 *   - Los errores se muestran en español y nunca bloquean la lista de tareas.
 */

'use strict';

/* ============================================================
 * Config — configuración pública inyectada por config.js
 * ============================================================ */

const Config = {
  get vapidPublicKey() {
    const cfg = window.PENDIENTES_CONFIG || {};
    return typeof cfg.vapidPublicKey === 'string' ? cfg.vapidPublicKey.trim() : '';
  },
};

/* ============================================================
 * Almacenamiento — colección de tareas en localStorage versionado
 * ============================================================ */

const Almacenamiento = (() => {
  const CLAVE = 'pendientes-mini:v1:tasks';
  const LONGITUD_TEXTO_MAX = 500;
  let tareas = [];

  function generadorId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function disponible() {
    try {
      return !!window.localStorage;
    } catch {
      return false; // Safari puede lanzar al siquiera tocar localStorage
    }
  }

  /* Acepta "2026-10-09T15:30" (datetime-local) o ISO; devuelve ISO o null. */
  function normalizarFecha(valor) {
    if (typeof valor !== 'string' || !valor) return null;
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
  }

  function validarTarea(bruta) {
    if (!bruta || typeof bruta !== 'object') return null;
    const texto = typeof bruta.text === 'string' ? bruta.text.trim().slice(0, LONGITUD_TEXTO_MAX) : '';
    if (!texto) return null;
    return {
      id: typeof bruta.id === 'string' && bruta.id ? bruta.id : generadorId(),
      text: texto,
      completed: bruta.completed === true,
      createdAt:
        typeof bruta.createdAt === 'string' && bruta.createdAt
          ? bruta.createdAt
          : new Date().toISOString(),
      remindAt: normalizarFecha(bruta.remindAt),
      reminderFired: bruta.reminderFired === true,
    };
  }

  function cargar() {
    tareas = [];
    if (!disponible()) return tareas;
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return tareas;
      const datos = JSON.parse(crudo);
      if (!Array.isArray(datos)) return tareas;
      tareas = datos.map(validarTarea).filter(Boolean);
    } catch {
      tareas = []; // almacenamiento corrupto: empezar limpio sin romper
    }
    return tareas;
  }

  function guardar() {
    if (!disponible()) return false;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(tareas));
      return true;
    } catch {
      return false;
    }
  }

  function agregar(texto, remindAt) {
    const limpio = String(texto ?? '').trim().slice(0, LONGITUD_TEXTO_MAX);
    if (!limpio) return null;
    const tarea = {
      id: generadorId(),
      text: limpio,
      completed: false,
      createdAt: new Date().toISOString(),
      remindAt: normalizarFecha(remindAt),
      reminderFired: false,
    };
    tareas.unshift(tarea);
    return tarea;
  }

  function alternar(id) {
    const tarea = tareas.find((t) => t.id === id);
    if (tarea) tarea.completed = !tarea.completed;
    return tarea || null;
  }

  function eliminar(id) {
    const antes = tareas.length;
    tareas = tareas.filter((t) => t.id !== id);
    return tareas.length < antes;
  }

  function marcarRecordatorioMostrado(id) {
    const tarea = tareas.find((t) => t.id === id);
    if (tarea) tarea.reminderFired = true;
    return !!tarea;
  }

  function pendientes() {
    return tareas.filter((t) => !t.completed).length;
  }

  function todas() {
    return tareas;
  }

  return {
    cargar, guardar, agregar, alternar, eliminar,
    marcarRecordatorioMostrado, pendientes, todas, disponible,
  };
})();

/* ============================================================
 * Badge — contador del icono (Badging API)
 * ============================================================ */

const Badge = (() => {
  function disponible() {
    return typeof navigator.setAppBadge === 'function';
  }

  function actualizar(total) {
    if (!disponible()) return;
    try {
      if (total > 0) {
        const r = navigator.setAppBadge(total);
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } else {
        const r = navigator.clearAppBadge();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      }
    } catch {
      /* sin badge: la interfaz muestra el número */
    }
  }

  return { disponible, actualizar };
})();

/* ============================================================
 * Permisos — estado y solicitud de notificaciones
 * ============================================================ */

const Permisos = (() => {
  function soportadas() {
    return 'Notification' in window;
  }

  function estado() {
    if (!soportadas()) return 'no-disponible';
    switch (Notification.permission) {
      case 'granted': return 'permitidas';
      case 'denied': return 'denegadas';
      default: return 'sin-solicitar';
    }
  }

  /* Debe llamarse de inmediato dentro del handler de click:
     iOS pierde la activación de usuario si hay un await previo. */
  function solicitar() {
    if (!soportadas()) return Promise.resolve('denied');
    try {
      const r = Notification.requestPermission();
      if (r && typeof r.then === 'function') return r;
      return Promise.resolve(r);
    } catch {
      return Promise.resolve(Notification.permission);
    }
  }

  return { soportadas, estado, solicitar };
})();

/* ============================================================
 * ControlSW — registro del service worker
 * ============================================================ */

const ControlSW = (() => {
  let registro = null;

  function disponible() {
    return 'serviceWorker' in navigator;
  }

  async function registrar() {
    if (!disponible()) return null;
    try {
      registro = await navigator.serviceWorker.register('./sw.js');
      return registro;
    } catch {
      registro = null;
      return null;
    }
  }

  /* Recarga única cuando un SW ya controlante es reemplazado (actualización).
     La primera activación no recarga: evitaría un reload en cada primera visita. */
  function alReemplazarse() {
    const yaControlada = !!navigator.serviceWorker.controller;
    let recargaProgramada = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!yaControlada || recargaProgramada) return;
      recargaProgramada = true;
      window.location.reload();
    });
  }

  function obtenerRegistro() {
    return registro;
  }

  return { disponible, registrar, alReemplazarse, obtenerRegistro };
})();

/* ============================================================
 * Push — suscripción Web Push con VAPID
 * ============================================================ */

const Push = (() => {
  function soportado() {
    return ControlSW.disponible() && 'PushManager' in window;
  }

  function configurado() {
    return Config.vapidPublicKey.length > 0;
  }

  function enAppInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function uint8ArrayABase64url(bytes) {
    let binario = '';
    bytes.forEach((b) => { binario += String.fromCharCode(b); });
    return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function urlBase64AUint8Array(base64url) {
    const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  async function manager() {
    const reg = ControlSW.obtenerRegistro() || (await navigator.serviceWorker.ready);
    if (!reg || !reg.pushManager) return null;
    return reg.pushManager;
  }

  async function actual() {
    try {
      const pm = await manager();
      return pm ? pm.getSubscription() : null;
    } catch {
      return null;
    }
  }

  /* Reutiliza la suscripción si su clave coincide con la configurada;
     si difiere, cancela y crea una nueva; si el motor no expone la clave,
     reutiliza (el flujo 404/410 del emisor cubre el caso obsoleto). */
  async function suscribir() {
    if (!soportado()) throw new Error('no-soportado');
    if (!configurado()) throw new Error('no-configurado');
    if (Permisos.estado() !== 'permitidas') throw new Error('permiso-faltante');

    const pm = await manager();
    const claveBytes = urlBase64AUint8Array(Config.vapidPublicKey);
    const existente = await pm.getSubscription();

    if (existente) {
      const claveActual = existente.options && existente.options.applicationServerKey;
      if (!claveActual) return existente; // no comparable: reutilizar
      const actualB64 = uint8ArrayABase64url(new Uint8Array(claveActual));
      if (actualB64 === Config.vapidPublicKey) return existente;
      await existente.unsubscribe();
    }

    return pm.subscribe({
      userVisibleOnly: true,
      applicationServerKey: claveBytes,
    });
  }

  async function cancelar() {
    const sub = await actual();
    if (sub) await sub.unsubscribe();
  }

  return { soportado, configurado, enAppInstalada, actual, suscribir, cancelar };
})();

/* ============================================================
 * Recordatorios — avisos locales por fecha/hora (solo con la app visible)
 *
 * iOS no permite temporizadores en segundo plano en apps web ni ofrece
 * showTrigger: por eso la revisión corre en primer plano (cada 30 s, al
 * abrir y al volver a la app). Un recordatorio vencido suena al abrirse.
 * ============================================================ */

const Recordatorios = (() => {
  const INTERVALO_MS = 30000;

  function fechaLegible(iso) {
    try {
      return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  async function revisar() {
    if (document.visibilityState !== 'visible') return;
    if (Permisos.estado() !== 'permitidas') return;

    const registro = ControlSW.obtenerRegistro() ||
      (ControlSW.disponible() ? await navigator.serviceWorker.ready : null);
    if (!registro) return;

    const ahora = Date.now();
    let huboCambios = false;

    for (const tarea of Almacenamiento.todas()) {
      if (!tarea.remindAt || tarea.reminderFired || tarea.completed) continue;
      if (Date.parse(tarea.remindAt) > ahora) continue;

      try {
        await registro.showNotification('⏰ Recordatorio', {
          body: tarea.text,
          tag: `recordatorio-${tarea.id}`,
          icon: './icons/icon-192.png',
          data: { url: './' },
        });
      } catch {
        /* sin permiso o fallo puntual: igualmente lo marcamos para no repetir */
      }
      Almacenamiento.marcarRecordatorioMostrado(tarea.id);
      huboCambios = true;
    }

    if (huboCambios) {
      Almacenamiento.guardar();
      Interfaz.renderLista();
    }
  }

  function iniciar() {
    revisar();
    setInterval(revisar, INTERVALO_MS);
  }

  function fechaTexto(iso) {
    return fechaLegible(iso);
  }

  return { iniciar, revisar, fechaTexto };
})();

/* ============================================================
 * Interfaz — render, eventos y conmutador de tema
 * ============================================================ */

const Interfaz = (() => {
  const $ = (id) => document.getElementById(id);
  const CLAVE_TEMA = 'pendientes-mini:v1:theme';
  let suscripcionActual = null;

  const refs = {}; // se llena en init

  /* ---------- tema claro/oscuro ---------- */

  function temaEfectivo() {
    const explicito = document.documentElement.getAttribute('data-theme');
    if (explicito === 'claro' || explicito === 'oscuro') return explicito;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try {
      localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      /* sin persistencia: el tema vive solo en esta vista */
    }
    refs.btnTema.textContent = tema === 'oscuro' ? '☀️ Claro' : '🌙 Oscuro';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tema === 'oscuro' ? '#0d0a1f' : '#f6f4ff');
  }

  function alternarTema() {
    aplicarTema(temaEfectivo() === 'oscuro' ? 'claro' : 'oscuro');
  }

  /* ---------- mensajes ---------- */

  function mensaje(texto, tipo = 'info') {
    refs.mensaje.textContent = texto;
    refs.mensaje.className = `mensaje ${tipo}`.trim();
    refs.mensaje.hidden = false;
  }

  function ocultarMensaje() {
    refs.mensaje.hidden = true;
    refs.mensaje.textContent = '';
    refs.mensaje.className = 'mensaje';
  }

  /* ---------- render de lista y contador ---------- */

  function renderLista() {
    const { lista, vacia } = refs;
    lista.textContent = '';

    const todas = Almacenamiento.todas();
    vacia.hidden = todas.length > 0;
    lista.hidden = todas.length === 0;

    for (const tarea of todas) {
      const li = document.createElement('li');
      if (tarea.completed) li.classList.add('completada');

      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.checked = tarea.completed;
      casilla.dataset.id = tarea.id;
      casilla.setAttribute('aria-label', `Completar: ${tarea.text}`);

      const texto = document.createElement('span');
      texto.className = 'texto';
      texto.textContent = tarea.text; // NUNCA innerHTML: el texto es del usuario

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'eliminar';
      boton.textContent = 'Eliminar';
      boton.dataset.id = tarea.id;
      boton.setAttribute('aria-label', `Eliminar: ${tarea.text}`);

      li.append(casilla, texto, boton);

      if (tarea.remindAt) {
        const cuando = document.createElement('span');
        cuando.className = 'cuando';
        cuando.textContent = `⏰ ${Recordatorios.fechaTexto(tarea.remindAt)}`;
        if (!tarea.completed && !tarea.reminderFired && Date.parse(tarea.remindAt) <= Date.now()) {
          cuando.classList.add('vencida');
          cuando.textContent += ' · vencido';
        } else if (tarea.reminderFired && !tarea.completed) {
          cuando.classList.add('mostrada');
          cuando.textContent += ' · avisado';
        }
        li.append(cuando);
      }

      lista.append(li);
    }

    renderContador();
  }

  function renderContador() {
    const total = Almacenamiento.pendientes();
    refs.contador.textContent = total === 1 ? '1 pendiente' : `${total} pendientes`;
    Badge.actualizar(total);
  }

  /* ---------- estado de capacidades, con punto de color ---------- */

  function claseConexion() {
    return navigator.onLine ? 'ok' : 'mal';
  }

  function claseNotificaciones() {
    switch (Permisos.estado()) {
      case 'permitidas': return 'ok';
      case 'denegadas':
      case 'no-disponible': return 'mal';
      default: return 'medio';
    }
  }

  function clasePush() {
    if (!Push.soportado()) return 'mal';
    if (!Push.configurado()) return 'medio';
    if (suscripcionActual) return 'ok';
    return 'medio';
  }

  function renderEstado() {
    refs.estadoConexion.textContent = navigator.onLine ? 'online' : 'offline';
    refs.estadoConexion.className = claseConexion();

    switch (Permisos.estado()) {
      case 'permitidas': refs.estadoNotificaciones.textContent = 'permitidas'; break;
      case 'denegadas': refs.estadoNotificaciones.textContent = 'denegadas'; break;
      case 'no-disponible': refs.estadoNotificaciones.textContent = 'no disponibles'; break;
      default: refs.estadoNotificaciones.textContent = 'sin solicitar';
    }
    refs.estadoNotificaciones.className = claseNotificaciones();

    if (!Push.soportado()) {
      refs.estadoPush.textContent = 'no disponible';
    } else if (!Push.configurado()) {
      refs.estadoPush.textContent = 'no configurado';
    } else if (suscripcionActual) {
      refs.estadoPush.textContent = 'suscrito';
    } else if (!Push.enAppInstalada()) {
      refs.estadoPush.textContent = 'no suscrito (instala la app en Inicio)';
    } else {
      refs.estadoPush.textContent = 'no suscrito';
    }
    refs.estadoPush.className = clasePush();

    renderBotones();
  }

  function renderBotones() {
    const permiso = Permisos.estado();
    const swOk = !!(ControlSW.obtenerRegistro() || (ControlSW.disponible() && navigator.serviceWorker.controller));

    refs.btnPermiso.disabled = !Permisos.soportadas() || permiso === 'permitidas';
    refs.btnLocal.disabled = !(permiso === 'permitidas' && swOk);
    refs.btnSuscribir.disabled = !(permiso === 'permitidas' && Push.soportado() && Push.configurado());
    refs.btnExportar.disabled = !suscripcionActual;
  }

  /* ---------- acciones ---------- */

  async function refrescarSuscripcion() {
    suscripcionActual = await Push.actual();
    renderEstado();
  }

  async function activarNotificaciones() {
    /* Gesto puro: pedir permiso ANTES de cualquier await. */
    const resultado = await Permisos.solicitar();
    if (resultado === 'granted') {
      mensaje('Notificaciones activadas.');
      Badge.actualizar(Almacenamiento.pendientes()); // recalcular al aceptar
      Recordatorios.revisar(); // por si hay vencidos esperando permiso
    } else if (resultado === 'denied' && Permisos.estado() === 'denegadas') {
      mensaje('Permiso denegado. Para activarlo: Ajustes → Safari (o la app) → Notificaciones, y vuelve a abrir Pendientes.', 'error');
    } else {
      mensaje('Permiso de notificaciones sin conceder.', 'error');
    }
    renderEstado();
  }

  async function notificacionLocal() {
    const registro = ControlSW.obtenerRegistro() || (await navigator.serviceWorker.ready);
    if (!registro) {
      mensaje('El service worker no está disponible; recarga e inténtalo de nuevo.', 'error');
      return;
    }
    try {
      await registro.showNotification('Pendientes Mini', {
        body: 'Notificación local de prueba.',
        tag: 'pendientes-mini-local',
        icon: './icons/icon-192.png',
      });
      mensaje('Notificación local enviada.');
    } catch {
      mensaje('No se pudo mostrar la notificación local.', 'error');
    }
  }

  async function suscribirsePush() {
    try {
      const sub = await Push.suscribir();
      suscripcionActual = sub;
      mensaje('Suscripción creada. Ya puedes exportarla.');
      mostrarExportacion();
    } catch (error) {
      suscripcionActual = await Push.actual();
      if (error && error.name === 'AbortError') {
        mensaje('Suscripción cancelada por el sistema.', 'error');
      } else if (error && error.message === 'no-configurado') {
        mensaje('Push sin configurar: falta la clave pública VAPID en config.js.', 'error');
      } else if (error && error.message === 'permiso-faltante') {
        mensaje('Primero activa las notificaciones.', 'error');
      } else {
        mensaje('No se pudo crear la suscripción push en este contexto.', 'error');
      }
    }
    renderEstado();
  }

  function mostrarExportacion() {
    if (!suscripcionActual) return;
    refs.textoExportacion.value = JSON.stringify(suscripcionActual.toJSON());
    refs.areaExportacion.hidden = false;
    renderEstado();
  }

  async function copiarSuscripcion() {
    const json = refs.textoExportacion.value;
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      mensaje('Suscripción copiada al portapapeles.');
      return;
    } catch {
      /* fallback abajo */
    }
    try {
      refs.textoExportacion.select();
      refs.textoExportacion.setSelectionRange(0, json.length);
      const ok = document.execCommand('copy');
      refs.textoExportacion.setSelectionRange(0, 0);
      if (ok) {
        mensaje('Suscripción copiada. Si falla, mantenla pulsada y copia a mano.');
      } else {
        mensaje('Copia manual: mantén pulsado el texto y elige Copiar.');
      }
    } catch {
      mensaje('Copia manual: mantén pulsado el texto y elige Copiar.');
    }
  }

  function descargarSuscripcion() {
    const json = refs.textoExportacion.value;
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'pendientes-suscripcion.json';
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    mensaje('Descarga iniciada. Guarda el JSON fuera del repositorio.');
  }

  /* ---------- tareas ---------- */

  function mutarTareas(operacion) {
    const resultado = operacion();
    const guardado = Almacenamiento.guardar();
    renderLista();
    renderEstado();
    if (!guardado) {
      mensaje('No se pudo guardar en este dispositivo; los cambios viven solo en memoria.', 'error');
    }
    return resultado;
  }

  function configurarEventos() {
    refs.formNueva.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const texto = refs.inputTarea.value;
      if (!texto.trim()) {
        mensaje('Escribe el texto de la tarea antes de agregar.', 'error');
        refs.inputTarea.focus();
        return;
      }
      const remindAt = refs.inputRecordatorio.value
        ? new Date(refs.inputRecordatorio.value).toISOString()
        : null;
      mutarTareas(() => Almacenamiento.agregar(texto, remindAt));
      refs.inputTarea.value = '';
      refs.inputRecordatorio.value = '';
      ocultarMensaje();
      refs.inputTarea.focus();
    });

    /* Delegación de eventos en la lista */
    refs.lista.addEventListener('change', (evento) => {
      const id = evento.target.dataset && evento.target.dataset.id;
      if (id) mutarTareas(() => Almacenamiento.alternar(id));
    });

    refs.lista.addEventListener('click', (evento) => {
      const id = evento.target.dataset && evento.target.dataset.id;
      if (id && evento.target.classList.contains('eliminar')) {
        mutarTareas(() => Almacenamiento.eliminar(id));
      }
    });

    refs.btnPermiso.addEventListener('click', () => {
      activarNotificaciones();
    });

    refs.btnLocal.addEventListener('click', () => {
      notificacionLocal();
    });

    refs.btnSuscribir.addEventListener('click', () => {
      suscribirsePush();
    });

    refs.btnExportar.addEventListener('click', () => {
      mostrarExportacion();
      refs.textoExportacion.focus();
    });

    refs.btnCopiar.addEventListener('click', () => {
      copiarSuscripcion();
    });

    refs.btnDescargar.addEventListener('click', () => {
      descargarSuscripcion();
    });

    refs.btnTema.addEventListener('click', () => {
      alternarTema();
    });

    window.addEventListener('online', renderEstado);
    window.addEventListener('offline', renderEstado);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      Badge.actualizar(Almacenamiento.pendientes()); // re-sincronizar
      renderEstado();
      refrescarSuscripcion();
      Recordatorios.revisar(); // vencidos mientras estuvo en segundo plano
    });
  }

  /* ---------- arranque ---------- */

  async function init() {
    Object.assign(refs, {
      formNueva: $('form-nueva'),
      inputTarea: $('input-tarea'),
      inputRecordatorio: $('input-recordatorio'),
      btnTema: $('btn-tema'),
      lista: $('lista-tareas'),
      vacia: $('lista-vacia'),
      contador: $('contador'),
      estadoConexion: $('estado-conexion'),
      estadoNotificaciones: $('estado-notificaciones'),
      estadoPush: $('estado-push'),
      mensaje: $('mensaje'),
      btnPermiso: $('btn-permiso'),
      btnLocal: $('btn-local'),
      btnSuscribir: $('btn-suscribir'),
      btnExportar: $('btn-exportar'),
      areaExportacion: $('area-exportacion'),
      textoExportacion: $('texto-exportacion'),
      btnCopiar: $('btn-copiar'),
      btnDescargar: $('btn-descargar'),
    });

    aplicarTema(temaEfectivo());

    Almacenamiento.cargar();
    renderLista();
    renderEstado();

    configurarEventos();

    ControlSW.alReemplazarse();
    const registro = await ControlSW.registrar();
    renderEstado(); // habilita "Probar notificación local" si corresponde

    if (Permisos.estado() === 'permitidas') {
      Badge.actualizar(Almacenamiento.pendientes());
    }

    Recordatorios.iniciar();
    await refrescarSuscripcion();

    if (!ControlSW.disponible()) {
      mensaje('Este navegador no soporta service workers: la app funciona, pero sin offline ni notificaciones.', 'error');
    } else if (!registro) {
      mensaje('El service worker no se registró: sin offline ni notificaciones hasta resolverlo.', 'error');
    }
  }

  return { init, renderLista };
})();

Interfaz.init();
