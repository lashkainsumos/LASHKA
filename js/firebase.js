// ===== FIREBASE CONFIG =====
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDt4GGaq_CGZSnmnI2zFCtSSDTycCkPMKI",
  authDomain:        "lashkainsumos-e03dc.firebaseapp.com",
  projectId:         "lashkainsumos-e03dc",
  storageBucket:     "lashkainsumos-e03dc.firebasestorage.app",
  messagingSenderId: "838563176307",
  appId:             "1:838563176307:web:7df5ff66d9dd23a8022f06"
};
const FIREBASE_CONFIGURED = true;

// ===== CORREO ADMIN AUTORIZADO =====
// Solo este correo puede acceder al panel de administración
const ADMIN_EMAIL = 'lashkainsumos@gmail.com';

// ===== DATOS POR DEFECTO =====
const PRODUCTOS_DEFAULT = [
  {id:1,nombre:'Pestañas Efecto Volumen 3D',cat:'Pestañas',precio:'$45.000',precio_num:45000,stock:20,estado:'Disponible',emoji:'✨',badge:'Nuevo',desc:'Pestañas de seda para técnica de volumen ruso, curvatura C, banda ultrafina y flexible.'},
  {id:2,nombre:'Adhesivo de Secado Rápido',cat:'Adhesivos',precio:'$38.000',precio_num:38000,stock:14,estado:'Disponible',emoji:'💧',badge:'',desc:'Pegamento profesional de secado rápido (1-2 seg), alta retención, 5ml.'},
  {id:3,nombre:'Pinza Curva de Precisión',cat:'Herramientas',precio:'$52.000',precio_num:52000,stock:3,estado:'Poco stock',emoji:'🛠️',badge:'-20%',desc:'Pinza en acero inoxidable, agarre firme para aislamiento y aplicación de extensiones.'},
  {id:4,nombre:'Primer Desengrasante',cat:'Insumos',precio:'$25.000',precio_num:25000,stock:0,estado:'Agotado',emoji:'🧴',badge:'',desc:'Prepara la pestaña natural eliminando grasa y residuos antes de la aplicación.'},
  {id:5,nombre:'Kit de Micropinceles',cat:'Insumos',precio:'$18.000',precio_num:18000,stock:25,estado:'Disponible',emoji:'🖌️',badge:'Nuevo',desc:'Paquete de 100 micropinceles desechables para limpieza y aplicación de primer.'},
  {id:6,nombre:'Sellador de Pestañas',cat:'Adhesivos',precio:'$40.000',precio_num:40000,stock:20,estado:'Disponible',emoji:'🔒',badge:'',desc:'Sella y protege el trabajo terminado, prolongando la duración del servicio.'},
];
const CLIENTES_DEFAULT = [];
const CITAS_DEFAULT = [];
const MENSAJES_DEFAULT = [];
const MOVIMIENTOS_DEFAULT = [];

// ===== BASE DE DATOS EN MEMORIA (sincronizada con Firestore) =====
let DB = {
  citas:       [...CITAS_DEFAULT],
  clientes:    [...CLIENTES_DEFAULT],
  mensajes:    [...MENSAJES_DEFAULT],
  productos:   [...PRODUCTOS_DEFAULT],
  movimientos: [...MOVIMIENTOS_DEFAULT],
};
let _db = null; // instancia Firestore
let _storage = null; // instancia Firebase Storage (para videos de producto)

// Qué colecciones ya se confirmaron cargadas con éxito desde Firestore en
// esta sesión. persistCollection() se niega a guardar una colección que no
// esté aquí — así, si la carga inicial falla (red, cuota agotada, etc.), es
// IMPOSIBLE que los datos por defecto (en memoria) se guarden por encima de
// los datos reales del usuario en la nube. Esto es lo que causó que el
// inventario real se sobrescribiera con los productos de muestra.
const _coleccionesListas = new Set();

// ID reservado para el documento "centinela" dentro de la colección productos.
// Marca que la tienda ya fue inicializada, para nunca volver a sembrar los
// productos de muestra una vez que el usuario borra su inventario real.
// Nunca aparece en pantalla: se filtra siempre de las listas de productos.
const INIT_FLAG_ID = '_init_flag_';

