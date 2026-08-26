//Detectar sesion mas rapido al recargar

// ===== FIREBASE AUTH =====
let firebaseAuth = null;

async function initFirebase() {
  try {
    // Las 4 importaciones del SDK ahora se piden EN PARALELO (antes iban una
    // detrás de otra, sumando 4 viajes de red seguidos antes de poder hacer
    // cualquier cosa).
    const [
      { initializeApp },
      { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail },
      { getFirestore },
      { getStorage }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js'),
    ]);

    const app = initializeApp(FIREBASE_CONFIG);
    firebaseAuth = getAuth(app);
    _db = getFirestore(app);
    _storage = getStorage(app);

    // Escuchar cambios de sesión (admin + clientas) — ANTES de cargar datos, para detectar sesión al instante
    let _resolverAuthListo;
    const authListo = new Promise(resolve => { _resolverAuthListo = resolve; });
    onAuthStateChanged(firebaseAuth, (user) => {
      const adminBtn = document.getElementById('admin-nav-btn');
      if (user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        if (adminBtn) { adminBtn.classList.add('visible'); adminBtn.style.borderColor = 'var(--green)'; }
        wireMensajesRealtime();
        wireClientesRealtime();
      } else {
        if (adminBtn) adminBtn.classList.remove('visible');
      }
      // Restaurar sesión de clienta automáticamente (persiste al recargar / renovar token)
      if (user) {
        currentClient = user;
        _clientAuth = firebaseAuth;
        updateClientNavBtn();
        refreshModalAuthState();
        // Registrar esta sesión como "última visita" (solo clientas, no el admin)
        if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
          registrarUltimaVisitaCliente(user.email);
          cargarFotoClienteActual().then(updateClientNavBtn);
        }
      } else {
        currentClient = null;
        updateClientNavBtn();
        refreshModalAuthState();
      }
      _resolverAuthListo(); // Firebase ya nos dijo si hay sesión o no (llamar de nuevo no hace nada)
    });

    window._fbSignIn = signInWithEmailAndPassword;
    window._fbSignOut = signOut;
    window._fbResetPass = sendPasswordResetEmail;

    // ===== CATÁLOGO PRIMERO =====
    // "productos" se pide solo, sin esperar a citas/clientes/mensajes/movimientos
    // (esos son datos internos que el catálogo público no necesita). Así el
    // catálogo y el inventario del admin se pintan en cuanto llega SU dato,
    // en vez de esperar a que terminen las otras 5 colecciones.
    loadCollection('productos', PRODUCTOS_DEFAULT).then(productos => {
      if (productos === null) {
        // Falló la lectura real (red/cuota/permisos): NO tocar DB.productos
        // con datos de muestra. persistCollection() ya bloquea el guardado
        // de 'productos' hasta que una carga tenga éxito, así que esto no
        // puede sobrescribir el inventario real aunque el usuario siga
        // usando el panel — pero le avisamos igual.
        if (typeof toast === 'function') toast('⚠ No se pudo cargar tu inventario real desde la nube. Recarga la página antes de hacer cambios.');
        console.error('Falló la carga de productos desde Firestore; se bloquea el guardado hasta recargar.');
        return;
      }
      DB.productos = productos;
      renderProducts('');
      if (typeof renderAdminInventario === 'function' &&
          document.getElementById('admin-overlay')?.classList.contains('open')) {
        renderAdminInventario();
      }
      updateCartBadge();
    });

    // ===== RESTO DE DATOS (uso interno / admin) EN PARALELO, SIN BLOQUEAR =====
    // Se espera primero a que Firebase confirme si hay sesión (o no) —
    // "citas", "clientes", "mensajes" y "movimientos" están protegidas por
    // reglas de solo-admin, así que si se piden ANTES de que el SDK sepa
    // que hay una sesión de administradora persistida (justo al recargar
    // la página), Firestore las rechaza por "permisos insuficientes" como
    // si fuera una visitante anónima, y el panel admin aparece vacío hasta
    // volver a recargar. "looks" es de lectura pública, así que esperar
    // este instante extra no le afecta.
    await authListo;
    const [citas, clientes, mensajes, movimientos, looksGuardados] = await Promise.all([
      loadCollection('citas',       CITAS_DEFAULT),
      loadCollection('clientes',    CLIENTES_DEFAULT),
      loadCollection('mensajes',    MENSAJES_DEFAULT),
      loadCollection('movimientos', MOVIMIENTOS_DEFAULT),
      loadLooks(),
    ]);
    // null = falló la lectura de esa colección: no reemplazar los datos en
    // memoria (persistCollection también bloqueará el guardado de esa
    // colección hasta que se recargue la página con éxito).
    if (citas !== null) DB.citas = citas;
    if (clientes !== null) DB.clientes = clientes;
    if (mensajes !== null) DB.mensajes = mensajes;
    if (movimientos !== null) {
      movimientos.sort((a,b) => (b.ts||0) - (a.ts||0));
      DB.movimientos = movimientos;
    }

    // Cargar looks guardados (o mantener defaults si no hay nada en Firestore)
    if (looksGuardados && looksGuardados.length > 0) {
      LOOKS.length = 0;
      looksGuardados.forEach(l => LOOKS.push(l));
    }
    renderLookbook();

    console.log('✅ Firebase + Firestore conectados correctamente');
  } catch(e) {
    console.warn('Firebase no pudo inicializarse:', e.message);
  }
}
initFirebase();

