# ToneGuard — Google Cloud Run Hardened Production Dockerfile (v5.3 — Patched for Oct 2026 CVE-2026-111497 "Node2Shell")
# Note: Node.js 20.x reached EOL in 2026 and does NOT receive patches for CVE-2026-111497.
# We use Node.js 24 Active LTS (v24.22.1+) with latest Alpine & libbrotli/OpenSSL patches.
FROM node:24-alpine

# Apply latest Alpine OS, libbrotli, c-ares & OpenSSL/libcrypto security patches
RUN apk update && apk upgrade --no-cache && node -v

# Create app directory
WORKDIR /usr/src/app

# Copy package metadata
COPY package.json ./

# Copy ONLY allowlisted static web assets & hardened stateless server (no docs or dev files)
COPY index.html pitch-deck.html manifest.json sw.js server.js ./
COPY css ./css
COPY js ./js

# Lock file permissions (read-only for node user, zero write access needed)
RUN chown -R root:root /usr/src/app && chmod -R a+rX,u+w,go-w /usr/src/app

# Run as non-root user for container security best practices
USER node

# Cloud Run injects PORT environment variable (defaults to 8080)
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Run Node.js with V8 runtime hardening flags:
# --disable-proto=delete                  : Eliminates Object.prototype.__proto__ (Prototype Pollution immunity)
# --disallow-code-generation-from-strings : Blocks eval() and new Function() in the backend runtime
CMD ["node", "--disable-proto=delete", "--disallow-code-generation-from-strings", "server.js"]
