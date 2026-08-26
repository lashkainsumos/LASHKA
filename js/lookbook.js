// ===== LOOKBOOK =====
const LOOKS_DEFAULT = [
  {
    id: 'volumen-ruso',
    nombre: 'Volumen Ruso',
    temporada: 'Colección',
    tag: 'Volumen',
    desc: 'Todo lo que necesitas para la técnica de volumen ruso: pestañas ultrafinas, adhesivos de alta retención y herramientas de precisión.',
    emoji: '✨🖤',
    bg: 'linear-gradient(135deg,#FDF0F4 0%,#FAF5F0 60%,#F2E8E0 100%)',
    featured: true,
    cats: ['Pestañas','Herramientas'],
    badgeFilter: null
  },
  {
    id: 'basicos',
    nombre: 'Básicos de Aplicación',
    temporada: 'Esenciales',
    tag: 'Esenciales',
    desc: 'Lo indispensable en cada set: primer, micropinceles y sellador para un trabajo limpio y duradero.',
    emoji: '🧴🖌️',
    bg: 'linear-gradient(135deg,#FAF5F0 0%,#F0E6DC 100%)',
    featured: false,
    cats: ['Insumos','Adhesivos'],
    badgeFilter: null
  },
  {
    id: 'nuevos',
    nombre: 'Recién Llegados',
    temporada: 'Novedades',
    tag: 'Nuevo',
    desc: 'Los insumos más recientes en inventario, listos para renovar tu kit de trabajo.',
    emoji: '🆕✨',
    bg: 'linear-gradient(135deg,#2C2C3A 0%,#4A2A3C 100%)',
    textLight: true,
    featured: false,
    cats: ['Pestañas','Adhesivos','Herramientas','Insumos'],
    badgeFilter: 'Nuevo'
  },
  {
    id: 'profesional',
    nombre: 'Línea Profesional',
    temporada: 'Premium',
    tag: 'Premium',
    desc: 'Insumos de mayor precio y calidad premium, pensados para lashistas que buscan resultados de larga duración.',
    emoji: '💎🛠️',
    bg: 'linear-gradient(135deg,#F2E8E0 0%,#C9A96E22 50%,#FAF5F0 100%)',
    featured: true,
    cats: ['Pestañas','Herramientas'],
    badgeFilter: null,
    precioMin: 45000
  }
];

let LOOKS = [...LOOKS_DEFAULT];
let lookFilter = '';

function getLookProductos(look) {
  return DB.productos.filter(p => {
    const catMatch = look.cats.includes(p.cat);
    const badgeMatch = !look.badgeFilter || p.badge === look.badgeFilter;
    const precioMatch = !look.precioMin || p.precio_num >= look.precioMin;
    return catMatch && (look.badgeFilter ? badgeMatch : true) && (look.precioMin ? precioMatch : true);
  });
}

// ===== SLIDESHOW AUTOMÁTICO =====
let _slideshowTimers = {}; // { lookId: intervalId }
let _slideshowIndex = {}; // { lookId: currentIndex }
const SLIDESHOW_INTERVAL = 3000; // ms entre fotos

function iniciarSlideshows() {
  // Parar todos primero
  detenerTodosSlideshows();
  LOOKS.forEach(look => {
    // Solo si tiene 2+ fotos
    if (look.fotos && look.fotos.length >= 2) {
      _slideshowIndex[look.id] = 0;
      _slideshowTimers[look.id] = setInterval(() => {
        avanzarSlide(look.id, look.fotos.length);
      }, SLIDESHOW_INTERVAL);
    }
  });
}

function detenerTodosSlideshows() {
  Object.values(_slideshowTimers).forEach(t => clearInterval(t));
  _slideshowTimers = {};
}

function detenerSlideshow(lookId) {
  if (_slideshowTimers[lookId]) {
    clearInterval(_slideshowTimers[lookId]);
    delete _slideshowTimers[lookId];
  }
}

function reanudarSlideshow(lookId, totalFotos) {
  if (totalFotos < 2) return;
  detenerSlideshow(lookId);
  _slideshowTimers[lookId] = setInterval(() => {
    avanzarSlide(lookId, totalFotos);
  }, SLIDESHOW_INTERVAL);
}

function avanzarSlide(lookId, total) {
  _slideshowIndex[lookId] = (_slideshowIndex[lookId] + 1) % total;
  actualizarSlideCard(lookId);
}

function irASlide(lookId, idx, total) {
  // Llamado al hacer clic en un dot: parar auto, ir al índice
  detenerSlideshow(lookId);
  _slideshowIndex[lookId] = idx;
  actualizarSlideCard(lookId);
  // Reanudar después de 6s de inactividad
  setTimeout(() => reanudarSlideshow(lookId, total), 6000);
}

