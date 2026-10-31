import { sessionTokenCookieName } from "@homarr/auth";
import { auth } from "@homarr/auth/next";
import type { EmbedProxyTarget } from "@homarr/common";
import {
  embedGrantParam,
  embedProxyPrefix,
  embedSessionCookieName,
  embedSessionTtlMs,
  parseCookies,
  parseEmbedTarget,
} from "@homarr/common";
import { signEmbedToken, verifyEmbedToken } from "@homarr/common/server";

/**
 * Login-capable reverse proxy for iframe pages.
 *
 * Serves an embedded site under the panel's own origin so its session cookie is
 * first-party (fixing login that silently fails inside a cross-site iframe), and
 * strips the framing headers (X-Frame-Options / CSP frame-ancestors) that would
 * otherwise block the site from rendering at all. See `@homarr/common`'s
 * embed-proxy helpers for the path scheme.
 *
 * Trust model: the proxied page runs on THIS origin, so only sites the operator
 * trusts should be routed through it. It is gated behind an authenticated panel
 * session (no open proxy); the panel's own session cookie is httpOnly, so proxied
 * page scripts cannot read it via document.cookie. For stronger isolation in
 * production, serve this route from a dedicated subdomain.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Headers that are connection-specific and must not be forwarded in either direction.
const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

// Response headers we drop: framing/security headers that would block embedding,
// and length/encoding headers that no longer match after undici decodes the body.
// set-cookie is handled separately (rewritten, not forwarded verbatim).
const strippedResponseHeaders = new Set([
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "strict-transport-security",
  "content-encoding",
  "content-length",
  "set-cookie",
]);

const nonHttpUrlSchemes = /^(data:|blob:|mailto:|tel:|javascript:|about:|#)/i;

/**
 * Resolves a URL found in the upstream document against the current upstream URL
 * and, when it points back at the same origin, rewrites it to its proxy path.
 * Cross-origin and non-navigational URLs are left untouched (returns `null`) so
 * assets on CDNs and external redirects keep working directly.
 */
const rewriteUrl = (raw: string, target: EmbedProxyTarget): string | null => {
  const trimmed = raw.trim();
  if (trimmed === "" || nonHttpUrlSchemes.test(trimmed)) return null;

  let abs: URL;
  try {
    abs = new URL(trimmed, target.upstreamUrl);
  } catch {
    return null;
  }

  if (abs.origin !== target.origin) return null;
  return `${target.proxyPrefix}${abs.pathname}${abs.search}${abs.hash}`;
};

/** Rewrites a `srcset` value (comma-separated `url [descriptor]` entries). */
const rewriteSrcset = (value: string, target: EmbedProxyTarget): string =>
  value
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      if (!url) return entry;
      const rewritten = rewriteUrl(url, target);
      if (rewritten === null) return entry;
      return [rewritten, ...parts.slice(1)].join(" ");
    })
    .join(", ");

/** Rewrites same-origin `url(...)` references inside CSS (inline or stylesheet). */
const rewriteCss = (css: string, target: EmbedProxyTarget): string =>
  css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote: string, url: string) => {
      const rewritten = rewriteUrl(url, target);
      return rewritten === null ? match : `url(${quote}${rewritten}${quote})`;
    })
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote: string, url: string) => {
      const rewritten = rewriteUrl(url, target);
      return rewritten === null ? match : `@import ${quote}${rewritten}${quote}`;
    });

const urlAttributes = /\b(href|src|action|formaction|poster|data-src|data-href)\s*=\s*("([^"]*)"|'([^']*)')/gi;

const rewriteHtml = (html: string, target: EmbedProxyTarget): string => {
  let output = html;

  // href/src/action/... attributes.
  output = output.replace(urlAttributes, (match, attr: string, _quoted, dq?: string, sq?: string) => {
    const value = dq ?? sq ?? "";
    const quote = dq !== undefined ? '"' : "'";
    const rewritten = rewriteUrl(value, target);
    return rewritten === null ? match : `${attr}=${quote}${rewritten}${quote}`;
  });

  // srcset (responsive images / <source>).
  output = output.replace(/\bsrcset\s*=\s*"([^"]*)"/gi, (match, value: string) => {
    return `srcset="${rewriteSrcset(value, target)}"`;
  });

  // <meta http-equiv="refresh" content="5; url=...">
  output = output.replace(
    /(<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^;"']*;\s*url=)([^"']+)(["'])/gi,
    (match, prefix: string, url: string, suffix: string) => {
      const rewritten = rewriteUrl(url, target);
      return rewritten === null ? match : `${prefix}${rewritten}${suffix}`;
    },
  );

  // Inline <style> blocks.
  output = output.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open: string, body: string, close: string) => {
    return `${open}${rewriteCss(body, target)}${close}`;
  });

  // Inject a <base> so relative URLs built in JS (fetch/XHR) also resolve under
  // the proxy. It points at the current upstream directory. Our explicitly
  // rewritten attributes above are root-absolute, so <base> never double-applies.
  const upstream = new URL(target.upstreamUrl);
  const dir = upstream.pathname.endsWith("/") ? upstream.pathname : upstream.pathname.replace(/[^/]*$/, "");
  const baseTag = `<base href="${target.proxyPrefix}${dir}">`;
  if (/<head\b[^>]*>/i.test(output)) {
    output = output.replace(/(<head\b[^>]*>)/i, `$1${baseTag}`);
  } else {
    output = `${baseTag}${output}`;
  }

  return output;
};

