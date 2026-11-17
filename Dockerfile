# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
# Prisma's query engine needs OpenSSL on Alpine (musl).
RUN apk add --no-cache openssl
WORKDIR /app

# Install dependencies only when the manifests change.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time,
# so they must arrive as build args (Coolify: mark them as Buildtime).
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_ENABLE_LITE_USERS
# `npm run build` runs `prisma generate` and then `next build`.
# Prisma connects lazily, so a placeholder URL is enough to build.
# The real DATABASE_URL is passed at runtime.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
