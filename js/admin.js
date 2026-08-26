let _confirmCallback = null;

// Borra un documento individual de Firestore
async function borrarDocFirestore(coleccion, docId) {
  if (!_db) return;
  try {
    const { doc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await deleteDoc(doc(collection(_db, coleccion), docId));
  } catch(e) { console.warn('Error borrando doc Firestore:', e.message); }
}

// ── Modal de confirmación genérico ──
function mostrarConfirm(icon, titulo, msg, okLabel, callback) {
  _confirmCallback = callback;
  document.getElementById('confirm-icon').textContent = icon;
  document.getElementById('confirm-title').textContent = titulo;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok-btn').textContent = okLabel;
  document.getElementById('confirm-overlay').classList.add('open');
}
function cerrarConfirmModal() {
  document.getElementById('confirm-overlay').classList.remove('open');
  _confirmCallback = null;
}
function cerrarConfirm(e) {
  if (e.target === document.getElementById('confirm-overlay')) cerrarConfirmModal();
}
function ejecutarConfirm() {
  if (_confirmCallback) _confirmCallback();
  cerrarConfirmModal();
}



function toggleDotMenu(id, e) {
  e.stopPropagation();
  const dd = document.getElementById('dd-' + id);
  const btn = e.currentTarget;
  const isOpen = dd.classList.contains('open');
  closeDotMenus();
  if (!isOpen) {
    const rect = btn.getBoundingClientRect();
    dd.style.top = '';
    dd.style.bottom = '';
    dd.style.left = '';
    dd.style.right = '';
    dd.classList.add('open');
    requestAnimationFrame(() => {
      const ddH = dd.offsetHeight;
      const ddW = dd.offsetWidth;
      const spaceBelow = window.innerHeight - rect.bottom;
      const leftPos = Math.max(8, rect.right - ddW);
      dd.style.left = leftPos + 'px';
      if (spaceBelow < ddH + 8) {
        dd.style.top = Math.max(8, rect.top - ddH - 4) + 'px';
      } else {
        dd.style.top = (rect.bottom + 4) + 'px';
      }
    });
  }
}
function closeDotMenus() {
  document.querySelectorAll('.dot-dropdown.open').forEach(d => d.classList.remove('open'));
}

function toggleDotMenuProd(id, e) {
  e.stopPropagation();
  const dd = document.getElementById('dd-p-' + id);
  const btn = e.currentTarget;
  const isOpen = dd.classList.contains('open');
  closeDotMenus();
  if (!isOpen) {
    const rect = btn.getBoundingClientRect();
    dd.style.top = '';
    dd.style.bottom = '';
    dd.style.left = '';
    dd.style.right = '';
    dd.classList.add('open');
    requestAnimationFrame(() => {
      const ddH = dd.offsetHeight;
      const ddW = dd.offsetWidth;
      const spaceBelow = window.innerHeight - rect.bottom;
      // Posición horizontal: alineado a la derecha del botón
      const leftPos = Math.max(8, rect.right - ddW);
      dd.style.left = leftPos + 'px';
      // Posición vertical: arriba si no cabe abajo
      if (spaceBelow < ddH + 8) {
        dd.style.top = Math.max(8, rect.top - ddH - 4) + 'px';
      } else {
        dd.style.top = (rect.bottom + 4) + 'px';
      }
    });
  }
}

// ── close msg modal clicking outside ──
document.addEventListener('click', function(e) {
  const modal = document.getElementById('msg-modal');
  if(modal && e.target === modal) closeMsgModal();
});

// ===== INVENTARIO ACCIONES =====
function cambiarStock(id, delta) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  const stockAnterior = p.stock||0;
  p.stock = Math.max(0, stockAnterior + delta);
  const cantidadReal = p.stock - stockAnterior;
  // Auto-actualizar estado según stock
  if(p.stock === 0) p.estado = 'Agotado';
  else if(p.stock <= 3) p.estado = 'Poco stock';
  else p.estado = 'Disponible';
  if (cantidadReal !== 0) {
    const mov = registrarMovimientoLog(p, cantidadReal > 0 ? 'entrada' : 'salida', Math.abs(cantidadReal), '');
    persistProductoUnico(p).then(r => { if(!r.ok) toast('⚠ No se guardó en la nube: ' + r.error); });
    persistMovimientoUnico(mov).then(r => { if(!r.ok) toast('⚠ No se guardó en la nube: ' + r.error); });
  } else {
    persistProductoUnico(p).then(r => { if(!r.ok) toast('⚠ No se guardó en la nube: ' + r.error); });
  }
  renderAdminInventario();
  // Actualizar catálogo público
  renderProducts('');
  toast(`📦 ${p.nombre}: ${p.stock} unidad${p.stock!==1?'es':''}`)
}

