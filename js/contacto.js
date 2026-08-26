// ===== NOTIFICACIONES DE MENSAJES NUEVOS (tiempo real) =====
// Escucha la colección "mensajes" en Firestore y avisa apenas llega uno nuevo,
// mientras el administrador tiene el sitio abierto en el navegador.
let _mensajesListenerActivo = false;

function wireMensajesRealtime() {
  if (!_db || _mensajesListenerActivo) return;
  _mensajesListenerActivo = true;
  import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(({ collection, onSnapshot }) => {
    let primerSnapshot = true;
    onSnapshot(collection(_db, 'mensajes'), (snap) => {
      snap.docChanges().forEach(change => {
        const data = change.doc.data();
        if (change.type === 'added') {
          if (!DB.mensajes.find(x => x.id === data.id)) DB.mensajes.unshift(data);
          if (!primerSnapshot) notificarMensajeNuevo(data);
        } else if (change.type === 'modified') {
          const idx = DB.mensajes.findIndex(x => x.id === data.id);
          if (idx > -1) DB.mensajes[idx] = data;
        } else if (change.type === 'removed') {
          DB.mensajes = DB.mensajes.filter(x => x.id !== data.id);
        }
      });
      updateMetrics();
      if (document.getElementById('admin-overlay') && document.getElementById('admin-overlay').classList.contains('open')) {
        renderAdminMensajes();
      }
      primerSnapshot = false;
    }, (err) => console.warn('Error escuchando mensajes en tiempo real:', err.message));
  });
}

// ===== CLIENTES NUEVAS EN TIEMPO REAL =====
// Igual que wireMensajesRealtime, pero para "clientes": así el panel admin
// se entera al instante cuando alguien se registra, sin tener que recargar
// la página (antes DB.clientes solo se cargaba una vez, al abrir el sitio,
// y nunca se volvía a pedir después de iniciar sesión como admin).
let _clientesListenerActivo = false;

function wireClientesRealtime() {
  if (!_db || _clientesListenerActivo) return;
  _clientesListenerActivo = true;
  import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(({ collection, onSnapshot }) => {
    let primerSnapshot = true;
    onSnapshot(collection(_db, 'clientes'), (snap) => {
      snap.docChanges().forEach(change => {
        const data = change.doc.data();
        if (change.type === 'added') {
          if (!DB.clientes.find(x => x.id === data.id)) DB.clientes.push(data);
          if (!primerSnapshot) toast('🌸 Nueva clienta registrada: ' + data.nombre);
        } else if (change.type === 'modified') {
          const idx = DB.clientes.findIndex(x => x.id === data.id);
          if (idx > -1) DB.clientes[idx] = data;
        } else if (change.type === 'removed') {
          DB.clientes = DB.clientes.filter(x => x.id !== data.id);
        }
      });
      updateMetrics();
      if (document.getElementById('admin-overlay') && document.getElementById('admin-overlay').classList.contains('open')) {
        renderAdminClientes();
      }
      primerSnapshot = false;
    }, (err) => console.warn('Error escuchando clientes en tiempo real:', err.message));
  });
}

// Pide permiso de notificaciones del navegador (se llama al abrir el panel admin)
function pedirPermisoNotificaciones() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Muestra el aviso: toast dentro del sitio + notificación del sistema (si hay permiso)
function notificarMensajeNuevo(m) {
  const numero = m.tel ? m.tel : (m.correo || 'sin datos de contacto');
  toast('📩 Nuevo mensaje de ' + m.nombre + ' — ' + numero, 5000);
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const n = new Notification('💌 Nuevo mensaje — Lashka & Insumos', {
      body: m.nombre + ' — ' + numero + (m.msg ? ('\n' + m.msg.slice(0, 90)) : '')
    });
    n.onclick = () => { window.focus(); n.close(); };
  }
}

// ===== CONTACTO PÚBLICO =====
// Limpia el error visual (borde rojo + texto) en cuanto el usuario corrige
// el campo, en vez de esperar a que vuelva a hacer clic en "Enviar mensaje".
function wireContactLiveValidation() {
  ['cnt-nombre', 'cnt-email', 'cnt-msg'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const errEl = el.parentElement.querySelector('.field-error');
      if (errEl) errEl.classList.remove('show');
    });
  });
}
document.addEventListener('DOMContentLoaded', wireContactLiveValidation);

