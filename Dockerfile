# Image unique : le serveur Node sert l'API, le WebSocket et le client web compilé.
# Node exécute le TypeScript directement (suppression de types), sans étape de compilation serveur.

FROM node:24-slim AS web
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/data/package.json packages/data/
COPY packages/game/package.json packages/game/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @hexa/web... --filter @hexa/game
COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter @hexa/game test && pnpm --filter @hexa/web build

FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/data/package.json packages/data/
COPY packages/game/package.json packages/game/
COPY apps/server/package.json apps/server/
RUN pnpm install --prod --frozen-lockfile --filter @hexa/server... && rm -rf /root/.cache /root/.local/share/pnpm
COPY packages/data/src packages/data/src
COPY packages/game/src packages/game/src
COPY apps/server/src apps/server/src
COPY --from=web /app/apps/web/dist /app/web
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/hexa.db WEB_DIR=/app/web
USER node
EXPOSE 8787
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--max-old-space-size=128", "apps/server/src/index.ts"]
