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

const STATUSES = ["ONGOING", "COMPLETED", "REJECTED"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const RESOURCE_NAMES = ["Ambulance", "RescueTeam", "FireTruck", "PoliceUnit", "Crane", "MedicalTeam"];
// "present" = still being handled, "past" = closed
const SCOPE_STATUSES = { present: ["ONGOING"], past: ["COMPLETED", "REJECTED"] };

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
/* 1. Resources (Supabase table "resources") - full CRUD               */
/* ------------------------------------------------------------------ */
const RESOURCE_COLUMNS = "id, name, count, description, created_at, updated_at";
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const escapeLike = (v) => v.replace(/[\\%_]/g, "\\$&");

// Adds the right filter: a UUID matches by id, anything else matches the name (case-insensitive)
const byIdOrName = (query, idOrName) =>
  isUuid(idOrName) ? query.eq("id", idOrName) : query.ilike("name", escapeLike(idOrName));

// Used by incident detection: [{ name, count }]
async function getAvailableResources() {
  const { data, error } = await supabase.from("resources").select("name, count");
  if (error) throw new Error(`Supabase resources query failed: ${error.message}`);
  return data;
}

// Names the AI is allowed to request and incidents may reference (falls back to the defaults)
async function getResourceNames() {
  try {
    const { data, error } = await supabase.from("resources").select("name").order("name");
    if (error || !data.length) return RESOURCE_NAMES;
    return data.map((r) => r.name);
  } catch {
    return RESOURCE_NAMES;
  }
}

// Validates a create (partial: false) or update (partial: true) body
function parseResourceBody(body, { partial }) {
  const values = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 50) {
      return { error: "name must be a non-empty string (max 50 characters)" };
    }
    if (/[\/\\?#%]/.test(body.name)) {
      return { error: "name cannot contain / \\ ? # or %" };
    }
    values.name = body.name.trim();
  } else if (!partial) {
    return { error: "name is required" };
  }

  if (body.count !== undefined) {
    const count = typeof body.count === "string" && body.count.trim() !== "" ? Number(body.count) : body.count;
    if (!Number.isInteger(count) || count < 0) {
      return { error: "count must be a non-negative integer" };
    }
    values.count = count;
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      return { error: "description must be a string" };
    }
    values.description = body.description ? body.description.trim() : null;
  }

  return { values };
}