// Guarda una colección completa en Firestore. Devuelve {ok:true} o {ok:false, error}
async function persistCollection(nombre, datos) {
  if (!_db) return { ok:false, error:'Sin conexión a la base de datos (Firestore no inicializado)' };
  if (!_coleccionesListas.has(nombre)) {
    return { ok:false, error:`No se pudo confirmar tu "${nombre}" real desde la nube todavía, así que por seguridad no se guardó nada (para no borrar tus datos verdaderos). Recarga la página e inténtalo de nuevo.` };
  }
  try {
    const { collection, writeBatch, doc, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const batch = writeBatch(_db);
    const snap = await getDocs(collection(_db, nombre));
    const idsActuales = new Set(datos.map(item => String(item.id)));
    if (nombre === 'productos') idsActuales.add(INIT_FLAG_ID); // nunca borrar el centinela
    snap.docs.forEach(d => { if (!idsActuales.has(d.id)) batch.delete(d.ref); });
    datos.forEach(item => {
      const ref = doc(collection(_db, nombre), String(item.id));
      batch.set(ref, item);
    });
    await batch.commit();
    return { ok:true };
  } catch(e) {
    console.warn('Error guardando en Firestore:', e.message);
    return { ok:false, error:e.message };
  }
}

// Carga una colección desde Firestore; si está vacía devuelve array vacío.
// Si la LECTURA falla (red, permisos, cuota agotada, etc.) devuelve null —
// nunca los datos de muestra — para que quien llama sepa que esto NO es el
// inventario real y así nunca los guarde por encima de los datos verdaderos.
// Los datos de muestra solo se siembran en el flujo de "primera vez" de
// abajo, cuando Firestore respondió con éxito que la colección está vacía.
const DEMO_IDS = new Set(['1','2','3','4','5']); // IDs de datos demo a ignorar
async function loadCollection(nombre, defaults) {
  if (!_db) return null;
  try {
    const { collection, getDocs, writeBatch, doc, deleteDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDocs(collection(_db, nombre));
    _coleccionesListas.add(nombre); // la lectura fue exitosa: ya es seguro guardar esta colección

    if (nombre === 'productos') {
      // Separar el documento centinela (no es un producto real) del resto
      const flagDoc = snap.docs.find(d => d.id === INIT_FLAG_ID);
      const productDocs = snap.docs.filter(d => d.id !== INIT_FLAG_ID);

      if (productDocs.length === 0) {
        if (flagDoc) {
          // Ya se inicializó antes y el usuario vació su inventario a propósito.
          // No se vuelve a sembrar nada.
          return [];
        }
        // Primerísima vez que se usa la tienda: sembrar productos de muestra
        // y dejar marcado el centinela para nunca repetirlo.
        if (defaults.length) {
          const batch = writeBatch(_db);
          defaults.forEach(item => {
            const ref = doc(collection(_db, nombre), String(item.id));
            batch.set(ref, item);
          });
          batch.set(doc(collection(_db, nombre), INIT_FLAG_ID), { _flag: true });
          await batch.commit();
          return defaults;
        }
        return [];
      }

      // Hay productos reales. Si por algún motivo no existe el centinela
      // (tiendas creadas antes de este arreglo), lo creamos ahora sin tocar
      // los productos existentes.
      if (!flagDoc) {
        try { await setDoc(doc(collection(_db, nombre), INIT_FLAG_ID), { _flag: true }); }
        catch(e) { console.warn('No se pudo crear el centinela:', e.message); }
      }
      return productDocs.map(d => d.data());
    }

    if (snap.empty) return [];
    const data = snap.docs.map(d => d.data());
    // Filtrar datos demo (IDs 1-5) en citas, clientes y mensajes
    const demoItems = snap.docs.filter(d => DEMO_IDS.has(d.id));
    if (demoItems.length) {
      // Borrar silenciosamente los datos demo de Firestore
      await Promise.all(demoItems.map(d => deleteDoc(d.ref)));
      return data.filter(item => !DEMO_IDS.has(String(item.id)));
    }
    return data;
  } catch(e) {
    console.warn('Error cargando desde Firestore:', e.message);
    return null; // fallo real de lectura: nunca sustituir por datos de muestra
  }
}

// Persiste cambios a Firestore.
// Por defecto sincroniza las 5 colecciones (comportamiento original), pero
// acepta una lista opcional de nombres para sincronizar SOLO esas — así una
// acción puntual (p.ej. borrar un movimiento) no dispara una lectura+escritura
// completa de las otras 4 colecciones, que es lo que agota la cola de
// escrituras de Firestore cuando se hacen varias acciones seguidas.
// Muestra un aviso visible si algo falla, en vez de fallar en silencio,
// para que el usuario sepa que sus cambios NO se guardaron de verdad.
async function persist(colecciones) {
  const todas = {
    citas:       () => persistCollection('citas',       DB.citas),
    clientes:    () => persistCollection('clientes',    DB.clientes),
    mensajes:    () => persistCollection('mensajes',    DB.mensajes),
    productos:   () => persistCollection('productos',   DB.productos),
    movimientos: () => persistCollection('movimientos', DB.movimientos),
  };
  const nombres = Array.isArray(colecciones) && colecciones.length ? colecciones : Object.keys(todas);
  const resultados = await Promise.all(nombres.map(n => todas[n]()));
  const fallo = resultados.find(r => !r.ok);
  if (fallo) {
    if (typeof toast === 'function') {
      toast('⚠ No se guardó en la nube: ' + fallo.error + ' — tus cambios se perderán al recargar la página');
    }
    console.error('PERSIST FALLÓ:', fallo.error);
    return false;
  }
  return true;
}

// Guarda y carga los looks del lookbook por separado
async function persistLooks(looks) {
  if (!_db) {
    if (typeof toast === 'function') toast('⚠ No se guardó en la nube: sin conexión a Firestore — tus cambios se perderán al recargar la página');
    return false;
  }
  try {
    const { collection, writeBatch, doc, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const batch = writeBatch(_db);
    const snap = await getDocs(collection(_db, 'looks'));
    const idsActuales = new Set(looks.map(l => String(l.id)));
    snap.docs.forEach(d => { if (!idsActuales.has(d.id)) batch.delete(d.ref); });
    looks.forEach(look => {
      const ref = doc(collection(_db, 'looks'), String(look.id));
      batch.set(ref, look);
    });
    await batch.commit();
    return true;
  } catch(e) {
    console.error('Error guardando looks:', e.message);
    if (typeof toast === 'function') toast('⚠ No se guardó en la nube: ' + e.message + ' — tus cambios se perderán al recargar la página');
    return false;
  }
}

// Guarda un solo producto (setDoc directo, sin leer/reescribir toda la
// colección). Se usa en acciones frecuentes como +/- de stock, donde clics
// seguidos con persist(['productos']) completo saturaban la cola de
// escritura de Firestore (error "resource-exhausted").
async function persistProductoUnico(producto) {
  if (!_db) return { ok:false, error:'Sin conexión a la base de datos (Firestore no inicializado)' };
  try {
    const { collection, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const ref = doc(collection(_db, 'productos'), String(producto.id));
    await setDoc(ref, producto);
    return { ok:true };
  } catch(e) {
    console.warn('Error guardando producto:', e.message);
    return { ok:false, error:e.message };
  }
}

// Guarda un solo movimiento nuevo (setDoc directo). Igual que arriba: evita
// reescribir toda la colección de movimientos por cada entrada/salida.
async function persistMovimientoUnico(movimiento) {
  if (!_db) return { ok:false, error:'Sin conexión a la base de datos (Firestore no inicializado)' };
  try {
    const { collection, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const ref = doc(collection(_db, 'movimientos'), String(movimiento.id));
    await setDoc(ref, movimiento);
    return { ok:true };
  } catch(e) {
    console.warn('Error guardando movimiento:', e.message);
    return { ok:false, error:e.message };
  }
}

// Borra un solo movimiento (deleteDoc directo, sin reescribir la colección).
async function eliminarMovimientoFirestore(id) {
  if (!_db) return { ok:false, error:'Sin conexión a la base de datos (Firestore no inicializado)' };
  try {
    const { collection, doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await deleteDoc(doc(collection(_db, 'movimientos'), String(id)));
    return { ok:true };
  } catch(e) {
    console.warn('Error borrando movimiento:', e.message);
    return { ok:false, error:e.message };
  }
}

// Guarda únicamente un mensaje de contacto nuevo (usado en el formulario público).
// Como persist(), pero sin tocar otras colecciones ni listar documentos ajenos —
// funciona aunque quien envía el mensaje no tenga sesión iniciada.
async function persistMensajePropio(mensaje) {
  if (!_db) return { ok:false, error:'Sin conexión a la base de datos (Firestore no inicializado)' };
  try {
    const { collection, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const ref = doc(collection(_db, 'mensajes'), String(mensaje.id));
    await setDoc(ref, mensaje);
    return { ok:true };
  } catch(e) {
    console.warn('Error guardando mensaje:', e.message);
    return { ok:false, error:e.message };
  }
}

// Guarda únicamente el documento propio de una clienta (usado al registrarse).
// A diferencia de persist(), no toca otras colecciones ni intenta listar
// documentos ajenos, así que funciona con los permisos limitados de una clienta.
async function persistClientePropio(cliente) {
  if (!_db) return { ok:false, error:'Sin conexión a la base de datos (Firestore no inicializado)' };
  try {
    const { collection, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const ref = doc(collection(_db, 'clientes'), String(cliente.id));
    await setDoc(ref, cliente);
    return { ok:true };
  } catch(e) {
    console.warn('Error guardando cliente:', e.message);
    return { ok:false, error:e.message };
  }
}

// Registra la fecha/hora de la sesión actual como "última visita" de una
// clienta. Busca su documento por correo (no por ID, que es un timestamp
// arbitrario) y actualiza SOLO el campo "ultima" — no toca el resto de sus
// datos ni depende de tener su registro completo cargado en memoria. Los
// permisos de Firestore ya permiten esto: cada clienta puede actualizar su
// propio documento (donde correo == su correo de sesión).
async function registrarUltimaVisitaCliente(email) {
  if (!_db || !email) return;
  try {
    const { collection, query, where, getDocs, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const q = query(collection(_db, 'clientes'), where('correo', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const fecha = formatFechaCorta(new Date());
    await updateDoc(snap.docs[0].ref, { ultima: fecha });
    // Si el registro ya está cargado en memoria (p.ej. panel admin abierto
    // en esta misma sesión), lo reflejamos también ahí sin esperar recarga.
    const local = DB.clientes.find(c => (c.correo||'').toLowerCase() === email.toLowerCase());
    if (local) local.ultima = fecha;
  } catch(e) {
    console.warn('No se pudo registrar la última visita:', e.message);
  }
}

// Guarda la foto de perfil de una clienta (texto base64) en su documento de
// Firestore (localiza el documento por correo, igual que la función de
// arriba). Nota: en la consola de Firestore hay que excluir el campo "foto"
// de la indexación automática (Índices → Un solo campo → Excepción), porque
// Firestore no indexa strings de más de 1500 bytes y una foto los supera.
async function actualizarFotoClienta(email, foto) {
  if (!_db || !email) return { ok:false, error:'Sin conexión a la base de datos' };
  try {
    const { collection, query, where, getDocs, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const q = query(collection(_db, 'clientes'), where('correo', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return { ok:false, error:'No se encontró tu registro de clienta' };
    await updateDoc(snap.docs[0].ref, { foto });
    const local = DB.clientes.find(c => (c.correo||'').toLowerCase() === email.toLowerCase());
    if (local) local.foto = foto;
    return { ok:true };
  } catch(e) {
    console.warn('No se pudo guardar la foto de la clienta:', e.message);
    return { ok:false, error:e.message };
  }
}

async function loadLooks() {
  if (!_db) return null;
  try {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDocs(collection(_db, 'looks'));
    if (snap.empty) return null; // null = usar defaults
    const data = snap.docs.map(d => d.data());
    // Preservar el orden guardado si existe
    data.sort((a, b) => (a._orden || 0) - (b._orden || 0));
    return data;
  } catch(e) {
    console.warn('Error cargando looks:', e.message);
    return null;
  }
}

