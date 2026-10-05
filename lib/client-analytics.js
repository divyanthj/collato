// Only categorical, non-identifying properties belong in product analytics.
// Add new values deliberately; unknown keys/values never leave the browser.
const METADATA_VALUES = {
  cohort: ["unknown", "anonymous", "internal_pilot", "external"],
  source: ["unknown", "landing_header", "landing_hero", "custom_sign_in", "dashboard_sidebar", "hero_panel", "auth_redirect", "dashboard_session", "access_gateway", "marketing_pricing", "create_organization", "organization_billing", "workspace_create", "file_upload", "typed_note", "voice_note", "sharepoint_import", "task_board", "update_suggestion", "knowledge_suggestion", "knowledge_hub", "evidence", "updates", "report", "chat"],
  method: ["google", "email_magic_link"],
  input_method: ["typed", "voice", "file_upload", "sharepoint_import"],
  interval: ["month", "year"],
  mode: ["new_subscription", "upgrade_quantity", "switch_plan", "migrate"],
  requires_checkout: ["yes", "no"],
  has_invites: ["yes", "no"],
  has_description: ["yes", "no"],
  has_assignee: ["yes", "no"],
  has_due_date: ["yes", "no"],
  has_attachments: ["yes", "no"],
  has_sources: ["yes", "no"],
  scope: ["organization", "workspace", "file", "update"],
  role: ["admin", "member"],
  action: ["accept", "reject", "create", "update", "remove"],
  status: ["open", "in_progress", "done", "active", "hidden", "suppressed", "archived", "insufficient_context", "partial_context", "ready", "complete"],
  field: ["status", "assignee", "due_date"],
  stage: ["checkout", "organization", "workspace", "capture", "save", "summary", "generate", "stream", "invite", "connect", "disconnect", "import", "privacy", "task"],
  failure_category: ["unauthorized", "forbidden", "not_found", "conflict", "rate_limited", "invalid_request", "server_error", "invalid_response", "network_or_client"],
  integration: ["sharepoint"],
  ai_private: ["yes", "no"],
  format: ["pdf", "docx", "html", "json", "csv"],
  section: ["evidence", "hub", "knowledge", "updates", "tasks", "chat", "report"],
  template_id: ["default-progress", "collato-monthly-report"],
  file_type: ["pdf", "document", "spreadsheet", "image", "audio", "text", "sharepoint", "other", "unknown"],
  channel: ["update"],
  quantity: ["0", "1", "2-5", "6-20", "21+"],
  item_count: ["0", "1", "2-5", "6-20", "21+"],
  failed_count: ["0", "1", "2-5", "6-20", "21+"],
  source_count: ["0", "1", "2-5", "6-20", "21+"],
  question_length: ["short", "medium", "long"]
};

export function analyticsCountBucket(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count === 0) return "0";
  if (count <= 1) return "1";
  if (count <= 5) return "2-5";
  if (count <= 20) return "6-20";
  return "21+";
}

export function analyticsHttpFailure(status) {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (status >= 400) return "invalid_request";
  if (status >= 200 && status < 300) return "invalid_response";
  return "network_or_client";
}

export function analyticsFileType(value) {
  const type = String(value || "").toLowerCase();
  if (!type) return "unknown";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("word") || type.includes("document") || type === "docx") return "document";
  if (type.includes("sheet") || type.includes("excel") || type === "csv" || type === "xlsx") return "spreadsheet";
  if (type.startsWith("image/") || ["image", "png", "jpg", "jpeg", "webp"].includes(type)) return "image";
  if (type.startsWith("audio/") || type === "audio") return "audio";
  if (type.startsWith("text/") || ["text", "txt", "md"].includes(type)) return "text";
  return type === "sharepoint" ? "sharepoint" : "other";
}

export function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const sanitized = {};
  for (const [key, rawValue] of Object.entries(metadata)) {
    if (!Object.hasOwn(METADATA_VALUES, key) || rawValue === undefined || rawValue === null) continue;
    let value = String(rawValue).toLowerCase();
    if (["quantity", "item_count", "failed_count", "source_count"].includes(key) && typeof rawValue === "number") {
      value = analyticsCountBucket(rawValue);
    }
    if (key === "question_length" && typeof rawValue === "number") {
      value = rawValue <= 80 ? "short" : rawValue <= 300 ? "medium" : "long";
    }
    if (key === "file_type") value = analyticsFileType(rawValue);
    if (!METADATA_VALUES[key].includes(value)) continue;
    sanitized[key] = value;
    if (Object.keys(sanitized).length === 10) break;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export function syncAnalyticsCohort(cohort) {
  if (typeof window === "undefined") return;
  window.collatoAnalyticsCohort = METADATA_VALUES.cohort.includes(cohort) ? cohort : "unknown";
}

export function trackDatafastGoal(goalName, metadata = null) {
  if (typeof window === "undefined") return false;
  const normalizedGoal = String(goalName || "").trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_").slice(0, 64);
  if (!normalizedGoal || normalizedGoal === "identify") return false;
  try {
    // DataFast's documented queue contract preserves actions before script load.
    window.datafast = window.datafast || function () {
      (window.datafast.q = window.datafast.q || []).push(arguments);
    };
    if (typeof window.datafast !== "function") return false;
    // Reserve one of DataFast's ten properties for a server-classified cohort.
    const eventMetadata = { ...metadata };
    delete eventMetadata.cohort;
    const sanitizedMetadata = sanitizeMetadata({ cohort: "unknown", ...eventMetadata });
    sanitizedMetadata.cohort = METADATA_VALUES.cohort.includes(window.collatoAnalyticsCohort) ? window.collatoAnalyticsCohort : "unknown";
    if (sanitizedMetadata) window.datafast(normalizedGoal, sanitizedMetadata);
    else window.datafast(normalizedGoal);
    return true;
  } catch {
    // Analytics failures must never block product actions.
    return false;
  }
}
