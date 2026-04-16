# Hotel Management System (PMS)

Property Management System monorepo: **backend** (Express + Knex + PostgreSQL + RabbitMQ), **frontend** (React + Vite), and **infra** (Terraform + production compose under `infra/docker/`).

## Quick start (Docker, full stack)

From the **repository root**:

```bash
cp .env.example .env
# If port 5432 is already used on your machine, set e.g. HOST_DB_PORT=5434 in .env
# .env sets COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml for hot reload

docker compose up -d
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
```

- API: http://localhost:8000/api  
- Frontend: http://localhost:5173  
- RabbitMQ management: http://localhost:15672  

Optional: `docker compose --profile workers up -d`, `docker compose --profile infra up -d` (local QloApps).

Production-like stack (Caddy reverse proxy + TLS):

```bash
# Set PUBLIC_APP_DOMAIN, CADDY_EMAIL, VITE_PROD_API_URL in .env.production first
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Important: the root production-like stack uses [caddy/Caddyfile](caddy/Caddyfile) (SPA + API).
The file [infra/docker/caddy/Caddyfile](infra/docker/caddy/Caddyfile) is API-only for infra VM deployment and does not serve frontend SPA routes.

See `docs/ARCHITECTURE.md` (Development Runtime), `backend/README.md`, `caddy/Caddyfile`, and `infra/DEPLOYMENT_CHECKLIST.md` for details.

## Prerequisites

- Docker + Docker Compose v2 for the path above  
- Node.js 18+ (22+ recommended) for running `backend/` or `frontend/` directly on the host  

## Docs

- `docs/ARCHITECTURE.md` — system overview and tenancy  
- `docs/IMPLEMENTATION_PHASE_PLAN.md` — phased delivery  
- `specs/004-root-compose-orchestration/quickstart.md` — compose verification checklist  
