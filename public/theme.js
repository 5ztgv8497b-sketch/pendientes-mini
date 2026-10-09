/* Aplica el tema elegido antes del primer render (evita el destello).
 * Sin preferencia guardada → sigue la preferencia del sistema vía CSS. */
(function () {
  'use strict';
  try {
    var tema = localStorage.getItem('pendientes-mini:v1:theme');
    if (tema === 'claro' || tema === 'oscuro') {
      document.documentElement.setAttribute('data-theme', tema);
    }
  } catch (e) {
    /* sin localStorage: el CSS usa la preferencia del sistema */
  }
})();
