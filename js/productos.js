// ===== MODAL PRODUCTO =====
let _modalProdId = null;
let _pmSlideIdx = 0;

function pmSlide(dir, total) {
  _pmSlideIdx = (_pmSlideIdx + dir + total) % total;
  pmApplySlide(total);
}
function pmSlideTo(i, total) {
  _pmSlideIdx = i;
  pmApplySlide(total);
}
function pmApplySlide(total) {
  const track = document.getElementById('pm-slider-track');
  if(track) track.style.transform = `translateX(-${_pmSlideIdx*100}%)`;
  const count = document.getElementById('pm-slider-count');
  if(count) count.textContent = `${_pmSlideIdx+1}/${total}`;
  document.querySelectorAll('#pm-slider-dots .foto-slider-dot').forEach((d,i)=>d.classList.toggle('active',i===_pmSlideIdx));
}

// Reemplaza una foto de producto rota por el emoji de respaldo. Se define
// aparte (en vez de anidar el HTML dentro del atributo onerror) para poder
// escapar el emoji correctamente con escapeHtml().
function _pmImgError(imgEl) {
  imgEl.parentElement.innerHTML = '<span style="font-size:72px">' + escapeHtml(window._pmFallbackEmoji) + '</span>';
}

function openProdModal(id) {
  const p = DB.productos.find(x => x.id === id);
  if (!p) return;
  _modalProdId = id;

  // Imágenes — slider si hay varias
  const fotos = p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []);
  const emojiEl = document.getElementById('pm-emoji');
  const pmImg = document.getElementById('pm-img');

  if(fotos.length > 0) {
    pmImg.style.background = '#f5f5f5';
    emojiEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    window._pmFallbackEmoji = p.emoji || '✨'; // usado por _pmImgError() si una foto no carga
    emojiEl.innerHTML = `
      <div style="position:relative;width:100%;height:100%;overflow:hidden">
        <div id="pm-slider-track" style="display:flex;height:100%;transition:transform .35s cubic-bezier(.4,0,.2,1)">
          ${fotos.map(src=>`<div style="flex:0 0 100%;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8f4f1"><img src="${src}" style="width:calc(100% - 24px);height:calc(100% - 24px);object-fit:contain;display:block;border-radius:14px" onerror="_pmImgError(this)"></div>`).join('')}
        </div>
        ${fotos.length>1?`
          <button onclick="pmSlide(-1,${fotos.length})" style="position:absolute;top:50%;left:8px;transform:translateY(-50%);background:rgba(255,255,255,0.92);border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;color:var(--brown);box-shadow:0 2px 8px rgba(61,43,38,0.2);z-index:2;display:flex;align-items:center;justify-content:center">‹</button>
          <button onclick="pmSlide(1,${fotos.length})" style="position:absolute;top:50%;right:8px;transform:translateY(-50%);background:rgba(255,255,255,0.92);border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;color:var(--brown);box-shadow:0 2px 8px rgba(61,43,38,0.2);z-index:2;display:flex;align-items:center;justify-content:center">›</button>
          <div id="pm-slider-dots" style="position:absolute;bottom:8px;left:0;right:0;display:flex;justify-content:center;gap:5px;z-index:2">
            ${fotos.map((_,i)=>`<button onclick="pmSlideTo(${i},${fotos.length})" style="width:7px;height:7px;border-radius:50%;background:${i===0?'#fff':'rgba(255,255,255,0.5)'};border:none;cursor:pointer;padding:0;transition:background .2s"></button>`).join('')}
          </div>
          <span id="pm-slider-count" style="position:absolute;top:8px;right:10px;background:rgba(61,43,38,0.55);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;z-index:2">1/${fotos.length}</span>
        `:''}
      </div>`;
    _pmSlideIdx = 0;
  } else {
    pmImg.style.background = '#FAF5F0';
    emojiEl.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:88px';
    emojiEl.innerHTML = escapeHtml(p.emoji) || '👗';
  }
  const badge = document.getElementById('pm-badge');
  if (p.badge) { badge.textContent = p.badge; badge.style.display = ''; }
  else badge.style.display = 'none';

  // Info
  document.getElementById('pm-cat').textContent = catLabel(p.cat);
  document.getElementById('pm-nombre').textContent = p.nombre;
  document.getElementById('pm-precio').textContent = p.precio;
  document.getElementById('pm-desc').textContent = p.desc || '';

  // Video del producto
  const videoSection = document.getElementById('pm-video-section');
  if (videoSection) {
    if (p.video) {
      const embed = !p.videoEsArchivo ? parseVideoEmbedUrl(p.video) : null;
      videoSection.style.display = 'block';
      videoSection.innerHTML = embed
        ? `<div style="border-radius:12px;overflow:hidden;aspect-ratio:16/9"><iframe src="${embed}" style="width:100%;height:100%;border:0" allowfullscreen></iframe></div>`
        : `<video src="${p.video}" controls playsinline style="width:100%;border-radius:12px;background:#000;max-height:280px"></video>`;
    } else {
      videoSection.style.display = 'none';
      videoSection.innerHTML = '';
    }
  }

  // Stock
  const stockEl = document.getElementById('pm-stock-badge');
  if (p.stock === 0) { stockEl.textContent = '✕ Agotado'; stockEl.className = 'pm-stock out'; }
  else if (p.stock <= 3) { stockEl.textContent = `⚠ Pocas unidades — ${p.stock} disponibles`; stockEl.className = 'pm-stock low'; }
  else { stockEl.textContent = `✓ Disponible — ${p.stock} unidades`; stockEl.className = 'pm-stock ok'; }

  // Botón
  const addBtn = document.getElementById('pm-add-btn');
  if (p.stock === 0) {
    addBtn.disabled = true;
    addBtn.textContent = 'Agotado';
    addBtn.style.background = '';
  } else if (!currentClient) {
    addBtn.disabled = false;
    addBtn.textContent = '🔒 Inicia sesión para comprar';
    addBtn.style.background = 'var(--brown)';
  } else {
    addBtn.disabled = false;
    addBtn.textContent = '+ Agregar al carrito';
    addBtn.style.background = '';
  }

  // Botón eliminar del mostrador — solo visible si el admin está logueado (y si el botón existe en el HTML)
  const delBtn = document.getElementById('pm-delete-btn');
  const adminNavBtn = document.getElementById('admin-nav-btn');
  if (delBtn) delBtn.style.display = (adminNavBtn && adminNavBtn.classList.contains('visible')) ? 'block' : 'none';

  document.getElementById('prod-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function eliminarDelMostrador() {
  if(!_modalProdId) return;
  const p = DB.productos.find(x=>x.id===_modalProdId);
  if(!p) return;
  closeProdModal();
  setTimeout(()=>{
    mostrarConfirm('🗑','Eliminar del mostrador',
      `"${p.nombre}" será eliminado del catálogo público y del inventario. ¿Continuar?`,
      'Sí, eliminar',
      function(){
        DB.productos = DB.productos.filter(x=>x.id!==_modalProdId);
        persist(['productos']);
        renderAdminInventario && renderAdminInventario();
        renderProducts('');
        toast('🗑 Producto eliminado del mostrador');
      });
  }, 200);
}

function closeProdModal() {
  document.getElementById('prod-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeProdModalOutside(e) {
  if (e.target === document.getElementById('prod-modal-overlay')) closeProdModal();
}

function addFromModal() {
  if (!currentClient) {
    closeProdModal();
    setTimeout(() => {
      openClientAuth();
      toast('🔒 Inicia sesión para agregar al carrito');
    }, 200);
    return;
  }
  if (_modalProdId === null) return;
  const p = DB.productos.find(x => x.id === _modalProdId);
  if (!p) return;
const foto = (p.fotos && p.fotos[0]) || p.foto || '';
  addToCart(p.id, p.nombre, p.precio_num, p.emoji, foto, p.cat);
  closeProdModal();
}
function refreshModalAuthState() {
  const addBtn = document.getElementById('pm-add-btn');
  if (!addBtn) return;
  if (addBtn.disabled && addBtn.textContent.trim() === 'Agotado') return;
  if (!currentClient) {
    addBtn.textContent = '🔒 Inicia sesión para comprar';
    addBtn.style.background = 'var(--brown)';
  } else {
    addBtn.textContent = '+ Agregar al carrito';
    addBtn.style.background = '';
  }
}
