// ===== UTILS =====
// Escapa caracteres especiales de HTML antes de insertar texto que viene de
// un usuario (formulario de contacto, registro de clienta, etc.) dentro de
// innerHTML. Sin esto, alguien podría escribir su nombre como
// "<img src=x onerror=...>" en el formulario público, y ese código se
// ejecutaría en el navegador de la administradora al abrir el panel de
// mensajes/clientas — esto es lo que se conoce como XSS almacenado.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// Para texto que se inserta como argumento de tipo string dentro de un
// manejador onclick="...('texto')" en HTML: escapa backslash y comilla
// simple para que no rompa el string de JS (escapeHtml no sirve aquí
// porque el navegador decodifica las entidades HTML del atributo ANTES
// de que el JS del onclick vea el string, así que &#39; volvería a ser
// una comilla real).
function escapeAttrJs(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function initials(n){ return (n||'').trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?'; }
// Formatea una fecha como "dd/mm/aa, hh:mm a. m./p. m." (ej: 24/08/26, 8:37 p.m.)
function formatFechaCorta(d) {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  const hora = d.toLocaleTimeString('es-CO', {hour:'numeric', minute:'2-digit', hour12:true});
  return `${dd}/${mm}/${yy}, ${hora}`;
}
function pillClass(e){ return e==='Confirmada'?'confirmed':e==='Pendiente'?'pending':e==='Cancelada'?'cancelled':e==='Nuevo'?'new-msg':'read-msg'; }
// Traduce categorías guardadas con el nombre antiguo (de antes de renombrarlas)
// al nombre que usa la tienda hoy. Las categorías creadas de ahora en adelante
// ya se guardan directamente con su nombre final, así que no pasan por aquí.
function catLabel(cat){ return cat; }
function toast(msg, duration) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('show'), duration || 2800);
}
function updateMetrics() {
  document.getElementById('m-prod').textContent = DB.productos.length;
  document.getElementById('m-bajo').textContent = DB.productos.filter(p=>p.estado==='Poco stock'||p.estado==='Agotado').length;
  document.getElementById('m-cli').textContent = DB.clientes.length;
  const nuevos = DB.mensajes.filter(m=>m.estado==='Nuevo').length;
  document.getElementById('m-msg').textContent = nuevos;
  actualizarBadgeAdmin(nuevos);
}

// Muestra/oculta el numerito rojo junto al botón "Admin" en la barra de
// navegación con la cantidad de mensajes sin leer (estado "Nuevo").
function actualizarBadgeAdmin(cantidad) {
  const badge = document.getElementById('admin-msg-badge');
  if (!badge) return;
  if (cantidad > 0) {
    badge.textContent = cantidad > 99 ? '99+' : cantidad;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// ===== NAVIGATION =====
function cerrarTodosLosPaneles() {
  // Solo cerrar secciones principales al navegar — NO los modales internos del admin
  const ids = ['prod-modal-overlay','look-modal-overlay',
                'client-panel-overlay','auth-overlay','login-overlay'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    el.style.display = '';
  });
  document.body.style.overflow = '';
}

function showView(id, el) {
  cerrarTodosLosPaneles();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a=>a.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  if(el) el.classList.add('active');
  window.scrollTo(0,0);
  window.history.replaceState(null, '', '#' + id);
}

// ===== MOBILE NAV =====
function openMobileNav() {
  document.getElementById('mobile-nav-overlay').style.display = 'block';
  document.getElementById('mobile-nav-drawer').style.transform = 'translateX(0)';
  document.body.style.overflow = 'hidden';
}
function closeMobileNav() {
  document.getElementById('mobile-nav-overlay').style.display = 'none';
  document.getElementById('mobile-nav-drawer').style.transform = 'translateX(-100%)';
  document.body.style.overflow = '';
}

// ===== MOSTRAR/OCULTAR CONTRASEÑA =====
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.classList.toggle('pw-visible', !showing);
  btn.innerHTML = showing
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.44 3.34M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';
  btn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
}

// ===== RESTAURAR VISTA AL RECARGAR =====
document.addEventListener('DOMContentLoaded', () => {
  // Mostrar un esqueleto de carga (no productos de muestra) mientras
  // Firebase trae el inventario real. initFirebase() lo reemplaza apenas
  // Firestore responde.
  if (typeof renderProductsSkeleton === 'function') renderProductsSkeleton();
  // Mismo esqueleto de carga para el Lookbook, para no mostrar looks de
  // muestra al recargar (initFirebase() lo reemplaza cuando llegan los reales
  // o se confirma que hay que usar los predeterminados).
  if (typeof renderLookbookSkeleton === 'function') renderLookbookSkeleton();

  const id = window.location.hash.replace('#', '');
  const viewExiste = id && document.getElementById('view-' + id);
  if (viewExiste) {
    showView(id);
  }

  updateCartBadge();
  document.addEventListener('click', function() { closeDotMenus(); });
});
