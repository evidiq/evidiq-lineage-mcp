#!/usr/bin/env bash
# Deploy EVIDIQ Lineage as a Docker container behind the shared Coolify Traefik
# proxy on the mcp.evidiq.dev box. Routed by PathPrefix(/lineage) with the prefix
# stripped, so the container still sees /mcp, /x402, /health. Secrets come from
# the env file, never baked into the image. Mirrors the sibling MCP deploys.
set -euo pipefail

IMAGE="${IMAGE:-evidiq-lineage:latest}"
NAME="${NAME:-evidiq-lineage}"
NETWORK="${NETWORK:-coolify}"
ENV_FILE="${ENV_FILE:-/root/evidiq-lineage.env}"
HOST_PORT="${HOST_PORT:-3005}"

docker rm -f "$NAME" >/dev/null 2>&1 || true

docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:${HOST_PORT}:3000 \
  --label 'traefik.enable=true' \
  --label 'traefik.http.middlewares.lineage-strip.stripprefix.prefixes=/lineage' \
  --label 'traefik.http.routers.lineage.middlewares=lineage-strip' \
  --label 'traefik.http.routers.lineage.rule=Host(`mcp.evidiq.dev`) && PathPrefix(`/lineage`)' \
  --label 'traefik.http.routers.lineage.tls=true' \
  --label 'traefik.http.routers.lineage.tls.certresolver=letsencrypt' \
  --label 'traefik.http.services.lineage.loadbalancer.server.port=3000' \
  "$IMAGE"

echo "started:"
docker ps --filter "name=^/${NAME}$" --format '{{.Names}}  {{.Status}}'