// ===== MOVIMIENTOS DE INVENTARIO (entradas/salidas) =====
function registrarMovimientoLog(p, tipo, cantidad, motivo) {
  const mov = {
    id: Date.now() + Math.floor(Math.random()*1000),
    ts: Date.now(),
    productoId: p.id,
    producto: p.nombre,
    tipo, cantidad, motivo: motivo||'',
    fecha: new Date().toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}),
    stockResultante: p.stock
  };
  DB.movimientos.unshift(mov);
  return mov;
}

function renderMovProductoSelect() {
  const sel = document.getElementById('mov-producto');
  if(!sel) return;
  const actual = sel.value;
  sel.innerHTML = DB.productos.map(p=>`<option value="${p.id}">${escapeHtml(p.nombre)} (stock: ${p.stock})</option>`).join('') || '<option value="">Sin productos</option>';
  if (actual && DB.productos.find(p=>String(p.id)===actual)) sel.value = actual;
}

function registrarMovimiento() {
  const productoId = parseInt(document.getElementById('mov-producto').value);
  const p = DB.productos.find(x=>x.id===productoId);
  if(!p) { toast('⚠ Selecciona un producto'); return; }
  const tipo = document.getElementById('mov-tipo').value;
  const cantidad = parseInt(document.getElementById('mov-cantidad').value);
  if(!cantidad || cantidad <= 0) { toast('⚠ Ingresa una cantidad válida'); return; }
  const motivo = document.getElementById('mov-motivo').value.trim();

  if (tipo === 'salida' && cantidad > p.stock) {
    toast(`⚠ Solo hay ${p.stock} unidad${p.stock!==1?'es':''} en stock`);
    return;
  }
  p.stock = tipo === 'entrada' ? p.stock + cantidad : Math.max(0, p.stock - cantidad);
  if(p.stock === 0) p.estado = 'Agotado';
  else if(p.stock <= 3) p.estado = 'Poco stock';
  else p.estado = 'Disponible';

  const mov = registrarMovimientoLog(p, tipo, cantidad, motivo);
  persistProductoUnico(p).then(r => { if(!r.ok) toast('⚠ No se guardó en la nube: ' + r.error); });
  persistMovimientoUnico(mov).then(r => { if(!r.ok) toast('⚠ No se guardó en la nube: ' + r.error); });

  document.getElementById('mov-cantidad').value = '';
  document.getElementById('mov-motivo').value = '';
  toggleMiniForm('mov-form');
  renderAdminInventario();
  renderAdminMovs();
  renderDashMovs();
  renderProducts('');
  toast(`✓ ${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada: ${p.nombre}`);
}

function eliminarMovimiento(id) {
  const m = DB.movimientos.find(x=>x.id===id);
  if(!m) return;
  mostrarConfirm('🗑','Eliminar movimiento',`Se eliminará definitivamente el registro de "${m.producto}". Esta acción no se puede deshacer.`,'Sí, eliminar', async function(){
    DB.movimientos = DB.movimientos.filter(x=>x.id!==id);
    renderAdminMovs();
    renderDashMovs();
    const r = await eliminarMovimientoFirestore(id);
    if (r.ok) toast('🗑 Movimiento eliminado');
    else toast('⚠ No se guardó en la nube: ' + r.error);
  });
}

