# iFrame login proxy (sidecar)

A tiny, dependency-free reverse proxy that gives the **iframe login fix to any
dashboard** — including stock Homarr — without modifying it.

It serves a target site under its own origin, so the site's session cookie
becomes first-party and **login works inside an iframe**, and it strips the
`X-Frame-Options` / CSP `frame-ancestors` headers that block embedding.

## Run it

```bash
docker run -d --name iframe-login-proxy --restart unless-stopped \
  -p 8585:8191 \
  -v "$PWD/server.mjs:/app/server.mjs:ro" -w /app \
  node:24-alpine node /app/server.mjs
```

(Or `docker build -t iframe-login-proxy . && docker run -d -p 8585:8191 iframe-login-proxy`.)

## Use it

Point any iframe tile at the proxy, using the target's scheme and host as path
segments:

```
http://<proxy-host>:8585/<http|https>/<target-host>/<rest-of-url>
```

Examples:

| Embed this | iframe URL |
| --- | --- |
| `https://example.com/app/?x=1` | `http://nas:8585/https/example.com/app/?x=1` |
| `http://nas:9696/` (a service on a port) | `http://nas:8585/http/nas:9696/` |

## Notes

- **Trust / scope:** this is an open proxy for anyone who can reach it. Run it on
  a trusted LAN, or set `PROXY_TOKEN=<secret>` and append `?__t=<secret>` to the
  first URL.
- Cookies are set `SameSite=Lax` (no `Secure`) for plain-HTTP LAN use; on the
  same host they flow fine.
- Big providers (Google, Microsoft, banks) actively block proxying — add those
  as normal tiles that open in a new tab.
