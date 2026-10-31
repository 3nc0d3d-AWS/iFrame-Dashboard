/**
 * Shared helpers for the login-capable iframe reverse proxy.
 *
 * Browsers block login inside a cross-site iframe because the target's session
 * cookie is treated as third-party (SameSite). Serving the embedded site under
 * the panel's OWN origin makes that cookie first-party, so sessions persist.
 *
 * The target's scheme and host are carried as the first two path segments, so
 * the whole site lives under a stable prefix the proxy can rewrite links to:
 *   https://example.com/app/?x=1  ->  /api/embed/https/example.com/app/?x=1
 *
 * These functions are pure (no Node/browser APIs) so both the client widget and
 * the server route handler can share them. The route handler lives at
 * apps/nextjs/src/app/api/embed/[...slug]/route.ts.
 */

/** Mount point of the embed proxy route handler. */
export const embedProxyPrefix = "/api/embed";

/** Query param carrying the one-time signed grant that bootstraps the embed session. */
export const embedGrantParam = "__egrant";

/** Cookie (scoped to the embed origin + proxy path) that authorizes the embed session after bootstrap. */
export const embedSessionCookieName = "iframe-embed-session";

/** How long a minted grant token stays valid — just long enough to bootstrap the cookie. */
export const embedGrantTtlMs = 5 * 60 * 1000;

/** How long the bootstrapped embed session cookie lives. */
export const embedSessionTtlMs = 12 * 60 * 60 * 1000;

/**
 * Builds the same-origin proxy path for a target URL, or `null` if the URL is
 * not an embeddable http(s) address (callers should fall back to the raw URL).
 */
export const buildEmbedProxyPath = (rawUrl: string): string | null => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const scheme = url.protocol.replace(/:$/, "");
  return `${embedProxyPrefix}/${scheme}/${url.host}${url.pathname}${url.search}${url.hash}`;
};

export interface EmbedProxyTarget {
  /** Upstream origin, e.g. "https://example.com". */
  origin: string;
  /** Upstream host (with port if any), e.g. "example.com" or "nas.local:5001". */
  host: string;
  /** Proxy prefix for this target, e.g. "/api/embed/https/example.com". */
  proxyPrefix: string;
  /** Full upstream URL being requested (path + query), e.g. "https://example.com/app/?x=1". */
  upstreamUrl: string;
}

/**
 * Parses a raw `/api/embed/...` request path + query back into its upstream
 * target. Takes the RAW (still percent-encoded) pathname from `new URL().pathname`
 * rather than Next's decoded catch-all segments, so trailing slashes and encoded
 * characters survive the round-trip. Returns `null` for anything malformed — the
 * caller must reject rather than proxy a guess.
 */
export const parseEmbedTarget = (rawPathname: string, search: string): EmbedProxyTarget | null => {
  if (!rawPathname.startsWith(`${embedProxyPrefix}/`)) return null;

  const rest = rawPathname.slice(embedProxyPrefix.length + 1); // "https/example.com/app/"
  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) return null;

  const scheme = rest.slice(0, firstSlash);
  if (scheme !== "http" && scheme !== "https") return null;

  const afterScheme = rest.slice(firstSlash + 1); // "example.com/app/"
  const secondSlash = afterScheme.indexOf("/");
  const host = secondSlash === -1 ? afterScheme : afterScheme.slice(0, secondSlash);
  if (host === "") return null;

  const path = secondSlash === -1 ? "/" : afterScheme.slice(secondSlash); // "/app/"
  const origin = `${scheme}://${host}`;

  return {
    origin,
    host,
    proxyPrefix: `${embedProxyPrefix}/${scheme}/${host}`,
    upstreamUrl: `${origin}${path}${search}`,
  };
};
