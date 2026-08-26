// ===== PRODUCTS =====

// Mapa de intervalos de autoplay por tarjeta: productId -> intervalId
const _cardAutoplay = {};

function _stopCardAutoplay(pid) {
  if (_cardAutoplay[pid]) {
    clearInterval(_cardAutoplay[pid]);
    delete _cardAutoplay[pid];
  }
}

function _startCardAutoplay(pid, total) {
  if (total <= 1) return;
  _stopCardAutoplay(pid);
  _cardAutoplay[pid] = setInterval(() => {
    _cardSlideNext(pid, total);
  }, 2200);
}

function _cardSlideNext(pid, total) {
  const track = document.getElementById(`card-track-${pid}`);
  if (!track) { _stopCardAutoplay(pid); return; }
  let cur = parseInt(track.dataset.idx || '0');
  cur = (cur + 1) % total;
  track.dataset.idx = cur;
  track.style.transform = `translateX(-${cur * 100}%)`;
  // actualizar dots
  const dots = document.querySelectorAll(`#card-dots-${pid} .card-dot`);
  dots.forEach((d, i) => d.classList.toggle('active', i === cur));
}

function _cardSlideTo(pid, idx, total) {
  const track = document.getElementById(`card-track-${pid}`);
  if (!track) return;
  track.dataset.idx = idx;
  track.style.transform = `translateX(-${idx * 100}%)`;
  const dots = document.querySelectorAll(`#card-dots-${pid} .card-dot`);
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
}

function _cardSlideDir(event, pid, dir, total) {
  event.stopPropagation();
  _stopCardAutoplay(pid);
  const track = document.getElementById(`card-track-${pid}`);
  if (!track) return;
  let cur = parseInt(track.dataset.idx || '0');
  cur = (cur + dir + total) % total;
  _cardSlideTo(pid, cur, total);
}