// GET /api/resources            (optional ?search=amb)
app.get("/api/resources", asyncHandler(async (req, res) => {
  let query = supabase.from("resources").select(RESOURCE_COLUMNS).order("name");
  if (req.query.search) query = query.ilike("name", `%${escapeLike(String(req.query.search))}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  res.json(data);
}));

// GET /api/resources/:idOrName
app.get("/api/resources/:idOrName", asyncHandler(async (req, res) => {
  const { data, error } = await byIdOrName(
    supabase.from("resources").select(RESOURCE_COLUMNS),
    req.params.idOrName
  ).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: "Resource not found" });
  res.json(data);
}));

// POST /api/resources   { "name": "Helicopter", "count": 2, "description": "Air rescue" }
app.post("/api/resources", asyncHandler(async (req, res) => {
  const { values, error: bodyError } = parseResourceBody(req.body || {}, { partial: false });
  if (bodyError) return res.status(400).json({ error: bodyError });

  const { data, error } = await supabase
    .from("resources")
    .insert({ count: 0, ...values })
    .select(RESOURCE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: `Resource "${values.name}" already exists` });
    throw new Error(error.message);
  }
  res.status(201).json(data);
}));

// PUT /api/resources/:idOrName   { "count": 5 }  (any of name, count, description)
app.put("/api/resources/:idOrName", asyncHandler(async (req, res) => {
  const { values, error: bodyError } = parseResourceBody(req.body || {}, { partial: true });
  if (bodyError) return res.status(400).json({ error: bodyError });
  if (Object.keys(values).length === 0) {
    return res.status(400).json({ error: "Send at least one of: name, count, description" });
  }

  const { data, error } = await byIdOrName(
    supabase.from("resources").update({ ...values, updated_at: new Date().toISOString() }),
    req.params.idOrName
  )
    .select(RESOURCE_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: `Resource "${values.name}" already exists` });
    throw new Error(error.message);
  }
  if (!data) return res.status(404).json({ error: "Resource not found" });
  res.json(data);
}));

// DELETE /api/resources/:idOrName
app.delete("/api/resources/:idOrName", asyncHandler(async (req, res) => {
  const { data, error } = await byIdOrName(supabase.from("resources").delete(), req.params.idOrName)
    .select(RESOURCE_COLUMNS);
  if (error) throw new Error(error.message);
  if (!data.length) return res.status(404).json({ error: "Resource not found" });
  res.json({ message: `Resource "${data[0].name}" deleted`, deleted: data[0] });
}));

/* ------------------------------------------------------------------ */
/* 2. Analyse the image with Gemini (structured JSON output)           */
/* ------------------------------------------------------------------ */
// Built per request so resources you add through the API are available to the AI immediately
const buildIncidentSchema = (resourceNames) => ({
  type: "OBJECT",
  properties: {
    incident_detected: { type: "BOOLEAN" },
    incident_name: { type: "STRING" },
    priority: { type: "STRING", enum: PRIORITIES },
    people_injured: { type: "INTEGER" },
    resources_needed: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", enum: resourceNames },
          quantity: { type: "INTEGER" },
        },
        required: ["name", "quantity"],
      },
    },
  },
  required: ["incident_detected", "incident_name", "priority", "people_injured", "resources_needed"],
});

async function analyseImage(buffer, mimeType, resourceNames) {
  const prompt =
    "You are an emergency response analyst. Examine this image, identify any incident " +
    "(e.g. Accident, Fire, Flood, Building Collapse, Medical Emergency), estimate how many " +
    "people are visibly injured, set a priority, and list the emergency resources with " +
    "quantities needed to respond. If no incident is visible, set incident_detected to false, " +
    "incident_name to 'None', people_injured to 0 and resources_needed to an empty array.";

  const text = await callGemini(
    [{ inline_data: { mime_type: mimeType, data: buffer.toString("base64") } }, { text: prompt }],
    { responseMimeType: "application/json", responseSchema: buildIncidentSchema(resourceNames), temperature: 0.2 }
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
      resource_names: result["Resources needed"].map((r) => r.Name),
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
  if (!row.image_path) {
    return { ...row, image_url: null };
  }
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

    const available = await getAvailableResources();
    const resourceNames = available.length ? available.map((r) => r.name) : RESOURCE_NAMES;
    const incident = await analyseImage(req.file.buffer, req.file.mimetype, resourceNames);

    if (!incident.incident_detected) {
      return res.json({
        IncidentName: "No incident detected",
        "Incident priority": "None",
        "People Injuered": 0,
        "Resources needed": [],
      });
    }

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

// GET /api/incidents
//   ?scope=present|past            present = ONGOING, past = COMPLETED + REJECTED
//   &status=ONGOING,COMPLETED      comma-separated, any of ONGOING | COMPLETED | REJECTED
//   &priority=High,Critical        comma-separated, any of Low | Medium | High | Critical
//   &resource=Ambulance,Crane      incidents that need ANY of these (add &resource_match=all for ALL)
//   &from=2026-09-01&to=2026-09-30 created date range
//   &page=1&limit=20
const parseList = (v) => (v ? String(v).split(",").map((x) => x.trim()).filter(Boolean) : []);
const matchCase = (value, options) => options.find((o) => o.toLowerCase() === value.toLowerCase());

app.get("/api/incidents", asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  // --- scope + status ---
  const scope = String(req.query.scope || "").toLowerCase();
  if (scope && !SCOPE_STATUSES[scope]) {
    return res.status(400).json({ error: 'scope must be "present" or "past"' });
  }
  let statuses = parseList(req.query.status).map((x) => x.toUpperCase());
  const badStatus = statuses.filter((x) => !STATUSES.includes(x));
  if (badStatus.length) {
    return res.status(400).json({ error: `Invalid status: ${badStatus.join(", ")}. Use ${STATUSES.join(", ")}` });
  }
  const hasStatusFilter = Boolean(scope || statuses.length);
  if (scope) {
    const allowed = SCOPE_STATUSES[scope];
    statuses = statuses.length ? statuses.filter((x) => allowed.includes(x)) : allowed;
  }

  // --- priority ---
  const priorities = parseList(req.query.priority).map((p) => matchCase(p, PRIORITIES));
  if (priorities.includes(undefined)) {
    return res.status(400).json({ error: `Invalid priority. Use ${PRIORITIES.join(", ")}` });
  }

  // --- resources ---
  const knownNames = await getResourceNames();
  const resources = parseList(req.query.resource).map((r) => matchCase(r, knownNames) || r);

  // --- dates ---
  const { from, to } = req.query;
  if ((from && isNaN(Date.parse(from))) || (to && isNaN(Date.parse(to)))) {
    return res.status(400).json({ error: "from/to must be valid dates, e.g. 2026-09-30" });
  }

  // e.g. scope=past&status=ONGOING -> nothing can match
  if (hasStatusFilter && statuses.length === 0) {
    return res.json({ page, limit, total: 0, data: [] });
  }

  let query = supabase.from("incidents").select("*", { count: "exact" });
  if (hasStatusFilter) query = query.in("status", statuses);
  if (priorities.length) query = query.in("priority", priorities);
  if (resources.length) {
    query = String(req.query.resource_match).toLowerCase() === "all"
      ? query.contains("resource_names", resources)
      : query.overlaps("resource_names", resources);
  }
  if (from) query = query.gte("created_at", new Date(from).toISOString());
  if (to) {
    const end = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCHours(23, 59, 59, 999); // include the whole end day
    query = query.lte("created_at", end.toISOString());
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) throw new Error(error.message);

  res.json({ page, limit, total: count, data: await Promise.all(data.map(withSignedUrl)) });
}));

// Helper: Get allocated resources for an incident
async function getAllocatedResourcesForIncident(incidentId) {
  const { data, error } = await supabase
    .from("incident_resource_allocations")
    .select("resource_id, quantity")
    .eq("incident_id", incidentId);
  if (error) throw new Error(error.message);
  return data || [];
}

// Helper: Release all resources allocated to an incident
async function releaseIncidentResources(incidentId) {
  const allocations = await getAllocatedResourcesForIncident(incidentId);

  for (const alloc of allocations) {
    const { data: resource, error: fetchErr } = await supabase
      .from("resources")
      .select("count")
      .eq("id", alloc.resource_id)
      .maybeSingle();

    if (fetchErr || !resource) continue;

    // Restore the allocated quantity
    const { error: updateErr } = await supabase
      .from("resources")
      .update({ count: resource.count + alloc.quantity })
      .eq("id", alloc.resource_id);

    if (updateErr) throw new Error(updateErr.message);
  }

  // Delete all allocations for this incident
  const { error: deleteErr } = await supabase
    .from("incident_resource_allocations")
    .delete()
    .eq("incident_id", incidentId);

  if (deleteErr) throw new Error(deleteErr.message);
}

// PATCH /api/incidents/:id/status   { "status": "COMPLETED" }
app.patch("/api/incidents/:id/status", asyncHandler(async (req, res) => {
  const status = String(req.body.status || "").toUpperCase();
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }

  // If marking as COMPLETED or REJECTED, release resources
  if ((status === "COMPLETED" || status === "REJECTED")) {
    try {
      await releaseIncidentResources(req.params.id);
    } catch (err) {
      console.error("Error releasing resources:", err);
      return res.status(500).json({ error: `Failed to release resources: ${err.message}` });
    }
  }

  const { data, error } = await supabase
    .from("incidents")
    .update({ status, closed_at: status === "ONGOING" ? null : new Date().toISOString() })
    .eq("id", req.params.id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: "Incident not found" });
  res.json(await withSignedUrl(data));
}));

// GET /api/incidents/:id
app.get("/api/incidents/:id", asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("incidents").select("*").eq("id", req.params.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: "Incident not found" });

  // Fetch allocated resources
  const { data: allocations, error: allocError } = await supabase
    .from("incident_resource_allocations")
    .select("resource_id, quantity, created_at")
    .eq("incident_id", req.params.id);

  if (allocError) throw new Error(allocError.message);

  // Fetch resource details for allocated resources
  const resourceIds = allocations.map(a => a.resource_id);
  let resourceDetails = [];
  if (resourceIds.length > 0) {
    const { data: resources, error: resourceError } = await supabase
      .from("resources")
      .select("id, name")
      .in("id", resourceIds);
    if (resourceError) throw new Error(resourceError.message);
    resourceDetails = resources || [];
  }

  // Map allocations to include resource names
  const allocatedResources = allocations.map(alloc => {
    const resource = resourceDetails.find(r => r.id === alloc.resource_id);
    return {
      resource_id: alloc.resource_id,
      resource_name: resource?.name || "Unknown",
      quantity: alloc.quantity,
      allocated_at: alloc.created_at
    };
  });

  res.json({ ...await withSignedUrl(data), allocated_resources: allocatedResources });
}));

// POST /api/incidents - manually create an incident
app.post("/api/incidents", asyncHandler(async (req, res) => {
  const { incidentname, Priority, Peopple_Injuered, Resourcesneeded, Resource_Shortage, Alert_message } = req.body;

  // Validate required fields
  if (!incidentname || typeof incidentname !== "string" || !incidentname.trim()) {
    return res.status(400).json({ error: "incidentname is required and must be a non-empty string" });
  }
  if (!Priority || !PRIORITIES.includes(Priority)) {
    return res.status(400).json({ error: `Priority is required and must be one of: ${PRIORITIES.join(", ")}` });
  }
  if (typeof Peopple_Injuered !== "number" || Peopple_Injuered < 0) {
    return res.status(400).json({ error: "Peopple_Injuered must be a non-negative number" });
  }
  if (!Array.isArray(Resourcesneeded)) {
    return res.status(400).json({ error: "Resourcesneeded must be an array" });
  }

  // Validate Resourcesneeded array against the resources table
  const resourceNames = await getResourceNames();
  for (const resource of Resourcesneeded) {
    if (!resource.Name || !resourceNames.includes(resource.Name)) {
      return res.status(400).json({ error: `Invalid resource name: ${resource.Name}. Must be one of: ${resourceNames.join(", ")}` });
    }
    if (typeof resource.Quantity !== "number" || resource.Quantity < 1) {
      return res.status(400).json({ error: `Resource ${resource.Name} Quantity must be a positive number` });
    }
  }

  // Validate Resource_Shortage if provided
  if (Resource_Shortage !== undefined && Resource_Shortage !== null) {
    if (!Array.isArray(Resource_Shortage)) {
      return res.status(400).json({ error: "Resource_Shortage must be an array" });
    }
    for (const shortage of Resource_Shortage) {
      if (typeof shortage.Short !== "number" || shortage.Short < 0) {
        return res.status(400).json({ error: `Resource shortage Short value must be a non-negative number` });
      }
    }
  }

  // Insert incident into database
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      incident_name: incidentname.trim(),
      priority: Priority,
      people_injured: Peopple_Injuered,
      resources_needed: Resourcesneeded,
      resource_names: Resourcesneeded.map((r) => r.Name),
      resource_shortage: Resource_Shortage && Resource_Shortage.length > 0 ? Resource_Shortage : null,
      alert_message: Alert_message || null,
      status: "ONGOING",
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create incident: ${error.message}`);
  res.status(201).json(await withSignedUrl(data));
}));

