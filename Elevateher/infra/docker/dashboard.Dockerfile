FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/dashboard/package*.json ./
RUN npm ci
COPY apps/dashboard/ .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
     CMD wget -qO- http://localhost:3000/ >/dev/null || exit 1
 CMD ["npm", "start"]