// Reconstruye los botones de filtro del catálogo y el selector de
// categorías del admin a partir de las categorías realmente usadas en
// DB.productos (así el admin siempre elige una existente en vez de
// escribir texto libre que crea duplicados por errores de tipeo).
function refreshCatOptions(activeCat) {
  const cats = [...new Set(DB.productos.map(p => p.cat).filter(Boolean))].sort((a,b)=>catLabel(a).localeCompare(catLabel(b)));

  const filtersBox = document.getElementById('catalog-filters');
  if (filtersBox) {
    filtersBox.innerHTML = '<button class="filter-btn' + (!activeCat?' active':'') + '" onclick="filterProducts(\'\',this)">Todos</button>' +
      cats.map(c => `<button class="filter-btn${c===activeCat?' active':''}" onclick="filterProducts('${escapeAttrJs(c)}',this)">${escapeHtml(catLabel(c))}</button>`).join('');
  }

  const select = document.getElementById('inv-cat');
  if (select) {
    const prevValue = select.value;
    select.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(catLabel(c))}</option>`).join('') +
      '<option value="__nueva__">+ Nueva categoría...</option>';
    if (cats.includes(prevValue)) select.value = prevValue;
    select.dataset.prevValue = select.value;
  }
  renderCatDropdown();
}

// ===== MENÚ PERSONALIZADO DE CATEGORÍA =====
// Reemplaza el <select> nativo (que Android/iOS dibujan con sus
// propios colores, sin poder personalizarse) por un menú desplegable
// propio con el estilo de la marca. El <select> original sigue
// existiendo, oculto, como fuente de verdad del valor seleccionado
// para no tener que tocar el resto del código (addProducto, etc.).
function renderCatDropdown() {
  const select = document.getElementById('inv-cat');
  const panel = document.getElementById('inv-cat-panel');
  const label = document.getElementById('inv-cat-trigger-label');
  if (!select || !panel) return;
  const current = select.value;
  panel.innerHTML = [...select.options].map(o => {
    if (o.value === '__nueva__') {
      return `<div class="custom-select-option new-cat" onclick="selectCatOption('__nueva__')">+ Nueva categoría...</div>`;
    }
    const sel = o.value === current;
    return `<div class="custom-select-option${sel ? ' selected' : ''}" onclick="selectCatOption('${escapeAttrJs(o.value)}')">
      <span>${escapeHtml(o.textContent)}</span><span class="cso-dot"></span>
    </div>`;
  }).join('');
  if (label) {
    const activeOpt = [...select.options].find(o => o.value === current);
    label.textContent = activeOpt ? activeOpt.textContent : 'Selecciona una categoría';
  }
}

function toggleCatDropdown(event) {
  if (event) event.stopPropagation();
  const panel = document.getElementById('inv-cat-panel');
  const trigger = document.getElementById('inv-cat-trigger');
  if (!panel) return;
  if (panel.classList.contains('open')) { closeCatDropdown(); return; }
  renderCatDropdown();
  panel.classList.add('open');
  if (trigger) trigger.classList.add('open');
  document.addEventListener('click', _closeCatDropdownOutside);
}

function closeCatDropdown() {
  const panel = document.getElementById('inv-cat-panel');
  const trigger = document.getElementById('inv-cat-trigger');
  if (panel) panel.classList.remove('open');
  if (trigger) trigger.classList.remove('open');
  document.removeEventListener('click', _closeCatDropdownOutside);
}

function _closeCatDropdownOutside(e) {
  const wrap = document.getElementById('inv-cat-custom');
  if (wrap && !wrap.contains(e.target)) closeCatDropdown();
}

function selectCatOption(value) {
  const select = document.getElementById('inv-cat');
  if (!select) return;
  select.value = value;
  closeCatDropdown();
  toggleNuevaCategoria(value);
  renderCatDropdown();
}

// Crea una categoría nueva. Usa un modal propio con el estilo de la
// app en vez del prompt() nativo del navegador (feo y sin estilo) o
// de un input oculto: el input oculto dependía de .focus() para
// abrirse, y en varios navegadores de Android/iOS ese enfoque no
// dispara el teclado de forma confiable tras elegir una opción del
// <select> nativo. El modal se comporta igual en celular y computador.
function toggleNuevaCategoria(value) {
  const select = document.getElementById('inv-cat');
  const input = document.getElementById('inv-cat-nueva');
  if (input) input.style.display = 'none';
  if (value !== '__nueva__') {
    if (select) select.dataset.prevValue = value;
    return;
  }
  abrirCatNuevaModal();
}

function abrirCatNuevaModal() {
  const modalInput = document.getElementById('cat-nueva-modal-input');
  const overlay = document.getElementById('cat-nueva-modal-overlay');
  if (!modalInput || !overlay) return;
  modalInput.value = '';
  overlay.style.display = 'flex';
  setTimeout(() => { modalInput.focus(); }, 80);
}

// Vuelve a la categoría que estaba seleccionada antes de abrir el modal
// (se usa al cancelar o al hacer clic fuera del modal).
function _revertCatSelect() {
  const select = document.getElementById('inv-cat');
  if (!select) return;
  select.value = select.dataset.prevValue && select.dataset.prevValue !== '__nueva__'
    ? select.dataset.prevValue
    : (select.options.length > 1 ? select.options[0].value : '');
  renderCatDropdown();
}

function cerrarCatNuevaModal(e) {
  if (e.target === document.getElementById('cat-nueva-modal-overlay')) cerrarCatNuevaModalBtn();
}

function cerrarCatNuevaModalBtn() {
  const overlay = document.getElementById('cat-nueva-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  _revertCatSelect();
}

function guardarCatNuevaModal() {
  const select = document.getElementById('inv-cat');
  const modalInput = document.getElementById('cat-nueva-modal-input');
  if (!select || !modalInput) return;
  const nueva = modalInput.value.trim();
  if (!nueva) { toast('⚠ Escribe el nombre de la categoría'); modalInput.focus(); return; }
  // Si ya existe una categoría con el mismo nombre (sin importar mayúsculas/espacios), la reutiliza
  const existente = [...select.options].find(o => o.value && o.value !== '__nueva__' && o.value.trim().toLowerCase() === nueva.toLowerCase());
  if (existente) {
    select.value = existente.value;
  } else {
    const opt = document.createElement('option');
    opt.value = nueva;
    opt.textContent = catLabel(nueva);
    select.insertBefore(opt, select.querySelector('option[value="__nueva__"]'));
    select.value = nueva;
  }
  select.dataset.prevValue = select.value;
  const overlay = document.getElementById('cat-nueva-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  renderCatDropdown();
  toast('✓ Categoría lista: ' + catLabel(select.value));
}

// ===== GESTIONAR CATEGORÍAS (eliminar / fusionar) =====
let _catAEliminar = null;

function abrirGestionCategorias() {
  renderListaCategorias();
  document.getElementById('cats-modal-overlay').style.display = 'flex';
}
function cerrarGestionCategoriasBtn() {
  document.getElementById('cats-modal-overlay').style.display = 'none';
}
function cerrarGestionCategorias(e) {
  if (e.target === document.getElementById('cats-modal-overlay')) cerrarGestionCategoriasBtn();
}

function renderListaCategorias() {
  const cont = document.getElementById('cats-modal-lista');
  if (!cont) return;
  const cats = [...new Set(DB.productos.map(p => p.cat).filter(Boolean))].sort((a,b)=>catLabel(a).localeCompare(catLabel(b)));
  if (!cats.length) { cont.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No hay categorías todavía.</p>'; return; }
  cont.innerHTML = cats.map(c => {
    const count = DB.productos.filter(p => p.cat === c).length;
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--cream-mid)">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${escapeHtml(catLabel(c))}</div>
        <div style="font-size:11px;color:var(--text-muted)">${count} producto${count===1?'':'s'}</div>
      </div>
      <button onclick="pedirEliminarCategoria('${escapeAttrJs(c)}')" style="background:var(--red-light);color:var(--red);border:none;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--ff)">Eliminar</button>
    </div>`;
  }).join('');
}

