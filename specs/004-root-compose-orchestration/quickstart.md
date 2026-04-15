# Quickstart: Root Compose dev stack

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

Use this after implementation of [plan.md](./plan.md) to verify [spec.md](./spec.md) success criteria.

## Prerequisites

- Docker Engine + Docker Compose v2
- Ports available for Postgres (**set `HOST_DB_PORT` in `.env` if `5432` is taken**), RabbitMQ, API, Vite (see [contracts/local-runtime-compose.md](./contracts/local-runtime-compose.md))
- Copy root env template to `.env` and set secrets for non-dev runs

## 1. Full-stack dev (P1)

1. From **repository root**: `docker compose up -d` (or documented equivalent including default profiles).
2. Wait for healthchecks: `docker compose ps` — `postgres`, `rabbitmq`, `api`, `frontend` healthy or running per policy.
3. Open frontend URL (e.g. `http://localhost:5173`) and API health (e.g. `http://localhost:8000/health`).
4. Run migrate + seed once:  
   `docker compose --profile tools run --rm migrate`  
   `docker compose --profile tools run --rm seed`

**Pass**: UI loads; login or public flow works without wrong-host errors for API.

## 2. Workers profile (P1 optional)

1. `docker compose --profile workers up -d`
2. `docker compose logs -f worker-inbound` (and siblings) — no crash loop.

**Pass**: Workers stay up when broker and DB are healthy.

## 3. Infra profile (optional QloApps)

1. `docker compose --profile infra up -d` (if QloApps service present)
2. Confirm documented port and resource warning.

**Pass**: Service starts per docs; default dev flow does not require this profile.

## 4. Production overlay (P2)

1. `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` — validates merge.
2. Set `PUBLIC_APP_DOMAIN`, `CADDY_EMAIL`, and `VITE_PROD_API_URL` in `.env`; run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` on a throwaway machine or CI agent.
3. Confirm API uses production build (no backend source bind mount), `NODE_ENV=production`, and **Caddy** is listening on 80/443 with routes per `caddy/Caddyfile`.

**Pass**: Merged config matches [contracts/local-runtime-compose.md](./contracts/local-runtime-compose.md) security notes.

## 5. Backend folder cleanup (P2)

1. `test ! -f backend/docker-compose.yml` (or only a stub that prints deprecation — spec prefers removal).
2. `rg 'backend/docker-compose'` in `docs/`, `README`, `specs/` — expect zero primary-path hits; any hit must redirect to root.

**Pass**: No competing compose project; documentation grep clean.

## 6. Doc alignment (SC-002 / SC-003)

1. `docs/ARCHITECTURE.md` — “Development Runtime” matches actual profiles and default services.
2. `docs/IMPLEMENTATION_PHASE_PLAN.md` — Primary Reference Inputs list root compose paths, not `backend/docker-compose.yml` alone.
3. `backend/README.md` — all examples use root `docker compose` commands.

**Pass**: Maintainer doc review sign-off (two reviewers per spec SC-003).

## Exit criteria

- §1–§3 pass for routine development.
- §4 passes or has an explicit follow-up task if VM-only prod remains separate file.
- §5–§6 pass before marking feature complete.
