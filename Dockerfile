FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY server.ts start-server.ts skill.md THIRD_PARTY_NOTICES.md LICENSE ./
COPY lib ./lib
COPY data ./data
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --create-home --uid 10001 lineage && mkdir -p /tmp/evidiq-lineage-artifacts && chown lineage:lineage /tmp/evidiq-lineage-artifacts && chmod 0700 /tmp/evidiq-lineage-artifacts
COPY --from=build --chown=lineage:lineage /app/package.json /app/package-lock.json ./
COPY --from=build --chown=lineage:lineage /app/node_modules ./node_modules
COPY --from=build --chown=lineage:lineage /app/dist ./dist
COPY --from=build --chown=lineage:lineage /app/data ./data
COPY --from=build --chown=lineage:lineage /app/skill.md /app/THIRD_PARTY_NOTICES.md /app/LICENSE ./
USER lineage
EXPOSE 3000
CMD ["node", "dist/start-server.js"]
