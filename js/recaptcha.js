// ===== INTEGRACIÓN reCAPTCHA ENTERPRISE (Fraud Defense) =====
// El token se genera manualmente con grecaptcha.enterprise.execute() al
// hacer clic en cada botón (ver wireRecaptchaButtons más abajo). Antes los
// botones tenían la clase "g-recaptcha", pero eso hacía que Google le
// agregara SU PROPIO manejador de clic automático (además del nuestro),
// causando un doble envío por cada clic. Por eso ya no se usa esa clase.

// URL de la función verifyRecaptcha. doLogin(), doClientRegister() y
// sendContactMsg() llaman a verifyRecaptchaToken() con el token generado
// aquí antes de continuar. Mientras el proyecto siga en el plan Spark
// (sin Cloud Functions desplegadas), el fetch de abajo fallará y
// verifyRecaptchaToken() deja pasar la acción igualmente (ver su propio
// comentario) — así el sitio no se rompe hoy, y en cuanto subas a Blaze
// y despliegues functions/index.js, la verificación real se activa sola.
const RECAPTCHA_VERIFY_URL = "https://us-central1-lashkainsumos-e03dc.cloudfunctions.net/verifyRecaptcha";
function wireRecaptchaButton(buttonId, action, callback) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    if (typeof grecaptcha === "undefined" || !grecaptcha.enterprise) {
      console.warn("reCAPTCHA aún no cargó, intenta de nuevo en un segundo.");
      return;
    }
    grecaptcha.enterprise.ready(function () {
      grecaptcha.enterprise
        .execute("6LesB5ItAAAAANgMoNFS5ZPKfdgAyePbLCkNE20X", { action: action })
        .then(function (token) {
          callback(token);
        })
        .catch(function (err) {
          console.error("Error ejecutando reCAPTCHA:", err);
          showRecaptchaExecuteError(action);
        });
    });
  });
}

// Se muestra cuando grecaptcha.enterprise.execute() falla (ej. sitekey no
// autorizada para este dominio, error 400 de Google, etc.). Antes esto se
// perdía en consola y el botón parecía "no hacer nada".
function showRecaptchaExecuteError(action) {
  if (action === "register" && typeof setAuthLoading === "function") setAuthLoading(false, "register");
  if (action === "login"    && typeof setLoginLoading === "function") setLoginLoading(false);
  const msg = "No se pudo verificar el reCAPTCHA. Revisa tu conexión o intenta de nuevo en un momento.";
  if (typeof toast === "function") {
    toast(msg);
  } else {
    alert(msg);
  }
}

// El botón de contacto ahora tiene id propio: cnt-submit-btn (antes se
// buscaba por la clase "g-recaptcha", pero esa clase hacía que Google
// le agregara SU PROPIO manejador de clic automáticamente —además del
// nuestro—, provocando que un solo clic disparara el envío dos veces
// (la 2da vez con los campos ya vacíos, mostrando el error falso de
// "Completa los campos requeridos" aunque el mensaje ya se había enviado).
let _contactoEnviando = false; // evita doble envío si se toca 2 veces seguidas (común en móvil con conexión lenta)

function wireRecaptchaButtons() {
  wireRecaptchaButton("auth-reg-btn", "register", onRegisterVerified);
  wireRecaptchaButton("login-btn", "login", onAdminLoginVerified);

  const btn = document.getElementById("cnt-submit-btn");
  if (btn) {
    const textoOriginal = btn.textContent;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (_contactoEnviando) return; // ignora toques repetidos mientras ya se está enviando
      if (typeof grecaptcha === "undefined" || !grecaptcha.enterprise) return;
      _contactoEnviando = true;
      btn.disabled = true;
      btn.textContent = "Enviando...";
      grecaptcha.enterprise.ready(function () {
        grecaptcha.enterprise
          .execute("6LesB5ItAAAAANgMoNFS5ZPKfdgAyePbLCkNE20X", { action: "contact" })
          .then(function (token) {
            onContactVerified(token);
          })
          .catch(function (err) {
            console.error("Error ejecutando reCAPTCHA:", err);
            showRecaptchaExecuteError("contact");
          })
          .finally(function () {
            _contactoEnviando = false;
            btn.disabled = false;
            btn.textContent = textoOriginal;
          });
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", wireRecaptchaButtons);

// Verifica un token contra el servidor. Devuelve { success, score }.
async function verifyRecaptchaToken(token, action) {
  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, expectedAction: action }),
    });
    if (!res.ok) return { success: false, score: 0 };
    return await res.json();
  } catch (e) {
    console.warn("No se pudo verificar reCAPTCHA:", e.message);
    // Si el servidor de verificación no responde, dejamos pasar para no
    // bloquear el sitio por un problema de red. Cambia esto a `false`
    // si prefieres bloquear ante cualquier falla de verificación.
    return { success: true, score: null, offline: true };
  }
}

// Cada acción recibe el token y lo pasa a la función correspondiente,
// que a su vez llama a verifyRecaptchaToken() antes de continuar. Mientras
// el proyecto esté en el plan Spark (sin functions desplegadas), esa
// verificación falla en red y deja pasar la acción para no romper el
// sitio; en cuanto despliegues functions/index.js con el plan Blaze, la
// verificación real del servidor entra en efecto sin tocar nada más.
async function onContactVerified(token) {
  sendContactMsg(token);
}

async function onRegisterVerified(token) {
  doClientRegister(token);
}

async function onAdminLoginVerified(token) {
  doLogin(token);
}

// Muestra un aviso simple cuando la verificación falla (puntaje bajo / bot detectado)
function rejectRecaptcha(action) {
  console.warn(`Verificación de reCAPTCHA falló para la acción: ${action}`);
  if (typeof toast === "function") {
    toast("No pudimos verificar que eres una persona. Intenta de nuevo.");
  } else {
    alert("No pudimos verificar que eres una persona. Intenta de nuevo.");
  }
  if (typeof grecaptcha !== "undefined" && grecaptcha.enterprise && grecaptcha.enterprise.reset) {
    grecaptcha.enterprise.reset();
  }
}

/*
  CÓMO DESPLEGAR LA VERIFICACIÓN DEL SERVIDOR (functions/index.js):

  1. Necesitas el plan Blaze de Firebase (tiene capa gratuita amplia,
     no se cobra si no superas el uso gratuito).

  2. Crea una API key en Google Cloud restringida a la API
     "reCAPTCHA Enterprise API" (Fraud Defense):
     Google Cloud Console > APIs y servicios > Credenciales > Crear credencial > Clave de API
     Luego en "Restricciones de la API" elige solo "reCAPTCHA Enterprise API".

  3. Desde la carpeta del proyecto, en una terminal con Firebase CLI instalado:
       firebase functions:secrets:set RECAPTCHA_API_KEY
     (pega ahí la API key que creaste en el paso 2)

  4. Despliega la función:
       firebase deploy --only functions

  5. Copia la URL que te muestra la terminal (algo como
     https://us-central1-lashkainsumos-e03dc.cloudfunctions.net/verifyRecaptcha)
     y pégala arriba en RECAPTCHA_VERIFY_URL si es distinta.
*/
