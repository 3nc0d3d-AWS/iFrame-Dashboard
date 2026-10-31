// iFrame login proxy — standalone sidecar.
//
// Serves any site under THIS server's origin so its session cookie becomes
// first-party and login works inside an iframe, and strips the framing headers
// (X-Frame-Options / CSP frame-ancestors) that block embedding. Point a Homarr
// (or any) iframe tile at:
//
//     http://<this-host>:<port>/https/example.com/some/path
//
// i.e. /<scheme>/<host>/<rest-of-url>. No dependencies — Node 20+ only.
//
// Trust model: this is an open proxy for whoever can reach it. Run it on a
// trusted LAN (or set PROXY_TOKEN to require ?__t=<token> on the first load).

import http from "node:http";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT ?? 8191);
const TOKEN = process.env.PROXY_TOKEN ?? "";

const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const stripResponse = new Set([
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "strict-transport-security",
  "content-encoding",
  "content-length",
  "set-cookie",
]);
const nonHttp = /^(data:|blob:|mailto:|tel:|javascript:|about:|#)/i;

const parseTarget = (rawPathname, search) => {
  const rest = rawPathname.replace(/^\/+/, "");
  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) return null;
  const scheme = rest.slice(0, firstSlash);
  if (scheme !== "http" && scheme !== "https") return null;
  const afterScheme = rest.slice(firstSlash + 1);
  const secondSlash = afterScheme.indexOf("/");
  const host = secondSlash === -1 ? afterScheme : afterScheme.slice(0, secondSlash);
  if (!host) return null;
  const path = secondSlash === -1 ? "/" : afterScheme.slice(secondSlash);
  const origin = `${scheme}://${host}`;
  return { origin, host, proxyPrefix: `/${scheme}/${host}`, upstreamUrl: `${origin}${path}${search}` };
};

const rewriteUrl = (raw, target) => {
  const trimmed = raw.trim();
  if (trimmed === "" || nonHttp.test(trimmed)) return null;
  let abs;
  try {
    abs = new URL(trimmed, target.upstreamUrl);
  } catch {
    return null;
  }
  if (abs.origin !== target.origin) return null;
  return `${target.proxyPrefix}${abs.pathname}${abs.search}${abs.hash}`;
};

const rewriteSrcset = (value, target) =>
  value
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      if (!url) return entry;
      const r = rewriteUrl(url, target);
      return r === null ? entry : [r, ...parts.slice(1)].join(" ");
    })
    .join(", ");

const rewriteCss = (css, target) =>
  css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, url) => {
      const r = rewriteUrl(url, target);
      return r === null ? m : `url(${q}${r}${q})`;
    })
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, url) => {
      const r = rewriteUrl(url, target);
      return r === null ? m : `@import ${q}${r}${q}`;
    });

const urlAttrs = /\b(href|src|action|formaction|poster|data-src|data-href)\s*=\s*("([^"]*)"|'([^']*)')/gi;

const rewriteHtml = (html, target) => {
  let out = html.replace(urlAttrs, (m, attr, _q, dq, sq) => {
    const value = dq ?? sq ?? "";
    const quote = dq !== undefined ? '"' : "'";
    const r = rewriteUrl(value, target);
    return r === null ? m : `${attr}=${quote}${r}${quote}`;
  });
  out = out.replace(/\bsrcset\s*=\s*"([^"]*)"/gi, (_m, v) => `srcset="${rewriteSrcset(v, target)}"`);
  out = out.replace(
    /(<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^;"']*;\s*url=)([^"']+)(["'])/gi,
    (m, pre, url, suf) => {
      const r = rewriteUrl(url, target);
      return r === null ? m : `${pre}${r}${suf}`;
    },
  );
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) => `${open}${rewriteCss(body, target)}${close}`);
  const upstream = new URL(target.upstreamUrl);
  const dir = upstream.pathname.endsWith("/") ? upstream.pathname : upstream.pathname.replace(/[^/]*$/, "");
  const baseTag = `<base href="${target.proxyPrefix}${dir}">`;
  out = /<head\b[^>]*>/i.test(out) ? out.replace(/(<head\b[^>]*>)/i, `$1${baseTag}`) : `${baseTag}${out}`;
  return out;
};

