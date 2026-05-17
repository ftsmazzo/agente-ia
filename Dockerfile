# syntax=docker/dockerfile:1
# Build context: repository root (required by EasyPanel default path)

FROM node:20-alpine AS builder
WORKDIR /app

# EasyPanel passes GIT_SHA — busts Docker layer cache on new commits
ARG GIT_SHA=dev
RUN echo "build commit: ${GIT_SHA}"

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY config/prompts ./config/prompts

RUN npm run build -w @realty/shared && npm run build -w @realty/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache wget \
  && addgroup -g 1001 -S realty && adduser -S realty -u 1001 -G realty

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/config/prompts ./config/prompts

# Migrations run automatically on container start (docker-entrypoint.mjs)
COPY db/migrations ./db/migrations
COPY scripts/wait-for-database.mjs scripts/run-migrations.mjs scripts/docker-entrypoint.mjs ./scripts/

ENV APP_ROOT=/app
ENV RUN_MIGRATIONS_ON_START=true
ENV APP_VERSION=0.3.2

RUN chown -R realty:realty /app/db /app/scripts

USER realty

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["node", "/app/scripts/docker-entrypoint.mjs"]
CMD ["node", "apps/api/dist/index.js"]
