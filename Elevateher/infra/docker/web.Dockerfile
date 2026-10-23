# Web Dockerfile for ElevateHer (React Router v7 + Hono SSR)
#
# ⚠️  PRE-BUILD REQUIRED — Build the web app locally before running docker compose:
#
#   cd apps/web && npm install --legacy-peer-deps && npm run build
#   cd ../..  && docker compose up web
#
# Reason: react-router-hono-server uses async hooks that fail in Docker's BuildKit
# environment due to missing Node.js async context propagation during SSR compilation.
# The local Node.js environment resolves this correctly.

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY apps/web/package*.json ./

# Install ALL deps (including devDeps) — the React Router SSR build embeds
# references to @react-router/dev and fast-glob at runtime.
RUN npm ci --legacy-peer-deps

# Copy pre-built artifacts from local build directory.
# If this COPY fails, run: cd apps/web && npm run build
COPY apps/web/build ./build

EXPOSE 3000

# React Router v7 SSR server entry point
CMD ["npx", "@react-router/serve", "build/server/index.js"]
