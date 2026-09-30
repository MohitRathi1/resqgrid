require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Comma-separated list. The first is tried first; the rest are fallbacks if it is busy/unavailable.
const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const RETRIES_PER_MODEL = 2; // extra attempts on the same model before moving to the next
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Supabase (server-side only: the service role key bypasses RLS, never expose it to a frontend)
const BUCKET = process.env.SUPABASE_BUCKET || "incident-images";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------------------------------------------ */
/* Gemini helper                                                       */
/* ------------------------------------------------------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGeminiOnce(model, parts, generationConfig) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts }], generationConfig }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error?.message || `Gemini API error (${r.status})`);
    err.status = r.status;
    throw err;
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

// Retries busy/rate-limit errors with backoff, then falls back to the next model
async function callGemini(parts, generationConfig = {}) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in .env");

  let lastError;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        return await callGeminiOnce(model, parts, generationConfig);
      } catch (err) {
        lastError = err;
        const busy = err.status === 503 || err.status === 429 || err.status === 500;
        const modelUnavailable = err.status === 404 || err.status === 403;
        console.warn(`[Gemini] ${model} attempt ${attempt + 1} failed (${err.status || "n/a"}): ${err.message}`);

        if (modelUnavailable) break; // skip straight to the next model
        if (!busy) throw err; // bad request etc. - retrying won't help
        if (attempt < RETRIES_PER_MODEL) await sleep(1000 * 2 ** attempt); // 1s, 2s
      }
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ */
/* 1. Resources stored in Supabase                                     */
/* ------------------------------------------------------------------ */
async function getAvailableResources() {
  const { data, error } = await supabase.from("resources").select("name, count");
  if (error) throw new Error(`Supabase resources query failed: ${error.message}`);
  return data; // [{ name, count }]
}

app.get("/api/resources", asyncHandler(async (req, res) => {
  res.json(await getAvailableResources());
}));

// Create or update stock: PUT /api/resources/Ambulance  { "count": 5 }
app.put("/api/resources/:name", asyncHandler(async (req, res) => {
  const count = Number(req.body.count);
  if (!Number.isInteger(count) || count < 0) {
    return res.status(400).json({ error: "count must be a non-negative integer" });
  }
  const { data, error } = await supabase
    .from("resources")
    .upsert({ name: req.params.name, count, updated_at: new Date().toISOString() }, { onConflict: "name" })
    .select("name, count")
    .single();
  if (error) throw new Error(error.message);
  res.json(data);
}));

/* ------------------------------------------------------------------ */
/* 2. Analyse the image with Gemini (structured JSON output)           */
/* ------------------------------------------------------------------ */
const incidentSchema = {
  type: "OBJECT",
  properties: {
    incident_detected: { type: "BOOLEAN" },
    incident_name: { type: "STRING" },
    priority: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] },
    people_injured: { type: "INTEGER" },
    resources_needed: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: {
            type: "STRING",
            enum: ["Ambulance", "RescueTeam", "FireTruck", "PoliceUnit", "Crane", "MedicalTeam"],
          },
          quantity: { type: "INTEGER" },
        },
        required: ["name", "quantity"],
      },
    },
  },
  required: ["incident_detected", "incident_name", "priority", "people_injured", "resources_needed"],
};

async function analyseImage(buffer, mimeType) {
  const prompt =
    "You are an emergency response analyst. Examine this image, identify any incident " +
    "(e.g. Accident, Fire, Flood, Building Collapse, Medical Emergency), estimate how many " +
    "people are visibly injured, set a priority, and list the emergency resources with " +
    "quantities needed to respond. If no incident is visible, set incident_detected to false, " +
    "incident_name to 'None', people_injured to 0 and resources_needed to an empty array.";

  const text = await callGemini(
    [{ inline_data: { mime_type: mimeType, data: buffer.toString("base64") } }, { text: prompt }],
    { responseMimeType: "application/json", responseSchema: incidentSchema, temperature: 0.2 }
  );

  return JSON.parse(text);
}

/* ------------------------------------------------------------------ */
/* 3. Compare needed vs available, generate AI message on shortage     */
/* ------------------------------------------------------------------ */
function findShortages(needed, available) {
  const stock = new Map(available.map((r) => [r.name.toLowerCase(), r.count]));
  return needed
    .map((r) => {
      const have = stock.get(r.name.toLowerCase()) ?? 0;
      return { Name: r.name, Required: r.quantity, Available: have, Short: Math.max(0, r.quantity - have) };
    })
    .filter((r) => r.Short > 0);
}