function actualizarSlideCard(lookId) {
  const idx = _slideshowIndex[lookId] || 0;
  const look = LOOKS.find(l => l.id === lookId);
  if (!look || !look.fotos) return;
  const total = look.fotos.length;

  // Actualizar imagen activa
  const slides = document.querySelectorAll(`.look-slide[data-look="${lookId}"]`);
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === idx);
  });

  // Actualizar dots
  const dots = document.querySelectorAll(`.look-dot[data-look="${lookId}"]`);
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
}

// Genera las pestañas de filtro a partir de los tags realmente usados en las tarjetas
function renderLookbookFilters() {
  const cont = document.getElementById('lookbook-filters');
  if (!cont) return;

  // Tags únicos, en el orden en que aparecen los looks, ignorando vacíos
  const tagsUnicos = [];
  LOOKS.forEach(l => {
    if (l.tag && !tagsUnicos.includes(l.tag)) tagsUnicos.push(l.tag);
  });

  // Si el filtro activo ya no existe (se borró ese tag), volver a "Todos"
  if (lookFilter && !tagsUnicos.includes(lookFilter)) lookFilter = '';

  const botones = [`<button class="filter-btn${lookFilter===''?' active':''}" onclick="filterLookbook('',this)">Todos</button>`]
    .concat(tagsUnicos.map(tag =>
      `<button class="filter-btn${lookFilter===tag?' active':''}" onclick="filterLookbook('${tag.replace(/'/g,"\\'")}',this)">${tag}</button>`
    ));

  cont.innerHTML = botones.join('');
}

// Muestra tarjetas "esqueleto" (placeholders con brillo animado) mientras
// se cargan los looks reales desde Firestore — así el usuario ve que algo
// está cargando, en vez de ver looks de muestra que no son suyos y que
// luego desaparecen de golpe. Mismo patrón que renderProductsSkeleton().
function renderLookbookSkeleton(cantidad) {
  const grid = document.getElementById('lookbook-grid');
  if (!grid) return;
  const msg = document.getElementById('lookbook-loading-msg');
  if (msg) msg.style.display = 'flex';
  const cont = document.getElementById('lookbook-filters');
  if (cont) cont.innerHTML = '';
  grid.innerHTML = Array.from({ length: cantidad || 4 }).map(() => `
    <div class="skeleton-card" style="background:var(--white);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(61,43,38,0.06)">
      <div class="skeleton-shimmer" style="aspect-ratio:4/5;background:var(--cream-mid)"></div>
      <div style="padding:14px 16px">
        <div class="skeleton-shimmer" style="height:10px;width:30%;border-radius:6px;background:var(--cream-mid);margin-bottom:10px"></div>
        <div class="skeleton-shimmer" style="height:14px;width:70%;border-radius:6px;background:var(--cream-mid)"></div>
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

function renderLookbook() {
  const loadingMsg = document.getElementById('lookbook-loading-msg');
  if (loadingMsg) loadingMsg.style.display = 'none';
  renderLookbookFilters();
  const grid = document.getElementById('lookbook-grid');
  const looks = lookFilter ? LOOKS.filter(l => l.tag === lookFilter) : LOOKS;

  if (!looks.length) {
    grid.innerHTML = '<div class="look-empty"><span>🌸</span><p style="font-family:var(--ffd);font-size:18px;color:var(--brown);margin-bottom:.4rem">Sin looks en esta categoría</p></div>';
    return;
  }

  grid.innerHTML = looks.map(look => {
    const prods = getLookProductos(look);
    const count = prods.length;
    const disponibles = prods.filter(p => p.estado !== 'Agotado').length;
    const hasPhoto = look.fotos && look.fotos.length > 0;
    const hasVideo = !!look.video;
    const videoEmbed = hasVideo && !look.videoEsArchivo ? parseVideoEmbedUrl(look.video) : null;

    let imgInner = '';
    if (hasVideo && !videoEmbed) {
      // Archivo propio o link directo .mp4 → se reproduce solo, en loop y sin sonido
      imgInner = `<video class="look-video" src="${look.video}" autoplay muted loop playsinline></video><span class="look-emoji-overlay">${escapeHtml(look.emoji)}</span>`;
    } else if (hasVideo && videoEmbed) {
      // YouTube/Vimeo no se puede autorreproducir en miniatura → mostramos
      // la primera foto (o el fondo) como portada con un botón de play
      const poster = hasPhoto ? `<img src="${look.fotos[0]}" class="look-slide active" alt="${escapeHtml(look.nombre)}">` : '';
      imgInner = `${poster}<div class="look-video-play"><span>▶</span></div><span class="look-emoji-overlay">${escapeHtml(look.emoji)}</span>`;
    } else if (hasPhoto) {
      // Slides con object-fit:cover — proporción fija en CSS, sin barras
      const slidesHtml = look.fotos.map((f, i) =>
        `<img src="${f}" class="look-slide${i===0?' active':''}" data-look="${look.id}" alt="${escapeHtml(look.nombre)}">`
      ).join('');
      // Dots solo si 2+ fotos
      const dotsHtml = look.fotos.length >= 2
        ? `<div class="look-dots" onclick="event.stopPropagation()">
            ${look.fotos.map((_, i) =>
              `<span class="look-dot${i===0?' active':''}" data-look="${look.id}" onclick="irASlide('${look.id}',${i},${look.fotos.length})"></span>`
            ).join('')}
           </div>`
        : '';
      imgInner = `${slidesHtml}<span class="look-emoji-overlay">${escapeHtml(look.emoji)}</span>${dotsHtml}`;
    } else {
      // Sin foto: fondo de color + emoji + miniaturas de productos
      const previewPieces = prods.slice(0,3).map(p => {
        const fotos = p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []);
        return fotos.length
          ? `<div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.85);background:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.2)"><img src="${fotos[0]}" style="width:100%;height:100%;object-fit:cover"></div>`
          : `<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.2)">${escapeHtml(p.emoji)||'👗'}</div>`;
      }).join('');
      imgInner = `<span style="font-size:${look.featured?'72px':'54px'};line-height:1;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.15))">${escapeHtml(look.emoji)}</span>
        ${previewPieces ? `<div style="position:absolute;bottom:56px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center">${previewPieces}</div>` : ''}`;
    }

    const bgStyle = (hasPhoto || hasVideo) ? 'background:#1a1a1a' : `background:${escapeHtml(look.bg)}`;
    return `
    <div class="look-card${look.featured?' featured':''}" onclick="openLookModal('${look.id}')">
      <div class="look-img ${(hasPhoto || hasVideo)?'':'no-photo'}" style="${bgStyle}">
        ${imgInner}
      </div>
      <span class="season-tag">${escapeHtml(look.temporada)}</span>
      <div class="look-overlay">
        <h3>${escapeHtml(look.nombre)}</h3>
        <span>${count > 0 ? `${count} piezas · ${disponibles} disponibles` : 'Colección especial'}</span>
      </div>
    </div>`;
  }).join('');

  // Iniciar slideshows después de renderizar
  setTimeout(iniciarSlideshows, 100);
}

