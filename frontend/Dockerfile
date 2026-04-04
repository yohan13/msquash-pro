# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time env vars for Vite (must be declared as ARG then ENV)
ARG VITE_API_URL=http://localhost:4000
ARG VITE_CLUB_NAME=M Squash
ARG VITE_TAGLINE=Club • Food • Sports
ARG VITE_PRIMARY=#0a6bdc

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLUB_NAME=$VITE_CLUB_NAME
ENV VITE_TAGLINE=$VITE_TAGLINE
ENV VITE_PRIMARY=$VITE_PRIMARY

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Serve stage (nginx) ───────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: all routes → index.html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n  location /api { return 404; }\n}\n' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