function renderAdminMovs() {
  renderMovProductoSelect();
  const el = document.getElementById('admin-movs-table');
  if (!el) return;
  let data = DB.movimientos.filter(m=>{
    const mf = movsFilter==='todos'||m.tipo===movsFilter;
    const ms = !movsSearch||m.producto.toLowerCase().includes(movsSearch.toLowerCase());
    return mf&&ms;
  });
  el.innerHTML = data.length ? data.map(m=>`<tr>
    <td><div class="cell-client"><div class="avatar">${initials(m.producto)}</div>${m.producto}</div></td>
    <td><span class="pill ${m.tipo==='entrada'?'confirmed':'cancelled'}">${m.tipo==='entrada'?'📥 Entrada':'📤 Salida'}</span></td>
    <td style="font-weight:700">${m.cantidad}</td>
    <td style="color:var(--text-muted);font-size:12px">${m.motivo||'—'}</td>
    <td style="color:var(--text-muted);font-size:12px">${m.fecha}</td>
    <td><button class="act-btn" onclick="eliminarMovimiento(${m.id})" title="Eliminar registro">🗑</button></td>
  </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin movimientos registrados</td></tr>';
}

function cambiarEstadoProducto(id, estado) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  p.estado = estado;
  if(estado === 'Agotado') p.stock = 0;
  persist(['productos']);
  renderAdminInventario();
  renderProducts('');
  toast(`Estado actualizado: ${estado}`);
}

let _nombreModalId = null;

function editarNombreProducto(id) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  _nombreModalId = id;
  document.getElementById('nombre-modal-sub').textContent = catLabel(p.cat) + ' · ' + p.precio;
  const input = document.getElementById('nombre-modal-input');
  input.value = p.nombre;
  const overlay = document.getElementById('nombre-modal-overlay');
  overlay.style.display = 'flex';
  setTimeout(()=>{ input.focus(); input.select(); }, 80);
}

function cerrarNombreModal(e) {
  if(e.target === document.getElementById('nombre-modal-overlay')) cerrarNombreModalBtn();
}

function cerrarNombreModalBtn() {
  document.getElementById('nombre-modal-overlay').style.display = 'none';
  _nombreModalId = null;
}

function guardarNombreModal() {
  const p = DB.productos.find(x=>x.id===_nombreModalId);
  if(!p) return;
  const nuevoNombre = document.getElementById('nombre-modal-input').value.trim();
  if(!nuevoNombre) { toast('⚠ Ingresa un nombre válido'); return; }
  p.nombre = nuevoNombre;
  persist(['productos']);
  renderAdminInventario();
  renderProducts('');
  renderLookbook();
  cerrarNombreModalBtn();
  toast('✓ Nombre actualizado');
}

let _precioModalId = null;

function editarProducto(id) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  _precioModalId = id;
  document.getElementById('precio-modal-sub').textContent = p.nombre + ' · ' + catLabel(p.cat);
  const input = document.getElementById('precio-modal-input');
  input.value = p.precio;
  const overlay = document.getElementById('precio-modal-overlay');
  overlay.style.display = 'flex';
  setTimeout(()=>{ input.focus(); input.select(); }, 80);
}

function cerrarPrecioModal(e) {
  if(e.target === document.getElementById('precio-modal-overlay')) cerrarPrecioModalBtn();
}

function cerrarPrecioModalBtn() {
  document.getElementById('precio-modal-overlay').style.display = 'none';
  _precioModalId = null;
}

function guardarPrecioModal() {
  const p = DB.productos.find(x=>x.id===_precioModalId);
  if(!p) return;
  const nuevoPrecio = document.getElementById('precio-modal-input').value.trim();
  if(!nuevoPrecio) { toast('⚠ Ingresa un precio válido'); return; }
  p.precio = nuevoPrecio;
  const num = parseInt(nuevoPrecio.replace(/[^0-9]/g,''));
  if(!isNaN(num)) p.precio_num = num;
  persist(['productos']);
  renderAdminInventario();
  renderProducts('');
  cerrarPrecioModalBtn();
  toast('✓ Precio actualizado');
}

let _categoriaModalId = null;

function editarCategoriaProducto(id) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  _categoriaModalId = id;
  document.getElementById('categoria-modal-sub').textContent = p.nombre + ' · ' + p.precio;
  const cats = [...new Set(DB.productos.map(x=>x.cat).filter(Boolean))].sort((a,b)=>catLabel(a).localeCompare(catLabel(b)));
  const select = document.getElementById('categoria-modal-select');
  select.innerHTML = cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(catLabel(c))}</option>`).join('') + '<option value="__nueva__">+ Nueva categoría...</option>';
  select.value = cats.includes(p.cat) ? p.cat : (cats[0] || '');
  const nuevaInput = document.getElementById('categoria-modal-nueva');
  nuevaInput.style.display = 'none';
  nuevaInput.value = '';
  const overlay = document.getElementById('categoria-modal-overlay');
  overlay.style.display = 'flex';
}

function toggleCategoriaModalNueva(value) {
  const nuevaInput = document.getElementById('categoria-modal-nueva');
  nuevaInput.style.display = value === '__nueva__' ? 'block' : 'none';
  if (value === '__nueva__') setTimeout(()=>nuevaInput.focus(), 80);
}

function cerrarCategoriaModal(e) {
  if(e.target === document.getElementById('categoria-modal-overlay')) cerrarCategoriaModalBtn();
}

function cerrarCategoriaModalBtn() {
  document.getElementById('categoria-modal-overlay').style.display = 'none';
  _categoriaModalId = null;
}

function guardarCategoriaModal() {
  const p = DB.productos.find(x=>x.id===_categoriaModalId);
  if(!p) return;
  const select = document.getElementById('categoria-modal-select');
  let nuevaCat;
  if (select.value === '__nueva__') {
    nuevaCat = document.getElementById('categoria-modal-nueva').value.trim();
    if(!nuevaCat) { toast('⚠ Escribe el nombre de la categoría'); return; }
    const existente = [...new Set(DB.productos.map(x=>x.cat))].find(c=>c && c.trim().toLowerCase()===nuevaCat.toLowerCase());
    nuevaCat = existente || nuevaCat;
  } else {
    nuevaCat = select.value;
  }
  p.cat = nuevaCat;
  persist(['productos']);
  renderAdminInventario();
  renderProducts('');
  if (typeof refreshCatOptions === 'function') refreshCatOptions();
  cerrarCategoriaModalBtn();
  toast('✓ Categoría actualizada');
}

