const ADMIN_GATE_COOKIE = "fantasyiq_admin_gate";
const CANONICAL_HOST = "myfantasyiq.com";
const DEFAULT_MAX_AGE_SECONDS = 8 * 60 * 60;

function requestHost(request, url) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  return (forwardedHost || host || url.host || "").split(",")[0].trim().split(":")[0].toLowerCase();
}

function canonicalRedirect(request, url) {
  const host = requestHost(request, url);
  if (!host.endsWith(".vercel.app")) return null;

  url.hostname = CANONICAL_HOST;
  url.protocol = "https:";
  url.port = "";
  return Response.redirect(url, 308);
}

function dashboardRootRedirect(url) {
  if (url.pathname !== "/") return null;
  const dashboardQuery =
    url.searchParams.has("login") ||
    url.searchParams.has("customer") ||
    url.searchParams.has("dashboard") ||
    url.searchParams.has("loadout") ||
    url.searchParams.get("auth") === "login";
  if (!dashboardQuery) return null;

  url.pathname = "/FantasyIQ/";
  return Response.redirect(url, 302);
}

function adminGateMaxAge() {
  const raw = Number.parseInt(process.env.FANTASYIQ_ADMIN_GATE_MAX_AGE_SECONDS || "", 10);
  if (!Number.isFinite(raw)) return DEFAULT_MAX_AGE_SECONDS;
  return Math.max(300, Math.min(raw, 24 * 60 * 60));
}

function cookieValue(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(issuedAt, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`admin:${issuedAt}`));
  return `${issuedAt}.${base64Url(new Uint8Array(signature))}`;
}

async function hasValidAdminGate(request) {
  const secret = process.env.FANTASYIQ_ADMIN_GATE_SECRET || "";
  if (!secret) return false;
  const token = cookieValue(request, ADMIN_GATE_COOKIE);
  const [issuedRaw] = token.split(".", 1);
  const issuedAt = Number.parseInt(issuedRaw || "", 10);
  if (!token || !Number.isFinite(issuedAt)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + 60 || now - issuedAt > adminGateMaxAge()) return false;
  return token === (await sign(issuedAt, secret));
}

function jsonUnauthorized(message) {
  return new Response(JSON.stringify({ ok: false, message }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const redirect = canonicalRedirect(request, url);
  if (redirect) return redirect;
  const dashboardRedirect = dashboardRootRedirect(url);
  if (dashboardRedirect) return dashboardRedirect;

  if (url.pathname !== "/admin.html" && url.pathname !== "/api/admin-customers") return;

  const authenticated = await hasValidAdminGate(request);
  if (authenticated) return;

  if (url.pathname === "/api/admin-customers") {
    return jsonUnauthorized("Admin gate sign-in required.");
  }

  url.pathname = "/admin-login.html";
  url.searchParams.set("next", request.nextUrl?.pathname || "/admin.html");
  return Response.redirect(url, 302);
}

export const config = {
  matcher: ["/:path*"],
};
