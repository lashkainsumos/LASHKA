// ===== WOMPI / PAGOS =====
function abrirWompi() {
  if (!currentClient) {
    closeCart();
    setTimeout(() => { openClientAuth(); toast('Inicia sesion para pagar'); }, 200);
    return;
  }
  if (cart.length === 0) { toast('El carrito esta vacio'); return; }
  const total = cart.reduce((s,i) => s + i.precio_num * i.qty, 0);
  const totalTxt = formatPrice(total);
  const totalEl = document.getElementById('wompi-total');
  if (totalEl) totalEl.textContent = totalTxt;
  const totalQrEl = document.getElementById('wompi-total-qr');
  if (totalQrEl) totalQrEl.textContent = totalTxt;
  const itemsHtml = cart.map(i =>
    '<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid #f0e8e4">' +
    '<span>' + escapeHtml(i.nombre) + ' x' + i.qty + '</span>' +
    '<span style="font-weight:600">' + formatPrice(i.precio_num * i.qty) + '</span></div>'
  ).join('');
  document.getElementById('wompi-items').innerHTML = itemsHtml;
  const ov = document.getElementById('wompi-overlay');
  ov.style.display = 'flex';
}
function cerrarWompi() {
  document.getElementById('wompi-overlay').style.display = 'none';
}
function abrirQrFullscreen() {
  const totalTxt = document.getElementById('wompi-total-qr')?.textContent || '';
  const fsTotal = document.getElementById('qr-fullscreen-total');
  if (fsTotal) fsTotal.textContent = totalTxt ? ('Monto a transferir: ' + totalTxt) : '';
  document.getElementById('qr-fullscreen-overlay').style.display = 'flex';
}
function cerrarQrFullscreen() {
  document.getElementById('qr-fullscreen-overlay').style.display = 'none';
}
function pagarNequi() {
  const total = cart.reduce((s,i) => s + i.precio_num * i.qty, 0);
  const items = cart.map(i => '- ' + i.nombre + ' x' + i.qty).join('%0A');
  const msg = 'Hola Lashka! Quiero pagar por Nequi:%0A%0A' + items + '%0A%0ATotal: ' + formatPrice(total) + '%0A%0AYa realice la transferencia al 3134232433. (Adjuntar comprobante).';
  window.open('https://wa.me/573136395775?text=' + msg, '_blank');
  cerrarWompi();
}