let _descripcionModalId = null;

function editarDescripcionProducto(id) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  _descripcionModalId = id;
  document.getElementById('descripcion-modal-sub').textContent = p.nombre + ' · ' + catLabel(p.cat);
  const input = document.getElementById('descripcion-modal-input');
  input.value = p.desc || '';
  const overlay = document.getElementById('descripcion-modal-overlay');
  overlay.style.display = 'flex';
  setTimeout(()=>{ input.focus(); input.select(); }, 80);
}

function cerrarDescripcionModal(e) {
  if(e.target === document.getElementById('descripcion-modal-overlay')) cerrarDescripcionModalBtn();
}

function cerrarDescripcionModalBtn() {
  document.getElementById('descripcion-modal-overlay').style.display = 'none';
  _descripcionModalId = null;
}

function guardarDescripcionModal() {
  const p = DB.productos.find(x=>x.id===_descripcionModalId);
  if(!p) return;
  p.desc = document.getElementById('descripcion-modal-input').value.trim();
  persist(['productos']);
  renderAdminInventario();
  renderProducts('');
  cerrarDescripcionModalBtn();
  toast('✓ Descripción actualizada');
}

function eliminarProducto(id) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  mostrarConfirm('🗑','Eliminar producto',`Se eliminará definitivamente "${p.nombre}" del inventario. Esta acción no se puede deshacer.`,'Sí, eliminar',function(){
    DB.productos = DB.productos.filter(x=>x.id!==id);
    persist(['productos']);
    renderAdminInventario();
    renderMovProductoSelect();
    renderProducts('');
    toast('Producto eliminado');
  });
}

async function addProducto() {
  const nombre = document.getElementById('inv-nombre').value.trim();
  const precio = document.getElementById('inv-precio').value.trim();
  if(!nombre || !precio) { toast('⚠ Completa nombre y precio'); return; }
  const stock = parseInt(document.getElementById('inv-stock').value)||0;
  const catSelect = document.getElementById('inv-cat').value;
  let cat;
  if (catSelect === '__nueva__') {
    const nueva = document.getElementById('inv-cat-nueva').value.trim();
    if (!nueva) { toast('⚠ Escribe el nombre de la categoría nueva'); return; }
    // Si ya existe una categoría con el mismo nombre (sin importar mayúsculas/espacios), la reutiliza en vez de crear una duplicada
    const existente = [...new Set(DB.productos.map(p=>p.cat))].find(c => c && c.trim().toLowerCase() === nueva.toLowerCase());
    cat = existente || nueva;
  } else {
    cat = catSelect || 'Otros';
  }
  const desc = document.getElementById('inv-desc').value.trim();
  const badge = (document.getElementById('inv-badge').value||'').trim();
  const precio_num = parseInt(precio.replace(/[^0-9]/g,''))||0;
  const estado = stock===0?'Agotado':stock<=3?'Poco stock':'Disponible';
  const foto = _fotosForm.length ? _fotosForm[0] : '';
  const fotos = [..._fotosForm];
  const nuevo = {id:Date.now()+Math.floor(Math.random()*1000),nombre,cat,precio,precio_num,stock,estado,foto,fotos,emoji:'✨',badge,desc};
  if (_videoForm.video) {
    nuevo.video = _videoForm.video;
    nuevo.videoEsArchivo = _videoForm.videoEsArchivo;
    if (_videoForm.videoStoragePath) nuevo.videoStoragePath = _videoForm.videoStoragePath;
  }
  DB.productos.push(nuevo);
  const guardadoOk = await persist(['productos']);
  document.getElementById('inv-nombre').value='';
  document.getElementById('inv-precio').value='';
  document.getElementById('inv-stock').value='';
  document.getElementById('inv-desc').value='';
  document.getElementById('inv-badge').value='';
  document.getElementById('inv-cat').value='';
  document.getElementById('inv-cat-nueva').value='';
  document.getElementById('inv-cat-nueva').style.display='none';
  renderCatDropdown();
  limpiarFotosForm();
  limpiarVideoForm();
  toggleMiniForm('inv-form');
  renderAdminInventario();
  renderMovProductoSelect();
  renderProducts('');
  renderLookbook();
  if (guardadoOk) toast('✓ Producto guardado en Firestore');
  // Si falló, persist() ya mostró el aviso de error correspondiente.
}