async function generateShortageMessage(incident, shortages) {
  const prompt =
    "Write a short, urgent alert (max 3 sentences) for the emergency control room. " +
    "Plain text only, no markdown.\n\n" +
    `Incident: ${incident.incident_name}\nPriority: ${incident.priority}\n` +
    `People injured: ${incident.people_injured}\n` +
    `Resource shortages: ${JSON.stringify(shortages)}\n\n` +
    "State which resources are short and recommend requesting mutual aid or nearby stations immediately.";

  try {
    return (await callGemini([{ text: prompt }], { temperature: 0.4 })).trim();
  } catch (e) {
    // Fallback so the API still responds if the AI message fails (e.g. rate limit)
    const list = shortages.map((s) => `${s.Short} ${s.Name}`).join(", ");
    return `Resource shortage for ${incident.incident_name} (${incident.priority} priority): short by ${list}. Request mutual aid from nearby stations immediately.`;
  }
}

/* ------------------------------------------------------------------ */
/* 4. Save incident (image -> Storage, data -> table)                  */
/* ------------------------------------------------------------------ */
async function saveIncident(file, incident, result, shortages) {
  const ext = file.mimetype.split("/")[1];
  const imagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

  const up = await supabase.storage.from(BUCKET).upload(imagePath, file.buffer, { contentType: file.mimetype });
  if (up.error) throw new Error(`Image upload failed: ${up.error.message}`);

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      incident_name: incident.incident_name,
      priority: incident.priority,
      people_injured: incident.people_injured,
      resources_needed: result["Resources needed"],
      resource_shortage: shortages.length ? shortages : null,
      alert_message: result["Alert message"] || null,
      image_path: imagePath,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Incident insert failed: ${error.message}`);
  return data.id;
}

async function withSignedUrl(row) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.image_path, 3600); // 1 hour
  return { ...row, image_url: data?.signedUrl || null };
}

/* ------------------------------------------------------------------ */
/* 5. Main endpoint + incident history                                 */
/* ------------------------------------------------------------------ */
app.post("/api/detect-incident", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Send an image in form-data field "image"' });
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Only JPEG, PNG, GIF or WEBP images are supported" });
    }

    const incident = await analyseImage(req.file.buffer, req.file.mimetype);

    if (!incident.incident_detected) {
      return res.json({
        IncidentName: "No incident detected",
        "Incident priority": "None",
        "People Injuered": 0,
        "Resources needed": [],
      });
    }

    const available = await getAvailableResources();
    const shortages = findShortages(incident.resources_needed, available);

    const result = {
      IncidentName: incident.incident_name,
      "Incident priority": incident.priority,
      "People Injuered": incident.people_injured,
      "Resources needed": incident.resources_needed.map((r) => ({
        Name: r.name,
        Quantity: r.quantity,
      })),
    };

    if (shortages.length > 0) {
      result["Resource shortage"] = shortages;
      result["Alert message"] = await generateShortageMessage(incident, shortages);
    }

    // Saving must not lose the AI result if the database is down
    try {
      result["Incident ID"] = await saveIncident(req.file, incident, result, shortages);
    } catch (saveErr) {
      console.error(saveErr);
      result["Warning"] = "Incident detected but could not be saved to the database";
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    if (err.status === 429 || err.status === 503) {
      return res.status(503).json({ error: "AI service is busy or rate-limited right now. Please try again in a minute." });
    }
    res.status(500).json({ error: "Failed to process image", details: err.message });
  }
});

// GET /api/incidents?limit=20
app.get("/api/incidents", asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  res.json(await Promise.all(data.map(withSignedUrl)));
}));

// GET /api/incidents/:id
app.get("/api/incidents/:id", asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("incidents").select("*").eq("id", req.params.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: "Incident not found" });
  res.json(await withSignedUrl(data));
}));

/* ------------------------------------------------------------------ */
/* 6. Error handler for upload errors (wrong field name, size, etc.)   */
/* ------------------------------------------------------------------ */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_UNEXPECTED_FILE"
        ? 'Wrong field name. Send the file under the key "image".'
        : err.message;
    return res.status(400).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

/* ------------------------------------------------------------------ */
/* 7. Supabase connection check (runs at startup + /api/health)        */
/* ------------------------------------------------------------------ */
async function checkSupabaseConnection() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { connected: false, message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env" };
  }

  const db = await supabase.from("resources").select("*", { count: "exact", head: true });
  if (db.error) {
    return { connected: false, message: `Database check failed: ${db.error.message} (did you run schema.sql?)` };
  }

  const bucket = await supabase.storage.getBucket(BUCKET);
  if (bucket.error) {
    return { connected: false, message: `Storage bucket "${BUCKET}" not found: ${bucket.error.message}` };
  }

  return { connected: true, message: `Database OK (${db.count} resources), storage bucket "${BUCKET}" OK` };
}

app.get("/api/health", asyncHandler(async (req, res) => {
  const supa = await checkSupabaseConnection();
  res.status(supa.connected ? 200 : 503).json({ server: "ok", supabase: supa });
}));

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    const supa = await checkSupabaseConnection();
    console.log(supa.connected ? `✅ Supabase connected: ${supa.message}` : `❌ Supabase NOT connected: ${supa.message}`);
  } catch (err) {
    console.log(`❌ Supabase NOT connected: ${err.message}`);
  }
});


