// ===== AUTH CLIENTAS =====
let currentClient = null;
let currentClientFoto = null; // foto de perfil (base64) de la clienta con sesión activa
let _clientAuth = null; // referencia a Firebase Auth (compartida con admin)

function openClientAuth() {
  if (currentClient) { openClientPanel(); return; }
  document.getElementById('auth-overlay').classList.add('open');
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-reg-error').style.display = 'none';
  setTimeout(() => document.getElementById('cl-email').focus(), 100);
}

function closeClientAuth() {
  document.getElementById('auth-overlay').classList.remove('open');
}

function switchAuthTab(tab) {
  document.getElementById('auth-login-form').style.display   = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

function setAuthLoading(loading, type='login') {
  if (type === 'login') {
    document.getElementById('auth-btn-text').textContent = loading ? 'Ingresando...' : 'Ingresar';
    document.getElementById('auth-spinner').style.display = loading ? 'inline-block' : 'none';
    if (document.getElementById('auth-submit-btn')) document.getElementById('auth-submit-btn').disabled = loading;
  } else {
    document.getElementById('auth-reg-text').textContent = loading ? 'Creando cuenta...' : 'Crear cuenta';
    document.getElementById('auth-reg-spinner').style.display = loading ? 'inline-block' : 'none';
    if (document.getElementById('auth-reg-btn')) document.getElementById('auth-reg-btn').disabled = loading;
  }
}

function showAuthError(msg, type='login') {
  const el = document.getElementById(type === 'login' ? 'auth-error' : 'auth-reg-error');
  el.textContent = msg; el.style.display = 'block';
}

const AUTH_ERRORS = {
  'auth/invalid-email':       'Correo electrónico inválido',
  'auth/user-not-found':      'No existe una cuenta con ese correo',
  'auth/wrong-password':      'Contraseña incorrecta',
  'auth/invalid-credential':  'Correo o contraseña incorrectos',
  'auth/too-many-requests':   'Demasiados intentos. Intenta más tarde',
  'auth/email-already-in-use':'Ya existe una cuenta con ese correo',
  'auth/weak-password':       'La contraseña debe tener al menos 6 caracteres',
  'auth/user-disabled':       'Esta cuenta ha sido deshabilitada',
};

async function doClientLogin() {
  const email = document.getElementById('cl-email').value.trim();
  const pass  = document.getElementById('cl-pass').value;
  if (!email || !pass) { showAuthError('Completa correo y contraseña'); return; }
  document.getElementById('auth-error').style.display = 'none';
  setAuthLoading(true, 'login');
  try {
    const auth = await getClientAuth();
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    setAuthLoading(false, 'login'); // apagar spinner antes de cerrar
    closeClientAuth();              // cerrar modal primero
    await onClientLoggedIn(cred.user); // luego abrir panel
  } catch(err) {
    console.error('Error login Firebase:', err.code, err.message);
    setAuthLoading(false, 'login');
    showAuthError(AUTH_ERRORS[err.code] || ('Error: ' + (err.code || err.message || 'desconocido')));
    document.getElementById('cl-pass').value = '';
  }
}

async function doClientRegister(recaptchaToken) {
  const nombre = document.getElementById('cl-nombre').value.trim();
  const email  = document.getElementById('cl-reg-email').value.trim();
  const pass   = document.getElementById('cl-reg-pass').value;
  const tel    = document.getElementById('cl-tel').value.trim();
  if (!nombre || !email || !pass) { showAuthError('Completa todos los campos requeridos', 'register'); return; }
  if (pass.length < 6) { showAuthError('La contraseña debe tener al menos 6 caracteres', 'register'); return; }
  document.getElementById('auth-reg-error').style.display = 'none';
  setAuthLoading(true, 'register');
  if (recaptchaToken) {
    const verificacion = await verifyRecaptchaToken(recaptchaToken, 'register');
    if (!verificacion.success) {
      setAuthLoading(false, 'register');
      rejectRecaptcha('register');
      return;
    }
  }
  try {
    const auth = await getClientAuth();
    const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: nombre });
    // Registrar en DB clientes
    const existe = DB.clientes.find(c => (c.correo||'').toLowerCase() === email.toLowerCase());
    if (!existe) {
      const nuevoCliente = { id: Date.now()+Math.floor(Math.random()*1000), nombre, correo: email, tel: tel||'—', citas: 0, ultima: '—' };
      DB.clientes.push(nuevoCliente);
      const res = await persistClientePropio(nuevoCliente);
      if (!res.ok) {
        console.error('No se pudo guardar el registro de clienta:', res.error);
        toast('⚠ Tu cuenta se creó, pero hubo un problema guardando tus datos: ' + res.error);
      }
    }
    await onClientLoggedIn(cred.user);
    closeClientAuth();
    toast('🌸 ¡Bienvenida, ' + nombre.split(' ')[0] + '!');
  } catch(err) {
    console.error('Error registro Firebase:', err.code, err.message);
    setAuthLoading(false, 'register');
    const msg = AUTH_ERRORS[err.code] || ('Error: ' + (err.code || err.message || 'desconocido'));
    showAuthError(msg, 'register');
  }
}

