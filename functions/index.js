// ============================================================================
// verifyRecaptcha — Cloud Function que valida los tokens de reCAPTCHA
// Enterprise (Fraud Defense) del lado del servidor.
//
// Esto es exactamente el paso que muestra la consola de Google Cloud en
// "Fraud Defense > Detalles de la clave > Integración > API de REST":
//
//   1. Arma el cuerpo { event: { token, expectedAction, siteKey } }
//   2. Hace un POST a
//      https://recaptchaenterprise.googleapis.com/v1/projects/{PROJECT}/assessments?key=API_KEY
//   3. Lee el score/veredicto de la respuesta y decide si permite la acción.
//
// El API_KEY NUNCA se expone al navegador: vive solo aquí, en el servidor,
// guardado como "secret" de Firebase (ver instrucciones de despliegue).
// ============================================================================

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

// Secret que guarda la API key del proyecto (se crea con `firebase functions:secrets:set`)
const RECAPTCHA_API_KEY = defineSecret("RECAPTCHA_API_KEY");

// --- Datos fijos del proyecto (los mismos que ves en la consola) ---
const PROJECT_ID = "lashkainsumos-e03dc";
const SITE_KEY = "6LesB5ItAAAAANgMoNFS5ZPKfdgAyePbLCkNE20X";

// Puntaje mínimo para considerar la acción legítima (0.0 = seguro que es bot, 1.0 = seguro que es humano)
const SCORE_THRESHOLD = 0.5;

// Dominios permitidos a llamar esta función (ajusta si tu dominio final es otro)
const ALLOWED_ORIGINS = [
  "https://lashkainsumos-e03dc.web.app",
  "https://lashkainsumos-e03dc.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5500",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

exports.verifyRecaptcha = onRequest(
  { secrets: [RECAPTCHA_API_KEY], region: "us-central1", cors: true },
  async (req, res) => {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    const { token, expectedAction } = req.body || {};

    if (!token || !expectedAction) {
      res.status(400).json({ error: "Falta token o expectedAction" });
      return;
    }

    try {
      // ---- Paso 1: arma el cuerpo de la solicitud (request.json) ----
      const requestBody = {
        event: {
          token: token,
          expectedAction: expectedAction,
          siteKey: SITE_KEY,
        },
      };

      // ---- Paso 2: llama a la API de reCAPTCHA Enterprise ----
      const apiKey = RECAPTCHA_API_KEY.value();
      const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments?key=${apiKey}`;

      const apiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await apiRes.json();

      if (!apiRes.ok) {
        logger.error("Error de la API de reCAPTCHA Enterprise:", data);
        res.status(502).json({ error: "No se pudo verificar el token" });
        return;
      }

      // ---- Paso 3: revisa el veredicto ----
      const tokenValid = data?.tokenProperties?.valid === true;
      const actionMatches = data?.tokenProperties?.action === expectedAction;
      const score = typeof data?.riskAnalysis?.score === "number" ? data.riskAnalysis.score : 0;

      const success = tokenValid && actionMatches && score >= SCORE_THRESHOLD;

      if (!tokenValid) {
        logger.warn("Token inválido:", data?.tokenProperties?.invalidReason);
      }

      res.status(200).json({
        success,
        score,
        reasons: data?.riskAnalysis?.reasons || [],
      });
    } catch (err) {
      logger.error("Error verificando reCAPTCHA:", err);
      res.status(500).json({ error: "Error interno al verificar el token" });
    }
  }
);
