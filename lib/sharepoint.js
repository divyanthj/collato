import crypto from "crypto";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MICROSOFT_AUTH_BASE_URL = "https://login.microsoftonline.com";
const SHAREPOINT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Files.Read.All",
  "Sites.Read.All"
];

function getTenantId() {
  return process.env.MICROSOFT_TENANT_ID || "common";
}

function getClientId() {
  return process.env.MICROSOFT_CLIENT_ID || "";
}

function getClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET || "";
}

function getRedirectUri() {
  return process.env.MICROSOFT_REDIRECT_URI || "";
}

function getTokenUrl() {
  return `${MICROSOFT_AUTH_BASE_URL}/${encodeURIComponent(getTenantId())}/oauth2/v2.0/token`;
}

function getAuthorizationUrl() {
  return `${MICROSOFT_AUTH_BASE_URL}/${encodeURIComponent(getTenantId())}/oauth2/v2.0/authorize`;
}

function getEncryptionSecret() {
  const raw = process.env.SHAREPOINT_TOKEN_ENCRYPTION_SECRET || process.env.AUTH_SECRET || "";
  return crypto.createHash("sha256").update(raw).digest();
}

function assertConfigured() {
  if (!getClientId() || !getClientSecret() || !getRedirectUri()) {
    throw new Error("Microsoft SharePoint integration is not configured.");
  }
}

export function buildSharePointState(input) {
  const payload = {
    workspaceSlug: String(input.workspaceSlug || ""),
    userId: String(input.userId || ""),
    email: String(input.email || ""),
    nonce: crypto.randomBytes(12).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.AUTH_SECRET || "collato-dev-secret-change-me")
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

export function readSharePointState(state) {
  const [encoded, signature] = String(state || "").split(".");
  if (!encoded || !signature) {
    throw new Error("Invalid Microsoft connection state.");
  }

  const expected = crypto
    .createHmac("sha256", process.env.AUTH_SECRET || "collato-dev-secret-change-me")
    .update(encoded)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid Microsoft connection state.");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload?.workspaceSlug || !payload?.userId || Date.now() > Number(payload.exp || 0)) {
    throw new Error("Expired Microsoft connection state.");
  }

  return payload;
}

export function buildSharePointConnectUrl(state) {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    response_mode: "query",
    scope: SHAREPOINT_SCOPES.join(" "),
    state,
    prompt: "select_account"
  });

  return `${getAuthorizationUrl()}?${params.toString()}`;
}

export function encryptSharePointToken(token) {
  if (!token) {
    return "";
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSharePointToken(value) {
  if (!value) {
    return "";
  }

  const [iv, authTag, encrypted] = String(value).split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionSecret(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

async function requestToken(body) {
  assertConfigured();
  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Microsoft token request failed.");
  }

  return payload;
}

export async function exchangeSharePointCode(code) {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
    scope: SHAREPOINT_SCOPES.join(" ")
  });

  return requestToken(body);
}

export async function refreshSharePointAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SHAREPOINT_SCOPES.join(" ")
  });

  return requestToken(body);
}

export async function graphRequest(accessToken, path, options = {}) {
  const url = path.startsWith("https://") ? path : `${GRAPH_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (options.rawResponse) {
    return response;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "Microsoft Graph request failed.");
  }

  return payload;
}

export async function getSharePointProfile(accessToken) {
  return graphRequest(accessToken, "/me?$select=id,displayName,mail,userPrincipalName");
}

export async function listSharePointSites(accessToken) {
  const payload = await graphRequest(accessToken, "/sites?search=*");
  return Array.isArray(payload.value) ? payload.value : [];
}

export async function listSharePointDrives(accessToken, siteId) {
  const payload = await graphRequest(accessToken, `/sites/${encodeURIComponent(siteId)}/drives`);
  return Array.isArray(payload.value) ? payload.value : [];
}

export async function listSharePointItems(accessToken, driveId, itemId = "") {
  const path = itemId
    ? `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children`
    : `/drives/${encodeURIComponent(driveId)}/root/children`;
  const payload = await graphRequest(accessToken, path);
  return Array.isArray(payload.value) ? payload.value : [];
}

export async function getSharePointDriveItem(accessToken, driveId, itemId) {
  return graphRequest(accessToken, `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`);
}

export async function downloadSharePointDriveItem(accessToken, driveId, itemId) {
  const response = await graphRequest(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
    { rawResponse: true }
  );
  if (!response.ok) {
    throw new Error("Could not download SharePoint file.");
  }

  return response;
}

export function getSharePointScopes() {
  return SHAREPOINT_SCOPES.join(" ");
}