async function doClientReset() {
  const email = document.getElementById('cl-email').value.trim();
  if (!email) { showAuthError('Escribe tu correo primero'); return; }
  try {
    const auth = await getClientAuth();
    const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await sendPasswordResetEmail(auth, email);
    toast('✓ Correo de recuperación enviado a ' + email);
    closeClientAuth();
  } catch(err) {
    showAuthError(AUTH_ERRORS[err.code] || 'No se pudo enviar el correo');
  }
}

async function doClientLogout() {
  try {
    const auth = await getClientAuth();
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await signOut(auth);
  } catch(e) {}
  currentClient = null;
  currentClientFoto = null;
  cart = []; saveCart(); updateCartBadge();
  updateClientNavBtn();
  refreshModalAuthState();
  closeClientPanel();
  // Ocultar botón Admin al cerrar sesión
  const adminBtn = document.getElementById('admin-nav-btn');
  if (adminBtn) adminBtn.classList.remove('visible');
  toast('Sesión cerrada');
}

// Devuelve la instancia Auth — reutiliza la del admin si ya fue inicializada
async function getClientAuth() {
  if (_clientAuth) return _clientAuth;
  // firebaseAuth ya fue inicializado por initFirebase(); lo reutilizamos
  if (firebaseAuth) { _clientAuth = firebaseAuth; return _clientAuth; }
  // fallback: inicializar si todavía no está listo
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  _clientAuth = getAuth(app);
  return _clientAuth;
}

async function onClientLoggedIn(user) {
  currentClient = user;
  updateClientNavBtn();
  refreshModalAuthState();
  // Si el usuario es el admin, mostrar botón Admin en el nav
  const adminBtn = document.getElementById('admin-nav-btn');
  if (adminBtn) {
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      adminBtn.classList.add('visible');
    } else {
      adminBtn.classList.remove('visible');
    }
  }
  openClientPanel();
}

function updateClientNavBtn() {
  const btn = document.getElementById('client-nav-btn');
  const mobileBtn = document.getElementById('mobile-client-btn');
  if (!btn && !mobileBtn) return;
  if (currentClient) {
    const nombre = currentClient.displayName || currentClient.email.split('@')[0];
    const avatar = currentClientFoto
      ? `<span class="nav-avatar" style="background-image:url('${currentClientFoto}')"></span>`
      : `<span class="nav-avatar nav-avatar-icon">👤</span>`;
    if (btn) {
      btn.innerHTML = avatar + escapeHtml(nombre.split(' ')[0]);
      btn.classList.add('logged');
    }
    if (mobileBtn) {
      mobileBtn.innerHTML = avatar + escapeHtml(nombre.split(' ')[0]);
      mobileBtn.classList.add('logged');
    }
  } else {
    if (btn) {
      btn.innerHTML = '👤 Mi cuenta';
      btn.classList.remove('logged');
    }
    if (mobileBtn) {
      mobileBtn.innerHTML = '👤 Mi cuenta';
      mobileBtn.classList.remove('logged');
    }
  }
}

