// ===== BÚSQUEDA =====
function handleSearch(q) {
  const drop = document.getElementById('search-dropdown');
  if (!q || q.trim().length < 1) { drop.innerHTML=''; drop.classList.remove('open'); return; }
  const term = q.toLowerCase().trim();
  const results = DB.productos.filter(p =>
    p.nombre.toLowerCase().includes(term) ||
    (p.cat && p.cat.toLowerCase().includes(term)) ||
    (p.desc && p.desc.toLowerCase().includes(term))
  ).slice(0, 6);
  if (!results.length) {
    drop.innerHTML = `<div class="search-no-results">🔍 No encontramos resultados para "<strong>${escapeHtml(q)}</strong>"</div>`;
  } else {
    drop.innerHTML = results.map(p => `
      <div class="search-item" onclick="selectSearchResult(${p.id})">
        <div class="search-item-emoji">${escapeHtml(p.emoji)||'👗'}</div>
        <div class="search-item-info"><h5>${escapeHtml(p.nombre)}</h5><span>${escapeHtml(catLabel(p.cat))||''}</span></div>
        <span class="search-item-price">${escapeHtml(p.precio)||''}</span>
      </div>`).join('');
  }
  drop.classList.add('open');
}
function showSearchDrop() {
  const q = document.getElementById('search-input').value;
  if (q.trim().length > 0) document.getElementById('search-dropdown').classList.add('open');
}
function hideSearchDrop() {
  document.getElementById('search-dropdown').classList.remove('open');
}
function selectSearchResult(id) {
  document.getElementById('search-input').value = '';
  document.getElementById('search-dropdown').innerHTML='';
  document.getElementById('search-dropdown').classList.remove('open');
  // Si ya estamos en catálogo, abrir directo; si no, cambiar vista primero
  const catalogView = document.getElementById('view-catalog');
  if(catalogView && catalogView.classList.contains('active')) {
    openProdModal(id);
  } else {
    const navCatalog = document.querySelectorAll('.nav-links a')[1];
    showView('catalog', navCatalog);
    setTimeout(() => openProdModal(id), 350);
  }
}

function filterProducts(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts(cat);
}

// ===== VALIDACIÓN =====
function validateField(input, regex, errorMsg) {
  const val = input.value.trim();
  const errEl = input.parentElement.querySelector('.field-error');
  if (!val || (regex && !regex.test(val))) {
    input.classList.add('error');
    if (errEl) { errEl.textContent = errorMsg || 'Campo requerido'; errEl.classList.add('show'); }
    return false;
  }
  input.classList.remove('error');
  if (errEl) errEl.classList.remove('show');
  return true;
}

