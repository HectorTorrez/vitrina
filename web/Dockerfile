# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f web/Dockerfile .
FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter vitrina-web
COPY web web
RUN pnpm --filter vitrina-web build \
 && pnpm --filter vitrina-web deploy --prod --legacy /out

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /out/node_modules node_modules
COPY --from=build /out/package.json /src/web/server.mjs ./
COPY --from=build /src/web/dist dist
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
