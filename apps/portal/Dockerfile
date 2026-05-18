# syntax=docker/dockerfile:1
# Build context: repository root (EasyPanel)

FROM node:20-alpine AS builder
WORKDIR /app/apps/portal

ARG GIT_SHA=dev
ARG VITE_API_URL=
RUN echo "portal build: ${GIT_SHA}"

COPY apps/portal/package.json ./
RUN npm install

COPY apps/portal/ ./

ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine AS runner

COPY apps/portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/portal/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1