/* ------------------------------------------------------------------ */
/* Resource Allocation Endpoints                                      */
/* ------------------------------------------------------------------ */

// POST /api/incidents/:id/allocate-resources
//   { "resources": [{ "resource_id": "abc123", "quantity": 2 }, ...] }
app.post("/api/incidents/:id/allocate-resources", asyncHandler(async (req, res) => {
  const incidentId = req.params.id;
  const { resources } = req.body;

  // Validate incident exists
  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .select("id, status")
    .eq("id", incidentId)
    .maybeSingle();

  if (incidentError) throw new Error(incidentError.message);
  if (!incident) return res.status(404).json({ error: "Incident not found" });

  // Only allow allocation to ONGOING incidents
  if (incident.status !== "ONGOING") {
    return res.status(400).json({ error: `Cannot allocate resources to ${incident.status} incident` });
  }

  // Validate resources array
  if (!Array.isArray(resources) || resources.length === 0) {
    return res.status(400).json({ error: "resources must be a non-empty array" });
  }

  for (const r of resources) {
    if (!r.resource_id || typeof r.quantity !== "number" || r.quantity < 1) {
      return res.status(400).json({ error: "Each resource must have resource_id and positive quantity" });
    }
  }

  // Check if resources already allocated to this incident
  const { data: existing, error: existingError } = await supabase
    .from("incident_resource_allocations")
    .select("resource_id")
    .eq("incident_id", incidentId);

  if (existingError) throw new Error(existingError.message);
  const existingIds = new Set(existing.map(e => e.resource_id));

  for (const alloc of resources) {
    if (existingIds.has(alloc.resource_id)) {
      return res.status(409).json({ error: `Resource ${alloc.resource_id} is already allocated to this incident` });
    }

    // Check resource exists and has sufficient quantity
    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("id, count, name")
      .eq("id", alloc.resource_id)
      .maybeSingle();

    if (resourceError) throw new Error(resourceError.message);
    if (!resource) {
      return res.status(404).json({ error: `Resource ${alloc.resource_id} not found` });
    }

    if (resource.count < alloc.quantity) {
      return res.status(400).json({
        error: `Insufficient ${resource.name} available. Required: ${alloc.quantity}, Available: ${resource.count}`
      });
    }

    // Reduce resource quantity
    const { error: updateError } = await supabase
      .from("resources")
      .update({ count: resource.count - alloc.quantity })
      .eq("id", alloc.resource_id);

    if (updateError) throw new Error(updateError.message);

    // Record the allocation
    const { error: allocError } = await supabase
      .from("incident_resource_allocations")
      .insert({
        incident_id: incidentId,
        resource_id: alloc.resource_id,
        quantity: alloc.quantity
      });

    if (allocError) throw new Error(allocError.message);
  }

  const allocations = await getAllocatedResourcesForIncident(incidentId);
  res.status(201).json({
    message: "Resources allocated successfully",
    incident_id: incidentId,
    allocated_resources: allocations
  });
}));