async function sendContactMsg(recaptchaToken) {
  const nombreEl = document.getElementById('cnt-nombre');
  const msgEl = document.getElementById('cnt-msg');
  const emailEl = document.getElementById('cnt-email');
  const telEl = document.getElementById('cnt-tel');
  let ok = true;
  if (!validateField(nombreEl, /^[a-zA-ZÀ-ÿ\s]{2,}$/, 'Ingresa tu nombre')) ok = false;
  if (!validateField(emailEl, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Ingresa un correo válido')) ok = false;
  if (!validateField(msgEl, /[\s\S]+/, 'Escribe tu mensaje')) ok = false;
  if (!ok) { toast('⚠ Completa los campos requeridos'); return; }

  if (recaptchaToken) {
    const verificacion = await verifyRecaptchaToken(recaptchaToken, 'contact');
    if (!verificacion.success) { rejectRecaptcha('contact'); return; }
  }

  const nombre = nombreEl.value.trim();
  const msg = msgEl.value.trim();
  const correo = emailEl.value.trim();
  const tel = telEl ? telEl.value.trim() : '';
  const nuevoMensaje = { id: Date.now()+Math.floor(Math.random()*1000), nombre, correo, tel, asunto: document.getElementById('cnt-asunto').value, msg, estado:'Nuevo', fecha: new Date().toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) };
  DB.mensajes.unshift(nuevoMensaje);
  persistMensajePropio(nuevoMensaje).then(res => {
    if (!res.ok) {
      console.error('No se pudo guardar el mensaje:', res.error);
      toast('⚠ No se pudo enviar tu mensaje: ' + res.error);
    }
  });
  toast('✓ Mensaje enviado. ¡Gracias, ' + nombre.split(' ')[0] + '!');
  nombreEl.value=''; msgEl.value=''; emailEl.value=''; if (telEl) telEl.value='';
  document.getElementById('cnt-msg').value='';
}

// ===== ADMIN PANEL =====
function openAdmin() { document.getElementById('admin-overlay').classList.add('open'); renderAdminAll(); pedirPermisoNotificaciones(); }
function closeAdmin() { document.getElementById('admin-overlay').classList.remove('open'); document.body.style.overflow = ''; showView('home', document.querySelectorAll('.nav-links a')[0]); window.scrollTo({top:0,behavior:'smooth'}); }
function closeAdminOutside(e) { if(e.target===document.getElementById('admin-overlay')) closeAdmin(); }
function switchAdmin(id, el) {
  document.querySelectorAll('.a-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.a-nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('a-'+id).classList.add('active');
  el.classList.add('active');
}
function switchInvTab(tab, el) {
  document.getElementById('inv-sub-productos').style.display = tab==='productos' ? '' : 'none';
  document.getElementById('inv-sub-movimientos').style.display = tab==='movimientos' ? '' : 'none';
  el.closest('.filter-bar').querySelectorAll('.f-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
}
function toggleMiniForm(id) {
  const f = document.getElementById(id);
  f.style.display = (f.style.display === '' || f.style.display === 'block') ? 'none' : 'block';
}

function renderAdminAll() {
  updateMetrics();
  renderDashMovs();
  renderAdminClientes();
  renderAdminMensajes();
  renderAdminInventario();
  renderAdminMovs();
  renderCharts();
}

function renderCharts() {
  const categorias = {};
  DB.productos.forEach(p=>{ categorias[catLabel(p.cat)]=(categorias[catLabel(p.cat)]||0)+1; });
  const maxS = Math.max(...Object.values(categorias),1);
  document.getElementById('chart-servicios').innerHTML = Object.entries(categorias).length ? Object.entries(categorias).map(([k,v])=>`
    <div class="bar-row"><span class="bar-label">${k}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxS*100)}%;background:var(--rose-mid)"></div></div>
    <span class="bar-val">${v}</span></div>`).join('') : '<p style="color:var(--text-muted);font-size:12px;padding:.5rem">Sin productos aún</p>';
  const estados = {Disponible:0,'Poco stock':0,Agotado:0};
  DB.productos.forEach(p=>{ if(estados[p.estado]!==undefined) estados[p.estado]++; });
  const maxE = Math.max(...Object.values(estados),1);
  const colores = {Disponible:'var(--green)','Poco stock':'var(--amber)',Agotado:'var(--red)'};
  document.getElementById('chart-estados').innerHTML = Object.entries(estados).map(([k,v])=>`
    <div class="bar-row"><span class="bar-label">${k}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxE*100)}%;background:${colores[k]}"></div></div>
    <span class="bar-val">${v}</span></div>`).join('');
}

function renderDashMovs() {
  const el = document.getElementById('dash-movs-table');
  if (!el) return;
  el.innerHTML = DB.movimientos.slice(0,5).length ? DB.movimientos.slice(0,5).map(m=>`<tr>
    <td><div class="cell-client"><div class="avatar">${initials(m.producto)}</div>${m.producto}</div></td>
    <td><span class="pill ${m.tipo==='entrada'?'confirmed':'cancelled'}">${m.tipo==='entrada'?'📥 Entrada':'📤 Salida'}</span></td>
    <td>${m.cantidad}</td><td>${m.fecha}</td><td>${m.stockResultante}</td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin movimientos registrados</td></tr>';
}

function renderAdminClientes() {
  let data = DB.clientes.filter(c=>!clientesSearch||(c.nombre||'').toLowerCase().includes(clientesSearch.toLowerCase()));
  document.getElementById('admin-clientes-table').innerHTML = data.length ? data.map(c=>`<tr>
    <td><div class="cell-client"><div class="avatar"${c.foto?` style="background-image:url('${escapeHtml(c.foto)}');background-size:cover;background-position:center;color:transparent"`:''}>${c.foto?'':initials(c.nombre)}</div>${escapeHtml(c.nombre)||'(sin nombre)'}</div></td>
    <td style="color:var(--text-muted);font-size:12px">${escapeHtml(c.correo)||'—'}</td>
    <td style="font-size:12px">${escapeHtml(c.tel)||'—'}</td>
    <td class="cell-wrap" style="color:var(--text-muted);font-size:12px">${escapeHtml(c.ultima)||'—'}</td>
    <td>
      ${c.tel&&c.tel!=='—'?`<a class="act-btn" href="https://wa.me/${c.tel.replace(/[^0-9]/g,'')}" target="_blank" title="WhatsApp">💬</a>`:''}
      <button class="act-btn" onclick="eliminarCliente(${c.id})" title="Eliminar">🗑</button>
    </td></tr>`).join('')
  : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin clientes registradas</td></tr>';
}

function eliminarCliente(id) {
  const c = DB.clientes.find(x=>x.id===id);
  if(!c) return;
  mostrarConfirm('🗑','Eliminar cliente',`Se eliminará definitivamente a "${c.nombre}". Esta acción no se puede deshacer.`,'Sí, eliminar',function(){
    DB.clientes = DB.clientes.filter(x=>x.id!==id);
    persist(['clientes']); renderAdminClientes(); updateMetrics();
    toast('Cliente eliminada');
  });
}

let mensajesFilter = 'todos';
let mensajesSearch = '';
let _msgModalId = null;

function filterMensajes(f, el) {
  mensajesFilter = f;
  document.querySelectorAll('#a-mensajes .f-pill').forEach(p=>p.classList.remove('active'));
  if(el) el.classList.add('active');
  renderAdminMensajes();
}

function searchMensajes(v) {
  mensajesSearch = v;
  renderAdminMensajes();
}

function marcarTodosLeidos() {
  let cambios = 0;
  DB.mensajes.forEach(m => { if(m.estado === 'Nuevo') { m.estado = 'Leído'; cambios++; } });
  if(cambios) { persist(['mensajes']); renderAdminMensajes(); updateMetrics(); toast(`✅ ${cambios} mensaje${cambios>1?'s':''} marcado${cambios>1?'s':''} como leído${cambios>1?'s':''}`); }
  else toast('Todos los mensajes ya están leídos');
}

function renderAdminMensajes() {
  let data = DB.mensajes.filter(m => {
    const mf = mensajesFilter === 'todos' || m.estado === mensajesFilter;
    const ms = !mensajesSearch || m.nombre.toLowerCase().includes(mensajesSearch.toLowerCase()) ||
               (m.asunto||'').toLowerCase().includes(mensajesSearch.toLowerCase()) ||
               (m.msg||'').toLowerCase().includes(mensajesSearch.toLowerCase());
    return mf && ms;
  });
  const nuevos = DB.mensajes.filter(m => m.estado === 'Nuevo').length;
  const badge = document.getElementById('msg-nuevos-badge');
  if(badge) { badge.textContent = nuevos + ' nuevos'; badge.style.display = nuevos > 0 ? 'inline' : 'none'; }
  const lista = document.getElementById('mensajes-list');
  if (!data.length) {
    lista.innerHTML = '<div style="text-align:center;padding:2.5rem;color:var(--text-muted);font-size:13px"><span style="font-size:36px;display:block;margin-bottom:.6rem;opacity:.4">✉</span>No hay mensajes' + (mensajesSearch ? ' que coincidan con "'+mensajesSearch+'"' : '') + '</div>';
    return;
  }
  lista.innerHTML = data.map(m => {
    const esNuevo = m.estado === 'Nuevo';
    const preview = (m.msg||'').length > 90 ? m.msg.substring(0,90)+'…' : m.msg;
    return `
    <div onclick="abrirMensaje(${m.id})" style="display:flex;align-items:flex-start;gap:.9rem;padding:.9rem 1rem;margin:.3rem .3rem;border-radius:12px;cursor:pointer;border:1.5px solid ${esNuevo?'var(--blue)':'var(--cream-mid)'};background:${esNuevo?'var(--blue-light)':'var(--white)'};transition:all .15s;position:relative" onmouseover="this.style.background='var(--cream)';this.style.borderColor='var(--rose)'" onmouseout="this.style.background='${esNuevo?'var(--blue-light)':'var(--white)'};this.style.borderColor='${esNuevo?'var(--blue)':'var(--cream-mid)'}'">
      ${esNuevo ? '<span style="position:absolute;top:10px;right:12px;width:8px;height:8px;border-radius:50%;background:var(--blue)"></span>' : ''}
      <div class="avatar" style="background:${esNuevo?'var(--blue)':'var(--rose-light)'};color:${esNuevo?'#fff':'var(--rose-deep)'};flex-shrink:0;width:38px;height:38px">${initials(m.nombre)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:2px">
          <span style="font-weight:${esNuevo?'800':'700'};font-size:13px;color:var(--brown)">${escapeHtml(m.nombre)}</span>
          <span style="font-size:10px;color:var(--text-muted);margin-left:auto;flex-shrink:0">${escapeHtml(m.fecha)||''}</span>
        </div>
        <div style="font-size:12px;font-weight:700;color:${esNuevo?'var(--blue)':'var(--text-muted)'};margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📌 ${escapeHtml(m.asunto)||'Sin asunto'}</div>
        <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(preview)}</div>
        ${m.correo ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;opacity:.7">✉ ${escapeHtml(m.correo)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function abrirMensaje(id) {
  const m = DB.mensajes.find(x=>x.id===id);
  if(!m) return;
  _msgModalId = id;
  if(m.estado === 'Nuevo') { m.estado = 'Leído'; persist(['mensajes']); renderAdminMensajes(); updateMetrics(); }
  document.getElementById('msg-modal-avatar').textContent = initials(m.nombre);
  document.getElementById('msg-modal-nombre').textContent = m.nombre;
  document.getElementById('msg-modal-correo').textContent = m.correo ? '✉ '+m.correo : 'Sin correo registrado';
  document.getElementById('msg-modal-tel').innerHTML = m.tel ? `📱 <a href="https://wa.me/${m.tel.replace(/[^0-9]/g,'')}" target="_blank" style="color:inherit;text-decoration:underline">${escapeHtml(m.tel)}</a>` : '';
  document.getElementById('msg-modal-tel').style.display = m.tel ? '' : 'none';
  document.getElementById('msg-modal-asunto').textContent = '📌 ' + (m.asunto||'Sin asunto');
  document.getElementById('msg-modal-fecha').innerHTML = m.fecha ? '🕐 '+m.fecha : '';
  document.getElementById('msg-modal-texto').textContent = m.msg;
  const estadoPill = document.getElementById('msg-modal-estado-pill');
  estadoPill.textContent = m.estado;
  estadoPill.className = 'pill ' + (m.estado==='Nuevo'?'new-msg':'read-msg');
  const toggleBtn = document.getElementById('msg-toggle-estado-btn');
  toggleBtn.textContent = m.estado === 'Nuevo' ? '📖 Marcar leído' : '📬 Marcar nuevo';
  document.getElementById('msg-respuesta-texto').value = '';
  document.getElementById('msg-modal').style.display = 'flex';
}

function closeMsgModal() {
  document.getElementById('msg-modal').style.display = 'none';
  _msgModalId = null;
}

function toggleEstadoMensaje() {
  if(_msgModalId===null) return;
  const m = DB.mensajes.find(x=>x.id===_msgModalId);
  if(!m) return;
  m.estado = m.estado === 'Nuevo' ? 'Leído' : 'Nuevo';
  persist(['mensajes']); renderAdminMensajes(); updateMetrics();
  const estadoPill = document.getElementById('msg-modal-estado-pill');
  estadoPill.textContent = m.estado;
  estadoPill.className = 'pill ' + (m.estado==='Nuevo'?'new-msg':'read-msg');
  document.getElementById('msg-toggle-estado-btn').textContent = m.estado === 'Nuevo' ? '📖 Marcar leído' : '📬 Marcar nuevo';
  toast('Estado actualizado: ' + m.estado);
}

function responderMensajeWa() {
  if(_msgModalId===null) return;
  const m = DB.mensajes.find(x=>x.id===_msgModalId);
  if(!m) return;
  if(!m.tel) { toast('⚠ Esta persona no dejó número de WhatsApp'); return; }
  const tel = m.tel.replace(/[^0-9]/g,'');
  const respuesta = (document.getElementById('msg-respuesta-texto').value||'').trim();
  const saludo = `Hola ${m.nombre.split(' ')[0]}! 🌸 Te escribimos desde Lashka Insumos de Pestañas`;
  const cuerpo = respuesta ? `\n\n${respuesta}` : ` en respuesta a tu consulta sobre: "${m.asunto}".`;
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(saludo + cuerpo)}`, '_blank');
}

function responderMensajeEmail() {
  if(_msgModalId===null) return;
  const m = DB.mensajes.find(x=>x.id===_msgModalId);
  if(!m || !m.correo) { toast('⚠ Esta persona no dejó correo electrónico'); return; }
  const respuesta = (document.getElementById('msg-respuesta-texto').value||'').trim();
  const asunto = encodeURIComponent('Re: ' + (m.asunto||'Tu mensaje en Lashka'));
  const body = encodeURIComponent(
    (respuesta ? respuesta + '\n\n---\n' : '') +
    `Hola ${m.nombre.split(' ')[0]}!\n\nGracias por escribirnos.\n\nCon cariño,\nEquipo Lashka Insumos de Pestañas\nhola@lashka.com\n+57 311 208 8780`
  );
  const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(m.correo)}&su=${asunto}&body=${body}`;
  window.open(gmailUrl, '_blank');
}

function eliminarMensajeModal() {
  if(_msgModalId===null) return;
  const m = DB.mensajes.find(x=>x.id===_msgModalId);
  if(!m) return;
  mostrarConfirm('🗑','Eliminar mensaje',`Se eliminará definitivamente el mensaje de "${m.nombre}". Esta acción no se puede deshacer.`,'Sí, eliminar',function(){
    DB.mensajes = DB.mensajes.filter(x=>x.id!==_msgModalId);
    persist(['mensajes']); closeMsgModal(); renderAdminMensajes(); updateMetrics();
    toast('Mensaje eliminado');
  });
}

// marcarLeido legacy - keep for compatibility
function marcarLeido(id) {
  const m = DB.mensajes.find(x=>x.id===id);
  if(m){ m.estado='Leído'; persist(['mensajes']); renderAdminMensajes(); updateMetrics(); toast('Mensaje marcado como leído'); }
}

function renderAdminInventario() {
  document.getElementById('admin-inventario-table').innerHTML = DB.productos.map(p=>{
    const fotos = p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []);
    const fotoHTML = fotos.length > 0
      ? `<div style="width:44px;height:44px;border-radius:8px;overflow:hidden;flex-shrink:0;border:1px solid var(--cream-mid);position:relative;cursor:pointer" onclick="abrirEditorFotos(${p.id})" title="Ver/editar fotos">
          <img src="${fotos[0]}" style="width:100%;height:100%;object-fit:cover">
          ${fotos.length>1?`<span style="position:absolute;bottom:2px;right:2px;background:rgba(61,43,38,0.65);color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:5px">${fotos.length}</span>`:''}
        </div>`
      : `<div style="width:44px;height:44px;border-radius:8px;background:var(--rose-light);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;border:1px solid var(--cream-mid);cursor:pointer" onclick="abrirEditorFotos(${p.id})" title="Agregar fotos">📷</div>`;
    return `<tr>
    <td><div class="cell-client">
      ${fotoHTML}
      <span style="font-weight:700">${p.nombre}</span>
    </div></td>
    <td style="color:var(--text-muted)">${catLabel(p.cat)}</td>
    <td style="font-weight:700;color:var(--rose-deep)">${p.precio}</td>
    <td>
      <div style="display:flex;align-items:center;gap:5px">
        <button class="qty-btn" onclick="cambiarStock(${p.id},-1)" style="width:22px;height:22px;font-size:13px">−</button>
        <span style="font-weight:700;min-width:24px;text-align:center">${p.stock}</span>
        <button class="qty-btn" onclick="cambiarStock(${p.id},1)" style="width:22px;height:22px;font-size:13px">+</button>
      </div>
    </td>
    <td>
      <select onchange="cambiarEstadoProducto(${p.id},this.value)" style="border:1px solid var(--cream-mid);border-radius:8px;padding:3px 6px;font-size:11px;font-weight:700;background:var(--cream);color:var(--text);font-family:var(--ff);cursor:pointer">
        <option value="Disponible" ${p.estado==='Disponible'?'selected':''}>✅ Disponible</option>
        <option value="Poco stock" ${p.estado==='Poco stock'?'selected':''}>⚠ Poco stock</option>
        <option value="Agotado" ${p.estado==='Agotado'?'selected':''}>❌ Agotado</option>
      </select>
    </td>
    <td style="text-align:right">
      <div class="dot-menu-wrap" id="dmw-p-${p.id}">
        <button class="dot-menu-btn" onclick="toggleDotMenuProd(${p.id},event)" title="Más opciones">···</button>
        <div class="dot-dropdown" id="dd-p-${p.id}">
          <button class="dot-dropdown-item" onclick="closeDotMenus();editarNombreProducto(${p.id})">Editar nombre</button>
          <button class="dot-dropdown-item" onclick="closeDotMenus();editarCategoriaProducto(${p.id})">Editar categoría</button>
          <button class="dot-dropdown-item" onclick="closeDotMenus();editarProducto(${p.id})">Editar precio</button>
          <button class="dot-dropdown-item" onclick="closeDotMenus();editarDescripcionProducto(${p.id})">Editar descripción</button>
          <button class="dot-dropdown-item" onclick="closeDotMenus();editarBadge(${p.id})">Editar etiqueta</button>
          <button class="dot-dropdown-item" onclick="closeDotMenus();abrirEditorFotos(${p.id})">Gestionar fotos</button>
          <div class="dot-dropdown-sep"></div>
          <button class="dot-dropdown-item danger" onclick="closeDotMenus();eliminarProducto(${p.id})">Eliminar artículo</button>
        </div>
      </div>
    </td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin productos en inventario</td></tr>';
}




