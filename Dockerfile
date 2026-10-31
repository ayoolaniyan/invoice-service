# syntax=docker/dockerfile:1

# ---- Build: install all dependencies and compile TypeScript ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts: no dependency needs an install script to build or run this app
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.build.json index.ts ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# ---- Runtime: production dependencies and compiled code only ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist

# Run as the unprivileged user that ships with the Node image
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Run node directly (not through npm) so it receives SIGTERM and shuts down gracefully
CMD ["node", "dist/index.js"]
