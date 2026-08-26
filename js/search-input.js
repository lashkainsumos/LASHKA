// Usar div contenteditable para evitar completamente el gestor de contraseñas de Chrome
(function() {
  var box = document.getElementById('nav-search-box');
  if (!box) return;

  var div = document.createElement('div');
  div.setAttribute('id', 'search-input');
  div.setAttribute('contenteditable', 'true');
  div.setAttribute('spellcheck', 'false');
  div.setAttribute('role', 'searchbox');
  div.setAttribute('aria-label', 'Buscar producto');
  div.setAttribute('data-placeholder', 'Buscar producto...');
  div.style.cssText = 'border:none;background:transparent;font-family:var(--ff);font-size:13px;color:var(--text);outline:none;width:100%;min-height:18px;line-height:18px;white-space:nowrap;overflow:hidden;cursor:text';

  var style = document.createElement('style');
  style.textContent = '#search-input:empty:before{content:attr(data-placeholder);color:var(--text-muted);pointer-events:none}';
  document.head.appendChild(style);

  div.addEventListener('focus', function() { showSearchDrop(); document.getElementById('search-wrap').classList.add('search-expanded'); });
  div.addEventListener('blur', function() { setTimeout(hideSearchDrop, 180); setTimeout(function(){ document.getElementById('search-wrap').classList.remove('search-expanded'); }, 180); });
  div.addEventListener('input', function() { handleSearch(div.innerText.trim()); });
  div.addEventListener('keydown', function(e) { if(e.key==='Enter') e.preventDefault(); });

  Object.defineProperty(div, 'value', {
    get: function() { return div.innerText.trim(); },
    set: function(v) { div.innerText = v; }
  });

  box.appendChild(div);
})();