function pedirEliminarCategoria(cat) {
  _catAEliminar = cat;
  const cats = [...new Set(DB.productos.map(p => p.cat).filter(Boolean))].filter(c => c !== cat).sort((a,b)=>catLabel(a).localeCompare(catLabel(b)));
  const count = DB.productos.filter(p => p.cat === cat).length;
  const select = document.getElementById('cats-mover-select');

  if (count > 0) {
    document.getElementById('cats-mover-msg').textContent =
      `"${catLabel(cat)}" tiene ${count} producto${count===1?'':'s'}. Elige a dónde moverlos antes de eliminarla:`;
    select.style.display = 'block';
    select.previousElementSibling.style.display = 'block';
    select.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(catLabel(c))}</option>`).join('') +
      (cats.includes('Otros') ? '' : '<option value="Otros">Otros</option>');
  } else {
    document.getElementById('cats-mover-msg').textContent = `"${catLabel(cat)}" no tiene productos. ¿Eliminarla de la lista?`;
    select.style.display = 'none';
    select.previousElementSibling.style.display = 'none';
  }
  document.getElementById('cats-mover-overlay').style.display = 'flex';
}

function cerrarMoverCategoria() {
  document.getElementById('cats-mover-overlay').style.display = 'none';
  _catAEliminar = null;
}

async function confirmarEliminarCategoria() {
  if (!_catAEliminar) return;
  const destino = document.getElementById('cats-mover-select').value;
  const afectados = DB.productos.filter(p => p.cat === _catAEliminar);
  afectados.forEach(p => { p.cat = destino || 'Otros'; });
  if (afectados.length) await persist(['productos']);
  document.getElementById('cats-mover-overlay').style.display = 'none';
  _catAEliminar = null;
  renderListaCategorias();
  renderProducts('');
  toast(afectados.length ? `✓ Categoría eliminada — ${afectados.length} producto${afectados.length===1?'':'s'} movido${afectados.length===1?'':'s'}` : '✓ Categoría eliminada');
}

// Muestra tarjetas "esqueleto" (placeholders con brillo animado) mientras
// se cargan los productos reales desde Firestore — así el usuario ve que
// algo está cargando, en vez de ver productos de muestra que no son suyos
// y que luego desaparecen de golpe.
function renderProductsSkeleton(cantidad) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  const msg = document.getElementById('products-loading-msg');
  if (msg) msg.style.display = 'flex';
  grid.innerHTML = Array.from({ length: cantidad || 8 }).map(() => `
    <div class="skeleton-card" style="background:var(--white);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(61,43,38,0.06)">
      <div class="skeleton-shimmer" style="aspect-ratio:1/1;background:var(--cream-mid)"></div>
      <div style="padding:14px 16px">
        <div class="skeleton-shimmer" style="height:10px;width:40%;border-radius:6px;background:var(--cream-mid);margin-bottom:10px"></div>
        <div class="skeleton-shimmer" style="height:14px;width:75%;border-radius:6px;background:var(--cream-mid);margin-bottom:10px"></div>
        <div class="skeleton-shimmer" style="height:14px;width:35%;border-radius:6px;background:var(--cream-mid)"></div>
      </div>
    </div>
  `).join('');
  if (!document.getElementById('skeleton-shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'skeleton-shimmer-style';
    style.textContent = `
      .skeleton-shimmer{position:relative;overflow:hidden}
      .skeleton-shimmer::after{content:'';position:absolute;inset:0;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent);
        transform:translateX(-100%);animation:skeleton-sweep 1.3s infinite}
      @keyframes skeleton-sweep{100%{transform:translateX(100%)}}
      .products-loading-spinner{width:14px;height:14px;border-radius:50%;
        border:2px solid var(--cream-mid);border-top-color:var(--brown);
        display:inline-block;animation:products-spin .7s linear infinite}
      @keyframes products-spin{100%{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }
}