// ===== PANEL CLIENTA =====
async function openClientPanel() {
  if (!currentClient) { openClientAuth(); return; }
  const nombre = currentClient.displayName || currentClient.email.split('@')[0];
  document.getElementById('cp-nombre').textContent = nombre;
  document.getElementById('cp-email-display').textContent = currentClient.email;
  renderClientAvatar(); // muestra iniciales de inmediato mientras carga la foto
  renderClientCompras();
  document.getElementById('client-panel-overlay').classList.add('open');
  await cargarFotoClienteActual();
  renderClientAvatar(); // ya con la foto, si tenía una guardada
  updateClientNavBtn(); // refleja la foto también en el botón de la barra
}

// Trae la foto de perfil guardada de la clienta actual desde Firestore
// (se guarda como texto base64 en su propio documento, campo "foto").
async function cargarFotoClienteActual() {
  currentClientFoto = null;
  if (!currentClient || !_db) return;
  try {
    const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const q = query(collection(_db, 'clientes'), where('correo', '==', currentClient.email));
    const snap = await getDocs(q);
    if (!snap.empty) currentClientFoto = snap.docs[0].data().foto || null;
  } catch (e) {
    console.warn('No se pudo cargar la foto de perfil:', e.message);
  }
}

// Pinta el avatar de la clienta: su foto de perfil (currentClientFoto) si
// ya cargó una, o sus iniciales si no.
function renderClientAvatar() {
  const el = document.getElementById('cp-avatar');
  if (!el || !currentClient) return;
  if (currentClientFoto) {
    el.style.backgroundImage = `url('${currentClientFoto}')`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    const nombre = currentClient.displayName || currentClient.email.split('@')[0];
    el.textContent = nombre.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  }
}

// Reduce y comprime la imagen elegida en el propio navegador (canvas),
// para que quede lo bastante liviana como para guardarse como texto en
// Firestore, sin necesitar Cloud Storage (que exige plan de pago).
function comprimirImagenAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 160;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// Sube la foto de perfil: la comprime en el navegador y la guarda como texto
// (base64) directamente en el documento de la clienta en Firestore — no usa
// Cloud Storage, así no requiere el plan de pago de Firebase.
async function subirFotoPerfil(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  input.value = '';
  if (!file.type.startsWith('image/')) { toast('⚠ Selecciona una imagen'); return; }
  if (file.size > 8 * 1024 * 1024) { toast('⚠ La imagen no debe superar 8 MB'); return; }
  if (!currentClient) return;

  const avatarEl = document.getElementById('cp-avatar');
  avatarEl.classList.add('uploading');
  try {
    const dataUrl = await comprimirImagenAvatar(file);
    currentClientFoto = dataUrl;
    renderClientAvatar();
    updateClientNavBtn();
    avatarEl.classList.remove('uploading');
    toast('🌸 Foto de perfil actualizada');
    const res = await actualizarFotoClienta(currentClient.email, dataUrl);
    if (res && res.ok === false) {
      toast('⚠ Se ve en tu sesión, pero no se pudo guardar: ' + res.error);
    }
  } catch (e) {
    console.error(e);
    toast('⚠ No se pudo procesar la imagen: ' + e.message);
    avatarEl.classList.remove('uploading');
  }
}

function closeClientPanel() {
  document.getElementById('client-panel-overlay').classList.remove('open');
  showView('home', document.querySelectorAll('.nav-links a')[0]); window.scrollTo({top:0,behavior:'smooth'});
}

function closeClientPanelOutside(e) {
  if (e.target === document.getElementById('client-panel-overlay')) closeClientPanel();
}

function renderClientCompras() {
  const lista = document.getElementById('cp-compras-list');
  // Las compras se hacen por WhatsApp, así que mostramos el carrito actual si tiene items
  if (!cart.length) {
    lista.innerHTML = '<div class="cp-empty">Tus pedidos se realizan por WhatsApp.<br><small>Cuando hagas un pedido quedará registrado aquí.</small></div>';
    return;
  }
  const total = cart.reduce((s,i) => s + i.precio_num * i.qty, 0);
  lista.innerHTML = `
    <div class="cp-compra-card">
      <div class="cp-compra-info">
        <h4>Carrito actual — ${cart.length} producto${cart.length>1?'s':''}</h4>
        <p>${cart.map(i=>escapeHtml(i.nombre)+(i.qty>1?' x'+i.qty:'')).join(', ')}</p>
      </div>
      <span style="font-weight:700;color:var(--rose-deep)">${formatPrice(total)}</span>
    </div>`;
}

