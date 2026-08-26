// ===== CARRITO (localStorage — es por dispositivo, correcto) =====
let cart = [];
try { const c = localStorage.getItem('lashka_cart'); cart = c ? JSON.parse(c) : []; } catch(e) { cart = []; }

function saveCart() { try { localStorage.setItem('lashka_cart', JSON.stringify(cart)); } catch(e) {} }

function updateCartBadge() {
  const total = cart.reduce((s,i) => s + i.qty, 0);
  document.getElementById('cart-badge').textContent = total;
}

function addToCart(id, nombre, precio_num, emoji, foto, cat) {
  if (!currentClient) {
    openClientAuth();
    toast('🔒 Debes iniciar sesión para comprar');
    return;
  }
  const producto = DB.productos.find(p => p.id === id);
  const stockDisponible = producto ? producto.stock : Infinity;
  const key = String(id);
  const existing = cart.find(i => i.key === key);
  if (existing) {
    if (existing.qty >= stockDisponible) {
      toast(`⚠ Solo hay ${stockDisponible} unidad${stockDisponible!==1?'es':''} disponible${stockDisponible!==1?'s':''}`);
      return;
    }
    existing.qty++;
  } else {
    if (stockDisponible <= 0) { toast('⚠ Producto agotado'); return; }
 cart.push({key, id, nombre, precio_num, emoji, foto, cat, qty: 1});
  }
  saveCart();
  updateCartBadge();
   toast('🛍 "' + nombre + '" agregado');
  openCart();
}

function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  if (cart.length === 0) {
    body.innerHTML = `<div class="cart-empty"><span class="empty-icon">🛍</span><p style="font-family:var(--ffd);font-size:16px;color:var(--brown);margin-bottom:.5rem">Tu carrito está vacío</p><p style="font-size:13px;color:var(--text-muted)">Agrega productos de nuestra colección</p></div>`;
    footer.style.display = 'none';
    return;
  }
  footer.style.display = 'block';
   body.innerHTML = cart.map(item => `
    <div class="cart-item">
    <div class="cart-item-emoji">${item.foto ? `<img src="${item.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : escapeHtml(item.emoji)}</div>
      <div class="cart-item-info">
        <h4>${escapeHtml(item.nombre)}</h4>
        <div class="cart-item-price">${formatPrice(item.precio_num * item.qty)}</div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="changeQty('${item.key}', -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.key}', 1)">+</button>
        </div>
      </div>
      <button class="remove-btn" onclick="removeFromCart('${item.key}')" title="Eliminar">✕</button>
    </div>`).join('');
  const subtotal = cart.reduce((s,i) => s + i.precio_num * i.qty, 0);
  document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('cart-total').textContent = formatPrice(subtotal);
}

function formatPrice(num) {
  return '$' + num.toLocaleString('es-CO');
}

function changeQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  if (delta > 0) {
    const producto = DB.productos.find(p => p.id === item.id);
    const stockDisponible = producto ? producto.stock : Infinity;
    if (item.qty >= stockDisponible) {
      toast(`⚠ Solo hay ${stockDisponible} unidad${stockDisponible!==1?'es':''} disponible${stockDisponible!==1?'s':''}`);
      return;
    }
  }
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.key !== key);
  saveCart();
  updateCartBadge();
  renderCart();
}

function removeFromCart(key) {
  cart = cart.filter(i => i.key !== key);
  saveCart();
  updateCartBadge();
  renderCart();
  toast('Producto eliminado del carrito');
}

function clearCart() {
  mostrarConfirm('🛒','Vaciar carrito','Se eliminarán todos los productos del carrito. Esta acción no se puede deshacer.','Sí, vaciar',function(){
    cart = [];
    saveCart();
    updateCartBadge();
    renderCart();
  });
}

function openCart() {
  renderCart();
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-scrim').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-scrim').classList.remove('open');
  document.body.style.overflow = '';
}

function checkoutWhatsApp() {
  if (!currentClient) {
    closeCart();
    setTimeout(() => { openClientAuth(); toast('🔒 Inicia sesión para finalizar tu pedido'); }, 200);
    return;
  }
  if (cart.length === 0) { toast('El carrito está vacío'); return; }
  const items = cart.map(i => `• ${i.nombre} (x${i.qty}) — ${formatPrice(i.precio_num * i.qty)}`).join('%0A');
  const total = cart.reduce((s,i) => s + i.precio_num * i.qty, 0);
  const msg = `Hola Lashka! 👁️ Quiero hacer un pedido:%0A%0A${items}%0A%0A*Total: ${formatPrice(total)}*%0A%0APor favor indícame disponibilidad y método de pago. ¡Gracias!`;
  window.open(`https://wa.me/573136395775?text=${msg}`, '_blank');
}

