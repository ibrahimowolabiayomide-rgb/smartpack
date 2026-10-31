# SmartPack API container image. Build from the REPOSITORY ROOT, because the API depends on
# packages/shared and the pnpm lockfile lives at the root:
#
#   docker build -f apps/api/Dockerfile -t smartpack-api .
#
# The image runs the API only. Apply migrations as a separate step before (or when) deploying:
#
#   docker run --rm --env-file <your env file> smartpack-api node dist/database/migrate.js
#
# NOTE: this Dockerfile was written alongside the application but has not been built in the
# development environment used for Phase 1 (no Docker daemon was available). The bundle it
# produces (`pnpm deploy`) was verified to run on its own; see docs/DEPLOYMENT.md.

FROM node:22.23.4-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# Copy manifests first so dependency installation is cached until they change.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @smartpack/api...

COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @smartpack/shared build \
 && pnpm --filter @smartpack/api build \
 && pnpm --filter @smartpack/api deploy --legacy --prod /out

FROM node:22.23.4-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Run as the unprivileged user that ships with the node image.
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