/** Rewrites an upstream Set-Cookie so the browser stores it first-party to this proxy path. */
const rewriteSetCookie = (cookie: string, target: EmbedProxyTarget): string => {
  const parts = cookie.split(";").map((part) => part.trim());
  const [nameValue, ...attributes] = parts;
  const kept: string[] = [nameValue ?? ""];

  let hadPath = false;
  for (const attribute of attributes) {
    const [key, value] = attribute.split("=");
    const lower = key?.toLowerCase();

    // Domain would scope the cookie to the upstream host (which isn't us) — drop it.
    if (lower === "domain") continue;
    // SameSite/Secure are re-added below in a form valid for the embedded context.
    if (lower === "samesite" || lower === "secure") continue;

    if (lower === "path") {
      hadPath = true;
      const originalPath = value && value.startsWith("/") ? value : "/";
      kept.push(`Path=${target.proxyPrefix}${originalPath === "/" ? "/" : originalPath}`);
      continue;
    }

    kept.push(attribute);
  }

  if (!hadPath) kept.push(`Path=${target.proxyPrefix}/`);
  // localhost is a secure context too, so Secure is safe in dev; None keeps the
  // cookie flowing when the proxied document sits in a sub-frame.
  kept.push("SameSite=None");
  kept.push("Secure");

  return kept.join("; ");
};

/**
 * Splits our one-time grant param off the raw query string without re-encoding
 * the rest. The grant is always appended last by the token minter, so a plain
 * string cut preserves the upstream query verbatim.
 */
const splitGrant = (search: string): { grant: string | null; upstreamSearch: string } => {
  const marker = `${embedGrantParam}=`;
  const index = search.indexOf(marker);
  if (index < 1) return { grant: null, upstreamSearch: search };
  const grant = decodeURIComponent(search.slice(index + marker.length));
  // Drop the "?__egrant=..." / "&__egrant=..." (separator is the char before it).
  return { grant, upstreamSearch: search.slice(0, index - 1) };
};

interface EmbedAuthorization {
  ok: boolean;
  /** User id to issue a fresh embed-session cookie for (grant bootstrap only). */
  bootstrapUserId?: string;
}

/**
 * Authorizes an embed request in any of the supported modes:
 *  1. panel session (single-origin mode — same origin, cookie present);
 *  2. an already-bootstrapped embed-session cookie (dedicated-origin mode);
 *  3. a one-time signed grant (dedicated-origin bootstrap) -> issue the cookie.
 */
const authorizeEmbed = async (request: Request, grant: string | null): Promise<EmbedAuthorization> => {
  const session = await auth();
  if (session?.user) return { ok: true };

  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  const sessionCookie = cookies[embedSessionCookieName];
  if (sessionCookie && verifyEmbedToken(sessionCookie)) return { ok: true };

  if (grant) {
    const verified = verifyEmbedToken(grant);
    if (verified) return { ok: true, bootstrapUserId: verified.userId };
  }

  return { ok: false };
};

// Panel/auth cookies must never be forwarded to the proxied third-party site.
// All Auth.js cookies share the AUTH_COOKIE_PREFIX (derived from the session cookie
// name), with optional __Secure-/__Host- prefixes; plus our own embed-session cookie.
const authCookiePrefix = sessionTokenCookieName.replace(/\.session-token$/, "");
const isPanelCookie = (name: string): boolean =>
  name === embedSessionCookieName ||
  name.startsWith(`${authCookiePrefix}.`) ||
  name.startsWith(`__Secure-${authCookiePrefix}`) ||
  name.startsWith(`__Host-${authCookiePrefix}`);

/** Strips panel/auth cookies from a Cookie header, keeping only the upstream's own cookies. */
const filterUpstreamCookies = (cookieHeader: string): string =>
  cookieHeader
    .split(/;\s*/)
    .filter((pair) => {
      const name = pair.split("=")[0];
      return name !== undefined && name !== "" && !isPanelCookie(name);
    })
    .join("; ");

