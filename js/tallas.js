// ===== TALLAS FORM =====
// `var` evita error fatal si por accidente este script se incluye dos veces.
var _tallasForm = (typeof _tallasForm !== 'undefined') ? _tallasForm : [];

function toggleTallaForm(t) {
  const idx = _tallasForm.indexOf(t);
  if (idx >= 0) {
    _tallasForm.splice(idx, 1);
  } else {
    _tallasForm.push(t);
  }
  const btn = document.getElementById('tbtn-' + t);
  if (btn) {
    const sel = _tallasForm.includes(t);
    btn.style.background = sel ? 'var(--rose-deep)' : 'var(--white)';
    btn.style.color = sel ? '#fff' : 'var(--text-muted)';
    btn.style.borderColor = sel ? 'var(--rose-deep)' : 'var(--cream-mid)';
  }
  renderTallasFormPreview();
}

function agregarTallaCustomForm() {
  const input = document.getElementById('inv-talla-custom');
  const val = (input.value || '').trim();
  if (!val) return;
  if (_tallasForm.includes(val)) { toast('Esa talla ya está agregada'); return; }
  _tallasForm.push(val);
  input.value = '';
  renderTallasFormPreview();
}

function renderTallasFormPreview() {
  const cont = document.getElementById('inv-tallas-preview');
  if (!cont) return;
  if (!_tallasForm.length) { cont.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Sin tallas seleccionadas — se usarán XS, S, M, L por defecto</span>'; return; }
  cont.innerHTML = _tallasForm.map((t, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;background:var(--rose-deep);color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700">
      ${t}
      <button onclick="_tallasForm.splice(${i},1);renderTallasFormPreview();const b=document.getElementById('tbtn-${t}');if(b){b.style.background='var(--white)';b.style.color='var(--text-muted)';b.style.borderColor='var(--cream-mid)'}" style="background:none;border:none;color:rgba(255,255,255,0.8);cursor:pointer;font-size:13px;line-height:1;padding:0 0 0 2px">✕</button>
    </span>`).join('');
}

function limpiarTallasForm() {
  _tallasForm = [];
  ['XS','S','M','L','XL','XXL','Única'].forEach(t => {
    const btn = document.getElementById('tbtn-' + t);
    if (btn) { btn.style.background='var(--white)'; btn.style.color='var(--text-muted)'; btn.style.borderColor='var(--cream-mid)'; }
  });
  const cont = document.getElementById('inv-tallas-preview');
  if (cont) cont.innerHTML = '';
}

// ===== EDITOR DE TALLAS (productos existentes) =====
let _tallasModalId = null;

function editarTallas(id) {
  const p = DB.productos.find(x => x.id === id);
  if (!p) return;
  _tallasModalId = id;
  document.getElementById('tallas-modal-sub').textContent = p.nombre + ' · ' + catLabel(p.cat);
  renderTallasModal(p.tallas || []);
  document.getElementById('tallas-modal-overlay').style.display = 'flex';
}

function renderTallasModal(tallas) {
  const predefs = ['XS','S','M','L','XL','XXL','Única'];
  document.getElementById('tallas-modal-chips').innerHTML = predefs.map(t => {
    const sel = tallas.includes(t);
    return `<button onclick="toggleTallaModal('${t}')" id="tmchip-${t}" style="padding:8px 18px;border-radius:10px;border:1.5px solid ${sel?'var(--rose-deep)':'var(--cream-mid)'};background:${sel?'var(--rose-deep)':'var(--white)'};color:${sel?'#fff':'var(--text-muted)'};font-size:13px;font-weight:700;cursor:pointer;font-family:var(--ff);transition:all .15s">${t}</button>`;
  }).join('');
  const extras = tallas.filter(t => !predefs.includes(t));
  document.getElementById('tallas-modal-extras').innerHTML = extras.map((t,i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;background:var(--rose-deep);color:#fff;padding:5px 12px;border-radius:8px;font-size:13px;font-weight:700">
      ${t}
      <button onclick="quitarTallaModalExtra('${t}')" style="background:none;border:none;color:rgba(255,255,255,0.8);cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 2px">✕</button>
    </span>`).join('');
}

function toggleTallaModal(t) {
  const p = DB.productos.find(x => x.id === _tallasModalId);
  if (!p) return;
  if (!p.tallas) p.tallas = [];
  const idx = p.tallas.indexOf(t);
  if (idx >= 0) p.tallas.splice(idx, 1); else p.tallas.push(t);
  renderTallasModal(p.tallas);
}

function quitarTallaModalExtra(t) {
  const p = DB.productos.find(x => x.id === _tallasModalId);
  if (!p || !p.tallas) return;
  p.tallas = p.tallas.filter(x => x !== t);
  renderTallasModal(p.tallas);
}

function cerrarTallasModal() {
  document.getElementById('tallas-modal-overlay').style.display = 'none';
  _tallasModalId = null;
}

// Nota: closeLookModal, closeLookModalBtn e irACatalogoDesdeLook viven en
// lookbook.js (versión con setTimeout que espera a que la vista catálogo
// termine de renderizar antes de aplicar el filtro). Antes había una copia
// duplicada aquí sin esa espera, que además sobrescribía silenciosamente
// a la de lookbook.js por cargarse después — se quitó para evitar el bug.


// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  updateCartBadge();
  // No llamar renderProducts('') aquí: en este punto DB.productos todavía
  // tiene el catálogo de muestra (Firebase no ha respondido todavía), así
  // que pintarlo ahora causa el "flash" del catálogo viejo antes de que
  // aparezcan los productos reales. utils.js ya muestra un esqueleto de
  // carga, y auth.js pinta el catálogo real en cuanto Firestore responde.
  renderLookbook();
  document.addEventListener('click', function() { closeDotMenus(); });
});
