// ===== FOTOS MÚLTIPLES EN FORMULARIO NUEVO PRODUCTO =====
let _fotosForm = [];

// ===== COMPRESIÓN DE IMÁGENES (evita límite 1MB de Firestore) =====
function compressImage(dataUrl, maxW=800, maxH=800, quality=0.72) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

const MAX_FOTOS_PRODUCTO = 8; // Firestore limita cada documento a 1MB; con fotos comprimidas, 8 es un margen seguro

function previewFotosForm(input) {
  if(!input.files || !input.files.length) return;
  const files = Array.from(input.files);
  files.forEach(file => {
    if(_fotosForm.length >= MAX_FOTOS_PRODUCTO) { toast(`⚠ Máximo ${MAX_FOTOS_PRODUCTO} fotos por producto`); return; }
    if(file.size > 3 * 1024 * 1024) { toast('⚠ Una imagen supera los 3 MB y fue omitida'); return; }
    const reader = new FileReader();
    reader.onload = async e => {
      if(_fotosForm.length >= MAX_FOTOS_PRODUCTO) { toast(`⚠ Máximo ${MAX_FOTOS_PRODUCTO} fotos por producto`); return; }
      const compressed = await compressImage(e.target.result);
      _fotosForm.push(compressed);
      renderFotosFormThumbs();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderFotosFormThumbs() {
  const cont = document.getElementById('inv-fotos-thumbs');
  if(!cont) return;
  const thumbs = _fotosForm.map((src, i) => `
    <div class="foto-thumb">
      <img src="${src}">
      <button class="foto-thumb-del" onclick="quitarFotoFormIdx(${i})" title="Quitar">✕</button>
    </div>`).join('');
  const addBtn = `<div class="foto-thumb add-thumb" onclick="document.getElementById('inv-foto-input').click()" title="Agregar más fotos">
    <span>📷</span><span style="font-size:9px">Agregar</span>
  </div>`;
  cont.innerHTML = thumbs + addBtn;
}

function quitarFotoFormIdx(i) {
  _fotosForm.splice(i, 1);
  renderFotosFormThumbs();
}

function limpiarFotosForm() {
  _fotosForm = [];
  renderFotosFormThumbs();
}

// ===== VIDEO EN FORMULARIO NUEVO PRODUCTO =====
let _videoForm = { video: null, videoEsArchivo: false, videoStoragePath: null };
let _videoFormTab = 'link';
let _videoFormUploadPct = null;

function renderVideoFormSection() {
  const body = document.getElementById('inv-video-body');
  if (!body) return;

  if (_videoForm.video) {
    const embed = !_videoForm.videoEsArchivo ? parseVideoEmbedUrl(_videoForm.video) : null;
    body.innerHTML = `
      <div style="border:1px solid var(--cream-mid);border-radius:12px;overflow:hidden;margin-bottom:.6rem">
        ${embed
          ? `<iframe src="${embed}" style="width:100%;height:160px;border:0;display:block" allowfullscreen></iframe>`
          : `<video src="${_videoForm.video}" controls style="width:100%;height:160px;display:block;background:#000;object-fit:contain"></video>`}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:var(--text-muted)">${_videoForm.videoEsArchivo ? '📁 Archivo subido' : '🔗 Link externo'}</span>
        <button type="button" onclick="quitarVideoForm()" style="background:none;border:none;color:var(--rose-deep);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--ff)">✕ Quitar video</button>
      </div>`;
    return;
  }

  body.innerHTML = `
    <input id="inv-video-link-input" type="text" placeholder="Ej: https://youtube.com/watch?v=... o https://vimeo.com/..."
      style="width:100%;padding:9px 12px;border:1.5px solid var(--cream-mid);border-radius:8px;font-family:var(--ff);font-size:13px;color:var(--text);background:var(--cream);outline:none;box-sizing:border-box"
      onkeydown="if(event.key==='Enter'){event.preventDefault();guardarVideoLinkForm();}">
    <button type="button" onclick="guardarVideoLinkForm()" class="a-btn primary" style="margin-top:.5rem;padding:7px 16px;font-size:12px">Guardar link</button>
    <p style="font-size:11px;color:var(--text-muted);margin-top:5px">Pega el link de un video de YouTube o Vimeo (puede ser "no listado" para que no salga en búsquedas)</p>`;
}

function guardarVideoLinkForm() {
  const input = document.getElementById('inv-video-link-input');
  if (!input) return;
  const url = input.value.trim();
  if (!url) { toast('⚠ Pega un link de video'); return; }
  try { new URL(url); } catch (e) { toast('⚠ El link no es válido'); return; }
  _videoForm.video = url;
  _videoForm.videoEsArchivo = false;
  _videoForm.videoStoragePath = null;
  renderVideoFormSection();
  toast('✓ Video enlazado');
}

async function subirVideoArchivoForm(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  input.value = '';
  if (!file.type.startsWith('video/')) { toast('⚠ Selecciona un archivo de video'); return; }
  if (file.size > 50 * 1024 * 1024) { toast('⚠ El video supera los 50 MB'); return; }
  if (!_storage) { toast('⚠ Sin conexión al almacenamiento — intenta de nuevo en un momento'); return; }

  try {
    const { ref, uploadBytesResumable, getDownloadURL, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    if (_videoForm.video && _videoForm.videoEsArchivo && _videoForm.videoStoragePath) {
      try { await deleteObject(ref(_storage, _videoForm.videoStoragePath)); } catch (e) { /* best-effort */ }
    }
    const path = `productos_video/_nuevo_${Date.now()}/${file.name}`;
    const storageRef = ref(_storage, path);
    const task = uploadBytesResumable(storageRef, file);
    _videoFormUploadPct = 0;
    renderVideoFormSection();
    task.on('state_changed', snap => {
      _videoFormUploadPct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      renderVideoFormSection();
    }, err => {
      console.error('Error subiendo video:', err.message);
      toast('⚠ No se pudo subir el video: ' + err.message);
      _videoFormUploadPct = null;
      renderVideoFormSection();
    }, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      _videoForm.video = url;
      _videoForm.videoEsArchivo = true;
      _videoForm.videoStoragePath = path;
      _videoFormUploadPct = null;
      renderVideoFormSection();
      toast('✓ Video subido');
    });
  } catch (e) {
    console.error(e);
    toast('⚠ No se pudo subir el video: ' + e.message);
    _videoFormUploadPct = null;
    renderVideoFormSection();
  }
}

function quitarVideoForm() {
  if (_videoForm.videoEsArchivo && _videoForm.videoStoragePath && _storage) {
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js').then(({ ref, deleteObject }) => {
      deleteObject(ref(_storage, _videoForm.videoStoragePath)).catch(() => {});
    });
  }
  _videoForm = { video: null, videoEsArchivo: false, videoStoragePath: null };
  renderVideoFormSection();
}

function limpiarVideoForm() {
  _videoForm = { video: null, videoEsArchivo: false, videoStoragePath: null };
  _videoFormTab = 'link';
  _videoFormUploadPct = null;
  renderVideoFormSection();
}

// ===== EDITOR DE FOTOS MÚLTIPLES (productos existentes) =====
let _fotoEditorId = null;

function abrirEditorFotos(id) {
  const p = DB.productos.find(x=>x.id===id);
  if(!p) return;
  _fotoEditorId = id;
  // Migrar foto única a array si existe
  if(!p.fotos) p.fotos = p.foto ? [p.foto] : [];
  
  // Crear modal dinámico
  let modal = document.getElementById('foto-editor-modal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'foto-editor-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(61,43,38,0.65);z-index:600;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)';
    modal.onclick = e => { if(e.target===modal) cerrarEditorFotos(); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--white);border-radius:18px;width:100%;max-width:520px;padding:1.8rem;box-shadow:0 20px 60px rgba(61,43,38,0.3);max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem">
        <div>
          <h3 style="font-family:var(--ffd);font-size:19px;color:var(--brown)">🖼 Fotos — ${escapeHtml(p.nombre)}</h3>
          <p style="font-size:12px;color:var(--text-muted);margin-top:2px">${escapeHtml(catLabel(p.cat))} · ${escapeHtml(p.precio)}</p>
        </div>
        <button onclick="cerrarEditorFotos()" style="background:var(--cream-mid);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">✕</button>
      </div>

      <!-- Slider preview -->
      <div id="foe-slider-wrap" style="width:100%;height:200px;background:var(--rose-light);border-radius:14px;margin-bottom:1rem;overflow:hidden;position:relative">
        <div id="foe-slider-inner" style="display:flex;height:100%;transition:transform .35s cubic-bezier(.4,0,.2,1)"></div>
        <button class="foto-slider-btn prev" id="foe-prev" onclick="foeSlide(-1)" style="display:none">‹</button>
        <button class="foto-slider-btn next" id="foe-next" onclick="foeSlide(1)" style="display:none">›</button>
        <div class="foto-slider-dots" id="foe-dots"></div>
        <span class="foto-slider-count" id="foe-count" style="display:none"></span>
      </div>

      <!-- Thumbnails -->
      <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:.5rem">Imágenes (arrastra para reordenar)</div>
      <div class="foto-thumbs" id="foe-thumbs"></div>

      <!-- Agregar -->
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--cream-mid)">
        <input type="file" id="foe-file-input" accept="image/*" multiple style="display:none" onchange="foeAgregarFotos(this)">
        <button class="a-btn primary" onclick="document.getElementById('foe-file-input').click()" style="padding:9px 20px;font-size:12px">📷 Agregar fotos</button>
        <p style="font-size:11px;color:var(--text-muted);margin-top:.5rem">JPG, PNG o WebP · máx. 3 MB por imagen</p>
      </div>

      <!-- Video del producto -->
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--cream-mid)">
        <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:.6rem">🎬 Video del producto (opcional)</div>
        <div id="foe-video-body"></div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:1rem">
        <button onclick="cerrarEditorFotos()" class="a-btn primary" style="padding:9px 22px">Listo</button>
      </div>
    </div>`;

  modal.style.display = 'flex';
  _foeSlideIdx = 0;
  _foeVideoTab = p.video ? (p.videoEsArchivo ? 'archivo' : 'link') : 'link';
  renderFoeEditor();
  renderFoeVideoSection();
}

let _foeSlideIdx = 0;
let _foeVideoTab = 'link';
let _foeVideoUploadPct = null;

function renderFoeEditor() {
  const p = DB.productos.find(x=>x.id===_fotoEditorId);
  if(!p) return;
  const fotos = p.fotos || [];

  // Slider
  const inner = document.getElementById('foe-slider-inner');
  const prev = document.getElementById('foe-prev');
  const next = document.getElementById('foe-next');
  const count = document.getElementById('foe-count');
  const dots = document.getElementById('foe-dots');

  if(!fotos.length) {
    inner.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;color:var(--text-muted);flex-direction:column;gap:.4rem"><span>📷</span><span style="font-size:13px">Sin fotos</span></div>';
    if(prev) prev.style.display='none';
    if(next) next.style.display='none';
    if(count) count.style.display='none';
    if(dots) dots.innerHTML='';
  } else {
    _foeSlideIdx = Math.max(0, Math.min(_foeSlideIdx, fotos.length-1));
    inner.innerHTML = fotos.map(src=>`<div style="flex:0 0 100%;width:100%;height:100%;background:#f8f4f1;display:flex;align-items:center;justify-content:center"><img src="${src}" style="width:100%;height:100%;object-fit:contain"></div>`).join('');
    inner.style.transform = `translateX(-${_foeSlideIdx*100}%)`;
    if(prev) prev.style.display = fotos.length>1?'flex':'none';
    if(next) next.style.display = fotos.length>1?'flex':'none';
    if(count) { count.textContent = `${_foeSlideIdx+1}/${fotos.length}`; count.style.display = fotos.length>1?'block':'none'; }
    if(dots) dots.innerHTML = fotos.length>1 ? fotos.map((_,i)=>`<button class="foto-slider-dot ${i===_foeSlideIdx?'active':''}" onclick="foeSlideTo(${i})"></button>`).join('') : '';
  }

  // Thumbnails
  const thumbsCont = document.getElementById('foe-thumbs');
  if(thumbsCont) {
    thumbsCont.innerHTML = fotos.map((src,i)=>`
      <div class="foto-thumb" style="${i===_foeSlideIdx?'border-color:var(--rose-deep)':''}" onclick="foeSlideTo(${i})">
        <img src="${src}">
        <button class="foto-thumb-del" onclick="event.stopPropagation();foeEliminarFoto(${i})" title="Quitar foto">✕</button>
      </div>`).join('');
  }
}

function foeSlide(dir) {
  const p = DB.productos.find(x=>x.id===_fotoEditorId);
  if(!p || !p.fotos || !p.fotos.length) return;
  _foeSlideIdx = (_foeSlideIdx + dir + p.fotos.length) % p.fotos.length;
  const inner = document.getElementById('foe-slider-inner');
  if(inner) inner.style.transform = `translateX(-${_foeSlideIdx*100}%)`;
  renderFoeEditor();
}

function foeSlideTo(i) {
  _foeSlideIdx = i;
  const inner = document.getElementById('foe-slider-inner');
  if(inner) inner.style.transform = `translateX(-${i*100}%)`;
  renderFoeEditor();
}

function foeAgregarFotos(input) {
  const p = DB.productos.find(x=>x.id===_fotoEditorId);
  if(!p) return;
  if(!p.fotos) p.fotos = [];
  if(p.fotos.length >= MAX_FOTOS_PRODUCTO) { toast(`⚠ Este producto ya tiene el máximo de ${MAX_FOTOS_PRODUCTO} fotos`); input.value = ''; return; }
  const files = Array.from(input.files);
  let cargadas = 0;
  files.forEach(file => {
    if(p.fotos.length + cargadas >= MAX_FOTOS_PRODUCTO) { toast(`⚠ Máximo ${MAX_FOTOS_PRODUCTO} fotos por producto`); return; }
    if(file.size > 3*1024*1024) { toast('⚠ Una imagen supera 3 MB y fue omitida'); return; }
    const reader = new FileReader();
    reader.onload = async e => {
      if(p.fotos.length >= MAX_FOTOS_PRODUCTO) { toast(`⚠ Máximo ${MAX_FOTOS_PRODUCTO} fotos por producto`); return; }
      const compressed = await compressImage(e.target.result);
      p.fotos.push(compressed);
      p.foto = p.fotos[0]; // compatibilidad
      cargadas++;
      const total = files.filter(f=>f.size<=3*1024*1024).length || files.length;
      if(cargadas >= total) {
        persist(['productos']); renderAdminInventario(); renderProducts('');
        _foeSlideIdx = p.fotos.length - 1;
        renderFoeEditor();
        toast(`✓ ${cargadas > 1 ? cargadas + ' fotos agregadas' : 'Foto agregada'}`);
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function foeEliminarFoto(idx) {
  const p = DB.productos.find(x=>x.id===_fotoEditorId);
  if(!p || !p.fotos) return;
  p.fotos.splice(idx, 1);
  p.foto = p.fotos[0] || '';
  _foeSlideIdx = Math.max(0, _foeSlideIdx - (idx <= _foeSlideIdx ? 1 : 0));
  persist(['productos']); renderAdminInventario(); renderProducts('');
  renderFoeEditor();
  toast('Foto eliminada');
}

// ===== VIDEO DEL PRODUCTO (link externo o archivo subido a Firebase Storage) =====

function parseVideoEmbedUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith('/embed/')) return url;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch (e) { /* URL inválida */ }
  return null;
}

function renderFoeVideoSection() {
  const p = DB.productos.find(x => x.id === _fotoEditorId);
  const body = document.getElementById('foe-video-body');
  if (!p || !body) return;

  if (p.video) {
    const embed = !p.videoEsArchivo ? parseVideoEmbedUrl(p.video) : null;
    body.innerHTML = `
      <div style="border:1px solid var(--cream-mid);border-radius:12px;overflow:hidden;margin-bottom:.7rem">
        ${embed
          ? `<iframe src="${embed}" style="width:100%;height:180px;border:0;display:block" allowfullscreen></iframe>`
          : `<video src="${p.video}" controls style="width:100%;height:180px;display:block;background:#000;object-fit:contain"></video>`}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:var(--text-muted)">${p.videoEsArchivo ? '📁 Archivo subido' : '🔗 Link externo'}</span>
        <button onclick="foeQuitarVideo()" style="background:none;border:none;color:var(--rose-deep);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--ff)">✕ Quitar video</button>
      </div>`;
    return;
  }

  body.innerHTML = `
    <input id="foe-video-link-input" type="text" placeholder="Ej: https://youtube.com/watch?v=... o https://vimeo.com/..."
      style="width:100%;padding:11px 13px;border:1.5px solid var(--cream-mid);border-radius:10px;font-family:var(--ff);font-size:13px;color:var(--text);background:var(--cream);outline:none;box-sizing:border-box"
      onkeydown="if(event.key==='Enter')foeGuardarVideoLink()">
    <button onclick="foeGuardarVideoLink()" class="a-btn primary" style="margin-top:.6rem;padding:8px 18px;font-size:12px">Guardar link</button>
    <p style="font-size:11px;color:var(--text-muted);margin-top:.5rem">Pega el link de un video de YouTube o Vimeo (puede ser "no listado" para que no salga en búsquedas)</p>`;
}

function foeGuardarVideoLink() {
  const p = DB.productos.find(x => x.id === _fotoEditorId);
  const input = document.getElementById('foe-video-link-input');
  if (!p || !input) return;
  const url = input.value.trim();
  if (!url) { toast('⚠ Pega un link de video'); return; }
  try { new URL(url); } catch (e) { toast('⚠ El link no es válido'); return; }
  p.video = url;
  p.videoEsArchivo = false;
  delete p.videoStoragePath;
  persist(['productos']);
  renderFoeVideoSection();
  toast('✓ Video enlazado');
}

async function foeSubirVideoArchivo(input) {
  const p = DB.productos.find(x => x.id === _fotoEditorId);
  if (!p || !input.files || !input.files[0]) return;
  const file = input.files[0];
  input.value = '';
  if (!file.type.startsWith('video/')) { toast('⚠ Selecciona un archivo de video'); return; }
  if (file.size > 50 * 1024 * 1024) { toast('⚠ El video supera los 50 MB'); return; }
  if (!_storage) { toast('⚠ Sin conexión al almacenamiento — intenta de nuevo en un momento'); return; }

  try {
    const { ref, uploadBytesResumable, getDownloadURL, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    if (p.video && p.videoEsArchivo && p.videoStoragePath) {
      try { await deleteObject(ref(_storage, p.videoStoragePath)); } catch (e) { /* ya no existe o falló, seguimos igual */ }
    }
    const path = `productos_video/${p.id}/${Date.now()}_${file.name}`;
    const storageRef = ref(_storage, path);
    const task = uploadBytesResumable(storageRef, file);
    _foeVideoUploadPct = 0;
    renderFoeVideoSection();
    task.on('state_changed', snap => {
      _foeVideoUploadPct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      renderFoeVideoSection();
    }, err => {
      console.error('Error subiendo video:', err.message);
      toast('⚠ No se pudo subir el video: ' + err.message);
      _foeVideoUploadPct = null;
      renderFoeVideoSection();
    }, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      p.video = url;
      p.videoEsArchivo = true;
      p.videoStoragePath = path;
      _foeVideoUploadPct = null;
      persist(['productos']);
      renderFoeVideoSection();
      toast('✓ Video subido');
    });
  } catch (e) {
    console.error(e);
    toast('⚠ No se pudo subir el video: ' + e.message);
    _foeVideoUploadPct = null;
    renderFoeVideoSection();
  }
}

function foeQuitarVideo() {
  const p = DB.productos.find(x => x.id === _fotoEditorId);
  if (!p) return;
  mostrarConfirm('🗑', 'Quitar video', `Se quitará el video de "${p.nombre}".`, 'Sí, quitar', async function () {
    if (p.videoEsArchivo && p.videoStoragePath && _storage) {
      try {
        const { ref, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
        await deleteObject(ref(_storage, p.videoStoragePath));
      } catch (e) { /* best-effort */ }
    }
    delete p.video;
    delete p.videoEsArchivo;
    delete p.videoStoragePath;
    persist(['productos']);
    renderFoeVideoSection();
    toast('Video eliminado');
  });
}

function cerrarEditorFotos() {
  const modal = document.getElementById('foto-editor-modal');
  if(modal) modal.style.display = 'none';
  _fotoEditorId = null;
}

function searchClientes(v){ clientesSearch=v; renderAdminClientes(); }

function filterMovs(f, el) {
  movsFilter=f;
  el.closest('.filter-bar').querySelectorAll('.f-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  renderAdminMovs();
}
function searchMovs(v){ movsSearch=v; renderAdminMovs(); }


