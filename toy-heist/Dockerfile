# syntax=docker/dockerfile:1

# Toy Heist: Node.js + Colyseus game server with SQLite persistence.
#
#   docker build -t toy-heist .
#   docker run -d --name toy-heist -p 2567:2567 -v toy-heist-data:/data toy-heist
#
# Both stages use the same Debian-based image so the native better-sqlite3
# binary built in the first stage matches the libc it runs against.
ARG NODE_VERSION=22

# ---------------------------------------------------------------- build ----
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

# Toolchain for node-gyp. better-sqlite3 normally downloads a prebuilt binary,
# but falls back to compiling from source when none matches (or the download
# is blocked); with these installed that fallback succeeds.
# (bcryptjs is pure JavaScript and needs no compiler.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Install production dependencies only, from the lockfile, in a cached layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Fail the build here, not at runtime, if the native module cannot load.
RUN node -e "new (require('better-sqlite3'))(':memory:').prepare('select 1').get(); require('bcryptjs')"

# -------------------------------------------------------------- runtime ----
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=2567 \
    HEIST_DB_PATH=/data/toy_heist.db

# SQLite lives on a volume so accounts, gold and skins survive redeploys.
# (The WAL and SHM side files are created next to the database, so the whole
# directory must be writable by the app user.)
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node tools ./tools

USER node
EXPOSE 2567

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||2567)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form: node is PID 1 and receives SIGTERM directly, which Colyseus
# handles with a graceful shutdown.
CMD ["node", "server/index.js"]
