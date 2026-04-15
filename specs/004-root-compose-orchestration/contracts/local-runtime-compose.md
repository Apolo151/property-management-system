# Contract: Local runtime (Docker Compose)

**Feature**: [spec.md](../spec.md)  
**Date**: 2026-04-15

This document is the **stable contract** for local orchestration after the root compose migration. Implementation may adjust port numbers if documented here and in `docs/ARCHITECTURE.md` together.

## Compose project

- **Primary entry**: repository root `docker-compose.yml` plus `docker-compose.dev.yml` (default via `COMPOSE_FILE` in `.env.example`).
- **Production-like merge**: `docker compose -f docker-compose.yml -f docker-compose.prod.yml …` (use explicit `-f`; do not rely on `COMPOSE_FILE` for this path).

## Services (minimum dev stack)

| Service | Role | Notes |
|---------|------|--------|
| `postgres` | PostgreSQL 16 | Healthcheck required; host bind uses `HOST_DB_PORT`→`5432` (default `5432`) so `DB_PORT` stays `5432` inside the stack |
| `rabbitmq` | AMQP + management UI | Healthcheck required |
| `api` | Express API | Dev: `Dockerfile.dev`, source bind mount to `backend/` |
| `frontend` | Vite dev server | Binds `0.0.0.0`; CORS/API base URL must match documented `VITE_*` or proxy |

## Profiles

| Profile | Services added / enabled |
|---------|---------------------------|
| *(default)* | `postgres`, `rabbitmq`, `api`, `frontend` |
| `workers` | `worker-inbound`, `worker-outbound`, `worker-scheduler` |
| `infra` | Optional QloApps (or equivalent) per architecture |
| `tools` | One-shot `migrate`, `seed` |

## Tools contract

- **`migrate`**: Runs `npm run db:migrate` with `DB_HOST=postgres` (or service DNS name on compose network).
- **`seed`**: Runs `npm run db:seed` with same DB connectivity assumptions.
- Both MUST remain on profile `tools` so default `up` does not run them automatically.

## Environment

- **Secrets**: Never committed; root `.env.example` lists keys only.
- **Production overlay**: Must use production-safe defaults; MUST NOT enable architecture-documented dev-only flags (e.g. default hotel bypass) unless file is explicitly named and documented as local-only (which would violate prod overlay intent — avoid).
- **Prod edge**: Merged `docker-compose.prod.yml` adds **Caddy** on `CADDY_HTTP_PORT` / `CADDY_HTTPS_PORT` (defaults 80/443). Site address is `PUBLIC_APP_DOMAIN`; SPA build should use `VITE_PROD_API_URL` (e.g. `https://<PUBLIC_APP_DOMAIN>/api`).

## External references

- Deployment-specific paths, nginx, and TLS: `infra/docker/docker-compose.prod.yml` and `infra/DEPLOYMENT_CHECKLIST.md` must stay consistent with this contract after updates.