/** Builds the Set-Cookie that authorizes subsequent requests from the embedded frame. */
const buildEmbedSessionCookie = (userId: string): string => {
  const token = signEmbedToken(userId, embedSessionTtlMs);
  const maxAge = Math.floor(embedSessionTtlMs / 1000);
  // SameSite=None + Secure is required so the cookie is sent from the cross-site
  // iframe. localhost is a secure context, so this also works in dev over http.
  return `${embedSessionCookieName}=${token}; Path=${embedProxyPrefix}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`;
};

const handle = async (request: Request): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const { grant, upstreamSearch } = splitGrant(requestUrl.search);

  const target = parseEmbedTarget(requestUrl.pathname, upstreamSearch);
  if (!target) {
    return new Response("Invalid embed target.", { status: 400 });
  }

  // Never let the proxy point back at itself: a proxied page could otherwise
  // reach the panel's own authenticated APIs via the forwarded session cookie.
  if (target.host === requestUrl.host) {
    return new Response("Refusing to proxy the panel's own host.", { status: 400 });
  }

  const authorization = await authorizeEmbed(request, grant);
  if (!authorization.ok) {
    return new Response("Embed proxy requires authorization.", { status: 401 });
  }

  // Build the upstream request headers.
  const upstreamHeaders = new Headers();
  for (const [key, value] of request.headers) {
    const lower = key.toLowerCase();
    if (hopByHopHeaders.has(lower)) continue;
    if (lower === "host" || lower === "accept-encoding") continue;
    // Make CSRF origin/referer checks on the upstream pass: present them as if
    // the request came from the upstream site itself.
    if (lower === "origin") {
      upstreamHeaders.set("origin", target.origin);
      continue;
    }
    if (lower === "referer") {
      const rewritten = rewriteRefererToUpstream(value, target);
      if (rewritten) upstreamHeaders.set("referer", rewritten);
      continue;
    }
    // Forward only the upstream's own cookies — never the panel/auth cookies.
    if (lower === "cookie") {
      const filtered = filterUpstreamCookies(value);
      if (filtered !== "") upstreamHeaders.set("cookie", filtered);
      continue;
    }
    upstreamHeaders.set(key, value);
  }
  // Force identity so we receive text we can rewrite (undici would decode anyway).
  upstreamHeaders.set("accept-encoding", "identity");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(target.upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    return new Response(`Could not reach ${target.origin}.`, { status: 502 });
  }

  // Build the downstream response headers.
  const responseHeaders = new Headers();
  for (const [key, value] of upstreamResponse.headers) {
    const lower = key.toLowerCase();
    if (hopByHopHeaders.has(lower)) continue;
    if (strippedResponseHeaders.has(lower)) continue;
    responseHeaders.set(key, value);
  }

  // Rewrite cookies to be first-party to this proxy path.
  for (const cookie of upstreamResponse.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", rewriteSetCookie(cookie, target));
  }

  // On a grant bootstrap, issue the embed-session cookie so later frame requests
  // (which carry no grant) stay authorized without the panel session.
  if (authorization.bootstrapUserId) {
    responseHeaders.append("set-cookie", buildEmbedSessionCookie(authorization.bootstrapUserId));
  }

  // Rewrite redirects so they stay inside the proxy (same-origin targets only).
  const location = upstreamResponse.headers.get("location");
  if (location) {
    responseHeaders.set("location", rewriteUrl(location, target) ?? location);
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  const status = upstreamResponse.status;
  const statusText = upstreamResponse.statusText;

  if (contentType.includes("text/html")) {
    const body = rewriteHtml(await upstreamResponse.text(), target);
    responseHeaders.set("content-type", contentType);
    return new Response(body, { status, statusText, headers: responseHeaders });
  }

  if (contentType.includes("text/css")) {
    const body = rewriteCss(await upstreamResponse.text(), target);
    responseHeaders.set("content-type", contentType);
    return new Response(body, { status, statusText, headers: responseHeaders });
  }

  // Everything else (scripts, images, fonts, JSON, ...) is streamed through untouched.
  return new Response(upstreamResponse.body, { status, statusText, headers: responseHeaders });
};

/** Maps a Referer that points at this proxy back to the upstream URL it represents. */
const rewriteRefererToUpstream = (referer: string, target: EmbedProxyTarget): string | null => {
  try {
    const url = new URL(referer);
    if (!url.pathname.startsWith(`${embedProxyPrefix}/`)) return null;
    const refTarget = parseEmbedTarget(url.pathname, url.search);
    return refTarget?.upstreamUrl ?? null;
  } catch {
    return null;
  }
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