function filterLookbook(tag, el) {
  lookFilter = tag;
  detenerTodosSlideshows();
  renderLookbook(); // ya recalcula y marca el botón activo correcto
}

function openLookModal(lookId) {
  // Pausar slideshow de esta tarjeta mientras el modal está abierto
  detenerSlideshow(lookId);

  const look = LOOKS.find(l => l.id === lookId);
  if (!look) return;
  const prods = getLookProductos(look);
  const disponibles = prods.filter(p => p.estado !== 'Agotado').length;

  // Hero
  const hero = document.getElementById('look-modal-hero');
  const hasPhoto = look.fotos && look.fotos.length > 0;
  const hasVideo = !!look.video;
  if (hasVideo) {
    const embed = !look.videoEsArchivo ? parseVideoEmbedUrl(look.video) : null;
    hero.style.background = '#000';
    hero.style.position = 'relative';
    hero.innerHTML = embed
      ? `<iframe src="${embed}" style="width:100%;height:100%;border:0;display:block" allowfullscreen></iframe>`
      : `<video src="${look.video}" controls playsinline style="width:100%;height:100%;object-fit:cover;display:block;background:#000"></video>`;
  } else if (hasPhoto) {
    hero.style.background = '#111';
    hero.style.position = 'relative';
    if (look.fotos.length === 1) {
      hero.innerHTML = `<img src="${look.fotos[0]}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block"><span style="position:absolute;bottom:10px;right:14px;font-size:28px;opacity:.85">${escapeHtml(look.emoji)}</span>`;
    } else {
      const fotosHtml = look.fotos.slice(0,3).map((f,i) =>
        `<img src="${f}" style="flex:1;min-width:0;height:100%;object-fit:cover">`
      ).join('<div style="width:2px;background:#111;flex-shrink:0"></div>');
      hero.innerHTML = `<div style="display:flex;width:100%;height:100%">${fotosHtml}</div><span style="position:absolute;bottom:10px;right:14px;font-size:28px;opacity:.85">${escapeHtml(look.emoji)}</span>`;
    }
  } else {
    hero.style.background = look.bg;
    hero.innerHTML = `<span style="font-size:72px">${escapeHtml(look.emoji)}</span>`;
  }

  // Header
  document.getElementById('look-modal-header').innerHTML = `
    <div class="season-pill">${escapeHtml(look.temporada)}</div>
    <h2>${escapeHtml(look.nombre)}</h2>
    <p>${escapeHtml(look.desc)}</p>
    <div style="display:flex;gap:.6rem;align-items:center;margin-top:.6rem;font-size:12px;color:var(--text-muted)">
      <span>👗 ${prods.length} piezas en la colección</span>
      <span>·</span>
      <span style="color:var(--green);font-weight:700">✓ ${disponibles} disponibles</span>
    </div>`;

  // Piezas
  const piecesHtml = prods.length ? `
    <div class="look-pieces-label">Piezas de esta colección — toca para ver detalle</div>
    ${prods.map(p => {
      const fotos = p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []);
      const imgHtml = fotos.length
        ? `<img src="${fotos[0]}" style="width:100%;height:100%;object-fit:cover">`
        : `<span style="font-size:24px">${escapeHtml(p.emoji)||'✨'}</span>`;
      const agotado = p.estado === 'Agotado';
      return `
      <div class="look-piece-item" onclick="closeLookModalBtn();openProdModal(${p.id})">
        <div class="look-piece-img">${imgHtml}</div>
        <div class="look-piece-info">
          <h4>${escapeHtml(p.nombre)}</h4>
          <div class="lp-cat">${escapeHtml(catLabel(p.cat))}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span class="look-piece-price">${p.precio}</span>
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${agotado?'var(--red-light)':'var(--green-light)'};color:${agotado?'var(--red)':'var(--green)'}">
            ${agotado ? 'Agotado' : '✓ Disponible'}
          </span>
        </div>
      </div>`;
    }).join('')}
    <div class="look-modal-cta">
      <button class="look-cta-all" onclick="irACatalogoDesdeLook('${prods[0]?.cat||''}')">
        Ver ${prods[0]?.cat||'colección'} completa →
      </button>
    </div>` : `<div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:13px">
      <span style="font-size:36px;display:block;margin-bottom:.6rem">🌸</span>
      <p>Esta colección se está preparando. ¡Vuelve pronto!</p>
    </div>`;

  document.getElementById('look-modal-pieces').innerHTML = piecesHtml;

  document.getElementById('look-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function setBadge(val) {
  const input = document.getElementById('inv-badge');
  if (input) input.value = val;
}

let _badgeModalId = null;
function editarBadge(id) {
  const p = DB.productos.find(x => x.id === id);
  if (!p) return;
  _badgeModalId = id;
  document.getElementById('badge-modal-sub').textContent = p.nombre;
  document.getElementById('badge-modal-input').value = p.badge || '';
  document.getElementById('badge-modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('badge-modal-input').focus(), 100);
}
function cerrarBadgeModal(e) {
  if (e && e.target !== document.getElementById('badge-modal-overlay')) return;
  cerrarBadgeModalBtn();
}
function cerrarBadgeModalBtn() {
  document.getElementById('badge-modal-overlay').style.display = 'none';
  _badgeModalId = null;
}
function guardarBadgeModal() {
  if (_badgeModalId === null) return;
  const p = DB.productos.find(x => x.id === _badgeModalId);
  if (!p) return;
  p.badge = document.getElementById('badge-modal-input').value.trim();
  persist(['productos']);
  renderAdminInventario();
  renderProducts('');
  cerrarBadgeModalBtn();
  toast('✓ Etiqueta actualizada: ' + (p.badge || 'sin etiqueta'));
}
function setBadgeModal(val) {
  document.getElementById('badge-modal-input').value = val;
}




// ===== ADMIN LOOKBOOK EDITOR =====

let _editLookId = null; // null = nuevo, string = id existente

function renderAdminLooks() {
  const list = document.getElementById('admin-look-list');
  if (!list) return;
  if (!LOOKS.length) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)"><span style="font-size:32px">📸</span><p>No hay secciones aún. Crea la primera.</p></div>';
    return;
  }
  list.innerHTML = LOOKS.map((look, idx) => {
    const prods = getLookProductos(look);
    const tieneFoto = look.fotos && look.fotos.length > 0;
    const tieneVideo = !!look.video;
    const miniatura = tieneFoto
      ? `<img src="${look.fotos[0]}" style="width:100%;height:100%;object-fit:cover">`
      : (tieneVideo ? '🎬' : escapeHtml(look.emoji));
    return `
    <div class="a-card lb-admin-card" style="margin-bottom:.7rem;display:flex;align-items:center;gap:1rem;padding:.8rem 1rem">
      <div style="width:56px;height:56px;border-radius:10px;background:${(tieneFoto||tieneVideo)?'#1a1a1a':escapeHtml(look.bg)};display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;border:1px solid var(--cream-mid);overflow:hidden">${miniatura}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--ffd);font-size:15px;color:var(--brown);font-weight:700">${escapeHtml(look.nombre)}${look.featured?' <span style="font-size:11px;background:var(--rose-light);color:var(--rose-deep);padding:2px 8px;border-radius:10px;font-family:var(--ff)">⭐ Destacado</span>':''}${tieneVideo?' <span style="font-size:11px;background:#2C2C3A;color:#fff;padding:2px 8px;border-radius:10px;font-family:var(--ff)">🎬 Video</span>':''}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(look.temporada)} · ${escapeHtml(look.tag)} · ${prods.length} productos</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(look.desc)}</div>
      </div>
      <div style="display:flex;gap:.4rem;flex-shrink:0">
        ${idx > 0 ? `<button class="a-btn" title="Subir" onclick="moverLook(${idx},-1)" style="padding:6px 10px">↑</button>` : ''}
        ${idx < LOOKS.length-1 ? `<button class="a-btn" title="Bajar" onclick="moverLook(${idx},1)" style="padding:6px 10px">↓</button>` : ''}
        <button class="a-btn" onclick="abrirFormLook('${look.id}')" style="padding:6px 12px">✏️ Editar</button>
        <button class="a-btn" onclick="eliminarLook('${look.id}')" style="padding:6px 10px;color:var(--red)" title="Eliminar">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function moverLook(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= LOOKS.length) return;
  const tmp = LOOKS[idx];
  LOOKS[idx] = LOOKS[newIdx];
  LOOKS[newIdx] = tmp;
  LOOKS.forEach((l, i) => l._orden = i);
  renderAdminLooks();
  renderLookbook();
  persistLooks(LOOKS).then(ok => { if (ok) toast('✓ Orden actualizado'); });
}

function eliminarLook(id) {
  mostrarConfirm('🗑', 'Eliminar sección', '¿Eliminar esta sección del Lookbook? No se puede deshacer.', 'Sí, eliminar', async function() {
    const idx = LOOKS.findIndex(l => l.id === id);
    if (idx >= 0) LOOKS.splice(idx, 1);
    renderAdminLooks();
    renderLookbook();
    const ok = await persistLooks(LOOKS);
    if (ok) toast('✓ Sección eliminada');
  });
}

let _lookFotosTemp = []; // Base64 de fotos del look actual en edición

// ===== VIDEO DE LA COLECCIÓN (LOOKBOOK) =====
// Mismo patrón que el video de producto en inventario.js: link externo
// (YouTube/Vimeo/mp4 directo) o archivo subido a Firebase Storage.
let _lookVideoForm = { video: null, videoEsArchivo: false, videoStoragePath: null };
let _lookVideoFormTab = 'link';
let _lookVideoFormUploadPct = null;

function renderVideoFormSectionLook() {
  const body = document.getElementById('lf-video-body');
  if (!body) return;

  if (_lookVideoForm.video) {
    const embed = !_lookVideoForm.videoEsArchivo ? parseVideoEmbedUrl(_lookVideoForm.video) : null;
    body.innerHTML = `
      <div style="border:1px solid var(--cream-mid);border-radius:12px;overflow:hidden;margin-bottom:.6rem">
        ${embed
          ? `<iframe src="${embed}" style="width:100%;height:160px;border:0;display:block" allowfullscreen></iframe>`
          : `<video src="${_lookVideoForm.video}" controls style="width:100%;height:160px;display:block;background:#000;object-fit:contain"></video>`}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:var(--text-muted)">${_lookVideoForm.videoEsArchivo ? '📁 Archivo subido' : '🔗 Link externo'}</span>
        <button type="button" onclick="quitarVideoFormLook()" style="background:none;border:none;color:var(--rose-deep);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--ff)">✕ Quitar video</button>
      </div>`;
    return;
  }

  body.innerHTML = `
    <input id="lf-video-link-input" type="text" placeholder="Ej: https://youtube.com/watch?v=... o https://vimeo.com/..."
      style="width:100%;padding:9px 12px;border:1.5px solid var(--cream-mid);border-radius:8px;font-family:var(--ff);font-size:13px;color:var(--text);background:var(--cream);outline:none;box-sizing:border-box"
      onkeydown="if(event.key==='Enter'){event.preventDefault();guardarVideoLinkFormLook();}">
    <button type="button" onclick="guardarVideoLinkFormLook()" class="a-btn primary" style="margin-top:.5rem;padding:7px 16px;font-size:12px">Guardar link</button>
    <p style="font-size:11px;color:var(--text-muted);margin-top:5px">Pega el link de un video de YouTube o Vimeo (puede ser "no listado" para que no salga en búsquedas)</p>`;
}

function guardarVideoLinkFormLook() {
  const input = document.getElementById('lf-video-link-input');
  if (!input) return;
  const url = input.value.trim();
  if (!url) { toast('⚠ Pega un link de video'); return; }
  try { new URL(url); } catch (e) { toast('⚠ El link no es válido'); return; }
  _lookVideoForm.video = url;
  _lookVideoForm.videoEsArchivo = false;
  _lookVideoForm.videoStoragePath = null;
  renderVideoFormSectionLook();
  toast('✓ Video enlazado');
}

async function subirVideoArchivoFormLook(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  input.value = '';
  if (!file.type.startsWith('video/')) { toast('⚠ Selecciona un archivo de video'); return; }
  if (file.size > 50 * 1024 * 1024) { toast('⚠ El video supera los 50 MB'); return; }
  if (!_storage) { toast('⚠ Sin conexión al almacenamiento — intenta de nuevo en un momento'); return; }

  try {
    const { ref, uploadBytesResumable, getDownloadURL, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    if (_lookVideoForm.video && _lookVideoForm.videoEsArchivo && _lookVideoForm.videoStoragePath) {
      try { await deleteObject(ref(_storage, _lookVideoForm.videoStoragePath)); } catch (e) { /* best-effort */ }
    }
    // Reutiliza la carpeta permitida por storage.rules (productos_video/**)
    const path = `productos_video/lookbook_${_editLookId || ('nuevo_' + Date.now())}/${Date.now()}_${file.name}`;
    const storageRef = ref(_storage, path);
    const task = uploadBytesResumable(storageRef, file);
    _lookVideoFormUploadPct = 0;
    renderVideoFormSectionLook();
    task.on('state_changed', snap => {
      _lookVideoFormUploadPct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      renderVideoFormSectionLook();
    }, err => {
      console.error('Error subiendo video del look:', err.message);
      toast('⚠ No se pudo subir el video: ' + err.message);
      _lookVideoFormUploadPct = null;
      renderVideoFormSectionLook();
    }, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      _lookVideoForm.video = url;
      _lookVideoForm.videoEsArchivo = true;
      _lookVideoForm.videoStoragePath = path;
      _lookVideoFormUploadPct = null;
      renderVideoFormSectionLook();
      toast('✓ Video subido');
    });
  } catch (e) {
    console.error(e);
    toast('⚠ No se pudo subir el video: ' + e.message);
    _lookVideoFormUploadPct = null;
    renderVideoFormSectionLook();
  }
}

function quitarVideoFormLook() {
  if (_lookVideoForm.videoEsArchivo && _lookVideoForm.videoStoragePath && _storage) {
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js').then(({ ref, deleteObject }) => {
      deleteObject(ref(_storage, _lookVideoForm.videoStoragePath)).catch(() => {});
    });
  }
  _lookVideoForm = { video: null, videoEsArchivo: false, videoStoragePath: null };
  renderVideoFormSectionLook();
}

function limpiarVideoFormLook() {
  _lookVideoForm = { video: null, videoEsArchivo: false, videoStoragePath: null };
  _lookVideoFormTab = 'link';
  _lookVideoFormUploadPct = null;
  renderVideoFormSectionLook();
}

function abrirFormLook(id) {
  _editLookId = id;
  _lookFotosTemp = []; // Resetear
  _fotosLookProcesando = false;
  limpiarVideoFormLook();
  const wrap = document.getElementById('admin-look-form-wrap');
  wrap.style.display = 'block';
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderTagSugeridos();

  if (id) {
    const look = LOOKS.find(l => l.id === id);
    if (!look) return;
    document.getElementById('look-form-title').textContent = '✏️ Editar sección: ' + look.nombre;
    document.getElementById('lf-id').value = look.id;
    document.getElementById('lf-nombre').value = look.nombre;
    document.getElementById('lf-temporada').value = look.temporada;
    document.getElementById('lf-tag').value = look.tag;
    document.getElementById('lf-emoji').value = look.emoji;
    document.getElementById('lf-desc').value = look.desc;
    document.getElementById('lf-bg').value = look.bg;
    document.getElementById('lf-featured').checked = !!look.featured;
    document.getElementById('lf-textlight').checked = !!look.textLight;
    document.getElementById('lf-precio').value = look.precioMin || '';
    // Cargar fotos existentes
    _lookFotosTemp = look.fotos ? [...look.fotos] : [];
    // Cargar video existente
    if (look.video) {
      _lookVideoForm = { video: look.video, videoEsArchivo: !!look.videoEsArchivo, videoStoragePath: look.videoStoragePath || null };
    }
    renderVideoFormSectionLook();
    renderFotosPreviewAdmin();
    actualizarPreviewLook();
  } else {
    document.getElementById('look-form-title').textContent = '✨ Nueva sección de Lookbook';
    document.getElementById('lf-id').value = '';
    document.getElementById('lf-nombre').value = '';
    document.getElementById('lf-temporada').value = '';
    document.getElementById('lf-tag').value = '';
    document.getElementById('lf-emoji').value = '✨';
    document.getElementById('lf-desc').value = '';
    document.getElementById('lf-bg').value = 'linear-gradient(135deg,#FDF0F4 0%,#FAF5F0 60%,#F2E8E0 100%)';
    document.getElementById('lf-featured').checked = false;
    document.getElementById('lf-textlight').checked = false;
    document.getElementById('lf-precio').value = '';
    renderFotosPreviewAdmin();
    actualizarPreviewLook();
  }

  ['lf-nombre','lf-emoji','lf-bg'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.oninput = actualizarPreviewLook;
  });
}

function renderFotosPreviewAdmin() {
  const cont = document.getElementById('lf-fotos-preview');
  if (!cont) return;
  if (!_lookFotosTemp.length) {
    cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Sin fotos — las tarjetas mostrarán el fondo de color/gradiente</span>';
    return;
  }
  cont.innerHTML = _lookFotosTemp.map((src, i) => `
    <div style="position:relative;display:inline-block;margin-right:6px;margin-bottom:6px">
      <img src="${src}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:2px solid var(--rose);display:block">
      <button onclick="quitarFotoLook(${i})" title="Quitar" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--rose-deep);color:#fff;border:none;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
    </div>`).join('');
  actualizarPreviewLook();
}

function quitarFotoLook(idx) {
  _lookFotosTemp.splice(idx, 1);
  renderFotosPreviewAdmin();
  actualizarPreviewLook();
}

function triggerFotoLookInput() {
  document.getElementById('lf-foto-input').click();
}

let _fotosLookProcesando = false; // true mientras se leen fotos, evita guardar a medias

function onFotoLookChange(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const maxFotos = 3;
  const disponibles = maxFotos - _lookFotosTemp.length;
  if (disponibles <= 0) { toast('⚠️ Máximo 3 fotos por sección'); input.value=''; return; }
  const toRead = files.slice(0, disponibles);
  let leidos = 0;
  _fotosLookProcesando = true;
  toast('⏳ Procesando foto(s)...');
  toRead.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      _lookFotosTemp.push(e.target.result);
      leidos++;
      if (leidos === toRead.length) {
        _fotosLookProcesando = false;
        renderFotosPreviewAdmin();
        actualizarPreviewLook();
      }
    };
    reader.onerror = () => {
      leidos++;
      toast('⚠️ No se pudo leer una de las fotos');
      if (leidos === toRead.length) {
        _fotosLookProcesando = false;
        renderFotosPreviewAdmin();
        actualizarPreviewLook();
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

// Sugerencias de tags ya usados, para que el admin pueda reutilizarlos o escribir uno nuevo
function renderTagSugeridos() {
  const list = document.getElementById('lf-tag-sugeridos');
  if (!list) return;
  const tagsUnicos = [];
  LOOKS.forEach(l => { if (l.tag && !tagsUnicos.includes(l.tag)) tagsUnicos.push(l.tag); });
  list.innerHTML = tagsUnicos.map(t => `<option value="${escapeHtml(t)}"></option>`).join('');
}

function cerrarFormLook() {
  document.getElementById('admin-look-form-wrap').style.display = 'none';
  _editLookId = null;
}

function setLookBg(val) {
  document.getElementById('lf-bg').value = val;
  actualizarPreviewLook();
}

function actualizarPreviewLook() {
  const bg = document.getElementById('lf-bg').value || '#FAF5F0';
  const emoji = document.getElementById('lf-emoji').value || '✨';
  const nombre = document.getElementById('lf-nombre').value || 'Vista previa';
  const card = document.getElementById('lf-preview-card');
  const bgPrev = document.getElementById('lf-bg-preview');
  const eEl = document.getElementById('lf-preview-emoji');
  const nEl = document.getElementById('lf-preview-name');

  if (bgPrev) bgPrev.style.background = _lookFotosTemp.length ? `url(${_lookFotosTemp[0]}) center/cover` : bg;

  if (card) {
    if (_lookFotosTemp.length > 0) {
      // Mostrar foto real en preview
      if (_lookFotosTemp.length === 1) {
        card.style.background = 'none';
        card.innerHTML = `
          <img src="${_lookFotosTemp[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;display:block;position:absolute;inset:0">
          <span style="position:absolute;bottom:6px;right:8px;font-size:18px;opacity:.9">${escapeHtml(emoji)}</span>
          <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.6));border-radius:14px;display:flex;align-items:flex-end;padding:.4rem .5rem">
            <span style="color:#fff;font-family:var(--ffd);font-size:12px;font-weight:700">${escapeHtml(nombre)}</span>
          </div>`;
      } else {
        const splits = _lookFotosTemp.slice(0,3).map(f =>
          `<img src="${f}" style="flex:1;min-width:0;height:100%;object-fit:cover">`
        ).join('<div style="width:2px;background:#fff"></div>');
        card.style.background = 'none';
        card.innerHTML = `
          <div style="display:flex;width:100%;height:100%;position:absolute;inset:0;border-radius:14px;overflow:hidden">${splits}</div>
          <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.6));border-radius:14px;display:flex;align-items:flex-end;padding:.4rem .5rem">
            <span style="color:#fff;font-family:var(--ffd);font-size:12px;font-weight:700">${escapeHtml(nombre)}</span>
          </div>`;
      }
    } else {
      card.style.background = bg;
      card.innerHTML = `
        <span id="lf-preview-emoji">${escapeHtml(emoji)}</span>
        <div id="lf-preview-overlay" style="position:absolute;inset:0;background:linear-gradient(transparent,rgba(61,43,38,0.7));display:flex;align-items:flex-end;padding:.5rem">
          <span id="lf-preview-name" style="color:#fff;font-family:var(--ffd);font-size:13px;font-weight:700">${escapeHtml(nombre)}</span>
        </div>`;
    }
  }
}

function guardarLook() {
  if (_fotosLookProcesando) { toast('⏳ Espera a que termine de procesar la foto antes de guardar'); return; }
  const nombre = document.getElementById('lf-nombre').value.trim();
  const temporada = document.getElementById('lf-temporada').value.trim();
  const tag = document.getElementById('lf-tag').value.trim();
  const emoji = document.getElementById('lf-emoji').value.trim() || '✨';
  const desc = document.getElementById('lf-desc').value.trim();
  const bg = document.getElementById('lf-bg').value.trim() || 'linear-gradient(135deg,#FDF0F4,#F2E8E0)';
  const featured = document.getElementById('lf-featured').checked;
  const textLight = document.getElementById('lf-textlight').checked;
  const precioMin = parseInt(document.getElementById('lf-precio').value) || null;
  // Recoger fotos subidas (guardadas en _lookFotasTemp)
  const fotos = (_lookFotosTemp && _lookFotosTemp.length > 0) ? [..._lookFotosTemp] : (_editLookId ? (LOOKS.find(l=>l.id===_editLookId)||{}).fotos||[] : []);
  // Recoger video (guardado en _lookVideoForm)
  const video = _lookVideoForm.video || null;
  const videoEsArchivo = _lookVideoForm.videoEsArchivo;
  const videoStoragePath = _lookVideoForm.videoStoragePath;

  if (!nombre) { toast('⚠️ Escribe un nombre para la sección'); return; }

  if (_editLookId) {
    const look = LOOKS.find(l => l.id === _editLookId);
    if (look) {
      Object.assign(look, { nombre, temporada, tag, emoji, desc, bg, featured, textLight, precioMin, fotos, video, videoEsArchivo, videoStoragePath });
    }
  } else {
    const newId = 'look_' + Date.now();
    // Por defecto la sección nueva incluye todas las categorías de
    // productos que existan hoy en el inventario (antes quedaba fija en
    // categorías de otro negocio — "Libros","Bandeja","Otros" — que nunca
    // coincidían con nada y la sección se veía siempre vacía).
    const catsExistentes = [...new Set(DB.productos.map(p => p.cat).filter(Boolean))];
    LOOKS.push({
      id: newId,
      nombre, temporada, tag, emoji, desc, bg,
      featured, textLight,
      cats: catsExistentes,
      badgeFilter: null,
      precioMin,
      fotos,
      video, videoEsArchivo, videoStoragePath
    });
  }
  const esNueva = !_editLookId;

  _lookFotosTemp = [];
  _lookVideoForm = { video: null, videoEsArchivo: false, videoStoragePath: null };
  // Guardar orden
  LOOKS.forEach((l, i) => l._orden = i);
  cerrarFormLook();
  renderAdminLooks();
  renderLookbook();
  persistLooks(LOOKS).then(ok => {
    if (ok) toast(esNueva ? '✓ Nueva sección creada: ' + nombre : '✓ Sección actualizada: ' + nombre);
  });
}

// Extender renderAdminAll para incluir lookbook
const _origRenderAdminAll = window.renderAdminAll;
// Se llama desde contacto.js → renderAdminAll; le enganchamos lookbook al switchAdmin de lookbook
const _origSwitchAdmin = window.switchAdmin;

// ===== CERRAR MODAL LOOKBOOK =====
function closeLookModalBtn() {
  document.getElementById('look-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function closeLookModal(e) {
  if (e.target === document.getElementById('look-modal-overlay')) {
    closeLookModalBtn();
  }
}
function irACatalogoDesdeLook(cat) {
  closeLookModalBtn();
  const navCatalog = document.querySelectorAll('.nav-links a')[1];
  showView('catalog', navCatalog);
  setTimeout(() => {
    if (cat) {
      const btn = [...document.querySelectorAll('.filter-btn')].find(b => b.textContent.trim() === cat);
      if (btn) filterProducts(cat, btn);
    }
  }, 300);
}