function setLoginLoading(loading) {
  document.getElementById('login-btn-text').textContent = loading ? 'Ingresando...' : 'Ingresar';
  document.getElementById('login-spinner').style.display = loading ? 'inline-block' : 'none';
  document.getElementById('login-btn').disabled = loading;
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function closeLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('open');
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  setLoginLoading(false);
}

async function doLogin(recaptchaToken) {
  const email = document.getElementById('login-user').value.trim();
  const pass  = document.getElementById('login-pass').value;

  if (!email || !pass) { showLoginError('Completa correo y contraseña'); return; }

  // ── Modo Firebase (producción) ──
  if (FIREBASE_CONFIGURED && firebaseAuth && window._fbSignIn) {
    setLoginLoading(true);
    if (recaptchaToken) {
      const verificacion = await verifyRecaptchaToken(recaptchaToken, 'login');
      if (!verificacion.success) {
        setLoginLoading(false);
        rejectRecaptcha('login');
        return;
      }
    }
    try {
      const cred = await window._fbSignIn(firebaseAuth, email, pass);
      // Verificar que el correo sea el del administrador autorizado
      if (cred.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        await window._fbSignOut(firebaseAuth);
        setLoginLoading(false);
        showLoginError('No tienes permiso para acceder al panel de administración');
        document.getElementById('login-pass').value = '';
        return;
      }
      setLoginLoading(false);
      closeLoginOverlay();
      openAdmin();
    } catch(err) {
      setLoginLoading(false);
      const msgs = {
        'auth/invalid-email':       'Correo electrónico inválido',
        'auth/user-not-found':      'No existe una cuenta con ese correo',
        'auth/wrong-password':      'Contraseña incorrecta',
        'auth/invalid-credential':  'Correo o contraseña incorrectos',
        'auth/too-many-requests':   'Demasiados intentos. Intenta más tarde o recupera tu contraseña',
        'auth/user-disabled':       'Esta cuenta ha sido deshabilitada',
      };
      showLoginError(msgs[err.code] || 'Error al iniciar sesión. Intenta de nuevo.');
      document.getElementById('login-pass').value = '';
    }
    return;
  }

  // Firebase no está disponible (config faltante o no pudo inicializar):
  // no hay forma segura de autenticar, así que no se permite continuar.
  setLoginLoading(false);
  showLoginError('No se pudo conectar con el servidor de autenticación. Revisa tu conexión e intenta de nuevo.');
}

async function resetPassword() {
  const email = document.getElementById('login-user').value.trim();
  if (!email) { showLoginError('Primero escribe tu correo electrónico'); return; }
  if (!FIREBASE_CONFIGURED || !firebaseAuth || !window._fbResetPass) {
    showLoginError('Recuperación de contraseña requiere Firebase configurado');
    return;
  }
  try {
    await window._fbResetPass(firebaseAuth, email);
    document.getElementById('login-error').style.display = 'none';
    toast('✓ Correo de recuperación enviado a ' + email);
    closeLoginOverlay();
  } catch(err) {
    showLoginError('No se pudo enviar el correo. Verifica tu dirección.');
  }
}

async function logoutAdmin() {
  if (FIREBASE_CONFIGURED && firebaseAuth && window._fbSignOut) {
    await window._fbSignOut(firebaseAuth);
  }
  const adminBtn = document.getElementById('admin-nav-btn');
  if (adminBtn) adminBtn.classList.remove('visible');
  closeAdmin();
  toast('Sesión cerrada correctamente');
}

let clientesSearch = '';
let movsFilter = 'todos', movsSearch = '';