const rewriteSetCookie = (cookie, target) => {
  const parts = cookie.split(";").map((p) => p.trim());
  const [nameValue, ...attrs] = parts;
  const kept = [nameValue ?? ""];
  let hadPath = false;
  for (const a of attrs) {
    const [k, v] = a.split("=");
    const lk = k?.toLowerCase();
    if (lk === "domain") continue;
    if (lk === "samesite" || lk === "secure") continue;
    if (lk === "path") {
      hadPath = true;
      const op = v && v.startsWith("/") ? v : "/";
      kept.push(`Path=${target.proxyPrefix}${op === "/" ? "/" : op}`);
      continue;
    }
    kept.push(a);
  }
  if (!hadPath) kept.push(`Path=${target.proxyPrefix}/`);
  // Same-site LAN use over http: Lax flows on same-site navigations/subresources.
  kept.push("SameSite=Lax");
  return kept.join("; ");
};

const rewriteReferer = (referer, target) => {
  try {
    const u = new URL(referer);
    const t = parseTarget(u.pathname, u.search);
    return t?.upstreamUrl ?? null;
  } catch {
    return null;
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, "http://localhost");

    if (reqUrl.pathname === "/" || reqUrl.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("iframe-login-proxy ok\n");
      return;
    }

    // Optional shared-token gate.
    let search = reqUrl.search;
    if (TOKEN) {
      const supplied = reqUrl.searchParams.get("__t");
      if (supplied !== TOKEN) {
        res.writeHead(401).end("Unauthorized");
        return;
      }
      reqUrl.searchParams.delete("__t");
      search = reqUrl.searchParams.toString() ? `?${reqUrl.searchParams.toString()}` : "";
    }

    const target = parseTarget(reqUrl.pathname, search);
    if (!target) {
      res.writeHead(400).end("Invalid target. Use /<http|https>/<host>/<path>.");
      return;
    }

    const upstreamHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (hopByHop.has(lower) || lower === "host" || lower === "accept-encoding") continue;
      const v = Array.isArray(value) ? value.join(", ") : value;
      if (v === undefined) continue;
      if (lower === "origin") {
        upstreamHeaders.set("origin", target.origin);
        continue;
      }
      if (lower === "referer") {
        const r = rewriteReferer(v, target);
        if (r) upstreamHeaders.set("referer", r);
        continue;
      }
      upstreamHeaders.set(key, v);
    }
    upstreamHeaders.set("accept-encoding", "identity");

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    let bodyBuffer;
    if (hasBody) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      bodyBuffer = Buffer.concat(chunks);
    }

    let upstream;
    try {
      upstream = await fetch(target.upstreamUrl, {
        method: req.method,
        headers: upstreamHeaders,
        body: hasBody ? bodyBuffer : undefined,
        redirect: "manual",
      });
    } catch {
      res.writeHead(502).end(`Could not reach ${target.origin}.`);
      return;
    }

    const outHeaders = {};
    const setCookies = [];
    for (const [key, value] of upstream.headers) {
      const lower = key.toLowerCase();
      if (hopByHop.has(lower) || stripResponse.has(lower)) continue;
      outHeaders[key] = value;
    }
    for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
      setCookies.push(rewriteSetCookie(cookie, target));
    }
    if (setCookies.length) outHeaders["set-cookie"] = setCookies;

    const location = upstream.headers.get("location");
    if (location) outHeaders["location"] = rewriteUrl(location, target) ?? location;

    const contentType = upstream.headers.get("content-type") ?? "";

    if (contentType.includes("text/html") || contentType.includes("text/css")) {
      const text = await upstream.text();
      const body = contentType.includes("text/html") ? rewriteHtml(text, target) : rewriteCss(text, target);
      res.writeHead(upstream.status, outHeaders);
      res.end(body);
      return;
    }

    res.writeHead(upstream.status, outHeaders);
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    res.writeHead(500).end("Proxy error");
    console.error(error);
  }
});

server.listen(PORT, () => console.log(`iframe-login-proxy listening on :${PORT}`));
