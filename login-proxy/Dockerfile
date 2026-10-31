# iFrame login proxy — tiny standalone sidecar (no dependencies).
FROM node:24-alpine
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY server.mjs .
ENV PORT=8191
EXPOSE 8191
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q --spider http://127.0.0.1:8191/healthz || exit 1
CMD ["node", "server.mjs"]