// DELETE /api/incidents/:id/deallocate-resources/:resource_id
app.delete("/api/incidents/:id/deallocate-resources/:resource_id", asyncHandler(async (req, res) => {
  const { id: incidentId, resource_id: resourceId } = req.params;

  // Get the allocation
  const { data: allocation, error: allocError } = await supabase
    .from("incident_resource_allocations")
    .select("quantity")
    .eq("incident_id", incidentId)
    .eq("resource_id", resourceId)
    .maybeSingle();

  if (allocError) throw new Error(allocError.message);
  if (!allocation) {
    return res.status(404).json({ error: "Resource allocation not found for this incident" });
  }

  // Restore the resource quantity
  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .select("count")
    .eq("id", resourceId)
    .maybeSingle();

  if (resourceError) throw new Error(resourceError.message);
  if (!resource) return res.status(404).json({ error: "Resource not found" });

  const { error: updateError } = await supabase
    .from("resources")
    .update({ count: resource.count + allocation.quantity })
    .eq("id", resourceId);

  if (updateError) throw new Error(updateError.message);

  // Delete the allocation
  const { error: deleteError } = await supabase
    .from("incident_resource_allocations")
    .delete()
    .eq("incident_id", incidentId)
    .eq("resource_id", resourceId);

  if (deleteError) throw new Error(deleteError.message);

  res.json({ message: "Resource deallocated successfully", incident_id: incidentId, resource_id: resourceId });
}));

// GET /api/incidents/:id/allocations
app.get("/api/incidents/:id/allocations", asyncHandler(async (req, res) => {
  const { data: allocations, error } = await supabase
    .from("incident_resource_allocations")
    .select("resource_id, quantity, created_at")
    .eq("incident_id", req.params.id);

  if (error) throw new Error(error.message);

  // Fetch resource names
  const resourceIds = allocations.map(a => a.resource_id);
  let resourceMap = {};
  if (resourceIds.length > 0) {
    const { data: resources, error: resourceError } = await supabase
      .from("resources")
      .select("id, name")
      .in("id", resourceIds);
    if (resourceError) throw new Error(resourceError.message);
    resourceMap = Object.fromEntries(resources.map(r => [r.id, r.name]));
  }

  const result = allocations.map(a => ({
    resource_id: a.resource_id,
    resource_name: resourceMap[a.resource_id] || "Unknown",
    quantity: a.quantity,
    allocated_at: a.created_at
  }));

  res.json(result);
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