function renderProducts(filter) {
  const loadingMsg = document.getElementById('products-loading-msg');
  if (loadingMsg) loadingMsg.style.display = 'none';
  refreshCatOptions(filter);
  const grid = document.getElementById('products-grid');
  const data = filter ? DB.productos.filter(p=>p.cat===filter) : DB.productos;

  // Detener autoplay de tarjetas anteriores
  Object.keys(_cardAutoplay).forEach(pid => _stopCardAutoplay(pid));

  grid.innerHTML = data.map(p => {
    const fotos = p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []);
    const bg = '#FAF5F0';
    const hasVideo = !!p.video;
    const videoEmbed = hasVideo && !p.videoEsArchivo ? parseVideoEmbedUrl(p.video) : null;

    let imgHTML;
    if (hasVideo && !videoEmbed) {
      // Archivo propio o link directo .mp4 → se reproduce solo en la tarjeta, sin necesidad de foto
      imgHTML = `<video class="product-video" src="${p.video}" autoplay muted loop playsinline></video>`;
    } else if (hasVideo && videoEmbed) {
      // YouTube/Vimeo no autorreproduce en miniatura → mostramos foto (si hay) o emoji, con botón de play
      const poster = fotos.length ? `<img src="${fotos[0]}" style="width:calc(100% - 16px);height:calc(100% - 16px);object-fit:contain;display:block;border-radius:12px">` : `<span style="font-size:56px">${escapeHtml(p.emoji)||'👗'}</span>`;
      imgHTML = `${poster}<div class="product-video-play"><span>▶</span></div>`;
    } else if (fotos.length > 1) {
      // Slider con autoplay + flechas manuales al hacer hover
      imgHTML = `
        <div class="card-slider-wrap" id="card-slider-${p.id}">
          <div class="card-slider-track" id="card-track-${p.id}" data-idx="0">
            ${fotos.map(src => `
              <div class="card-slide">
                <img src="${src}" style="width:calc(100% - 16px);height:calc(100% - 16px);object-fit:contain;display:block;border-radius:12px" onerror="this.style.display='none'">
              </div>`).join('')}
          </div>
          <!-- Flechas manuales (visibles solo en hover de la tarjeta) -->
          <button class="card-arrow card-arrow-prev" onclick="_cardSlideDir(event,${p.id},-1,${fotos.length})">‹</button>
          <button class="card-arrow card-arrow-next" onclick="_cardSlideDir(event,${p.id},1,${fotos.length})">›</button>
          <!-- Dots indicadores -->
          <div class="card-dots" id="card-dots-${p.id}">
            ${fotos.map((_,i) => `<span class="card-dot${i===0?' active':''}" onclick="event.stopPropagation();_stopCardAutoplay(${p.id});_cardSlideTo(${p.id},${i},${fotos.length})"></span>`).join('')}
          </div>
        </div>`;
    } else if (fotos.length === 1) {
      imgHTML = `<img src="${fotos[0]}" style="width:calc(100% - 16px);height:calc(100% - 16px);object-fit:contain;display:block;border-radius:12px">`;
    } else {
      imgHTML = `<span style="font-size:56px">${escapeHtml(p.emoji)||'👗'}</span>`;
    }

    return `
    <div class="product-card" id="pcard-${p.id}"
      onmouseenter="_stopCardAutoplay(${p.id})"
      onmouseleave="_startCardAutoplay(${p.id},${fotos.length})"
      onclick="openProdModal(${p.id})">
      <div class="product-img" style="background:${bg};position:relative;overflow:hidden">
        ${imgHTML}
        ${p.badge?`<span class="product-badge">${escapeHtml(p.badge)}</span>`:''}
      </div>
      <div class="product-info">
        <div class="cat">${escapeHtml(catLabel(p.cat))}</div>
        <h4>${escapeHtml(p.nombre)}</h4>
        <div><span class="price">${escapeHtml(p.precio)}</span></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Toca para ver más 👆</div>
      </div>
    </div>`;
  }).join('');

  // Iniciar autoplay para todas las tarjetas con múltiples fotos (si no tienen video propio, que ya se reproduce solo)
  data.forEach(p => {
    const fotos = p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []);
    const tieneVideoPropio = !!p.video && p.videoEsArchivo || (!!p.video && !parseVideoEmbedUrl(p.video));
    if (fotos.length > 1 && !tieneVideoPropio) {
      // Pequeño delay escalonado para que no todas cambien al mismo tiempo
      setTimeout(() => _startCardAutoplay(p.id, fotos.length), (p.id % 5) * 400);
    }
  });
}

