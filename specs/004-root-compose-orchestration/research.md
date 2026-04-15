# Research: Root Compose Dev Stack and Backend Cleanup

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

## R1 — Base + production overlay mechanics

**Decision**: Use Docker Compose **multi-file merge** from the repository root:

- `docker-compose.yml` — development defaults (bind mounts, published DB/Rabbit ports, Vite, optional profiles).
- `docker-compose.prod.yml` (or `compose.prod.yaml` — team picks one extension; document it) — production-oriented overrides: `NODE_ENV=production`, production `Dockerfile` builds, stricter `depends_on`, remove dev bind mounts, optional nginx service or pointer to `infra/docker/` stack.

**Rationale**: Matches spec FR-003, keeps one service graph, avoids duplicating postgres/rabbitmq definitions. Compose v2 merge rules are well understood (`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`).

**Alternatives considered**:

- **Single file with extensive `profiles` for “prod”**: Rejected — prod differs in build, volumes, and secrets enough that a second file stays clearer and matches existing `infra/docker/docker-compose.prod.yml` mental model.
- **Only `infra/docker` prod, no root overlay**: Rejected — spec requires production overlay on the **same** project as dev; infra file can remain the VM-specific extension with paths updated to reference root base.

## R2 — Relationship to `infra/docker/docker-compose.prod.yml`

**Decision**: Treat **root** `docker-compose.prod.yml` as the **portable** production-like stack (API + workers + postgres + rabbitmq, production builds). Keep **infra** compose as the **VM deployment** variant that adds nginx, host `/data/*` volumes, and Let’s Encrypt mounts. Document that infra compose may use `include` (Compose 2.20+) or duplicate only the delta (nginx + volume paths) if `include` is unavailable in the team’s minimum Compose version — prefer `include` when supported.

**Rationale**: Satisfies spec alignment with deployment checklists without deleting infra artifacts in one shot.

**Alternatives considered**:

- **Delete infra compose and move everything to root**: Higher risk for Terraform/docs that already reference `infra/docker/`; defer unless tasks explicitly include it.

## R3 — Frontend in default dev stack

**Decision**: Add a **`frontend` service** in root `docker-compose.yml` with `build` or `image` + `command: npm run dev -- --host 0.0.0.0`, volume mount `./frontend`, and published port (e.g. `5173:5173`). Default **dev profile** includes `frontend` alongside `api`, `postgres`, `rabbitmq` so FR-001 “one documented flow” is satisfied.

**Rationale**: README currently states UI runs on host; spec requires full stack from root — containerized Vite is the smallest change that unifies instructions.

**Alternatives considered**:

- **Document “run frontend on host” as part of the single flow**: Weaker match to “all in compose”; still valid as a **documented profile** (e.g. `profile: host-frontend`) if containerized Vite causes friction — capture in tasks if issues arise.

## R4 — Build context and path rewrites

**Decision**: All services that today use `context: .` in `backend/docker-compose.yml` move to **`context: ./backend`** (and `dockerfile: Dockerfile.dev` or `Dockerfile` as appropriate) in root compose. Named volumes and network name can stay `hotel-network` or adopt a project-prefixed default from compose project name.

**Rationale**: Correct resolution of paths when compose file lives at repo root.

## R5 — Backend scripts cleanup

**Decision**:

- **`test-hotels-api.sh`**: Keep if still used for manual API smoke; update `BASE_URL` defaults and docs to assume root-compose ports. Remove only if redundant with another test entrypoint.
- **`setup-db.sh`**: **Host-native PostgreSQL** helper — not redundant with Docker migrate; either move to `scripts/` with a clear name (`setup-local-postgres.sh`) and document “optional, non-Docker” or keep in backend with updated header. Do **not** delete without documenting the alternative (compose `tools` profile).

**Rationale**: Spec FR-005 targets scripts **tied to old compose layout**, not every shell utility.

## R6 — Env file layout

**Decision**: Introduce or extend **root** `.env.example` listing variables shared across services; backend may keep `.env.docker` as a symlink target or merge into root example with a short migration note in `backend/README.md`.

**Rationale**: Single place for `docker compose` env interpolation from repo root.

## R7 — CI / automation

**Decision**: Out of scope unless an existing workflow hardcodes `backend/docker-compose.yml`; if found, update to root paths in the same PR as compose move.

**Rationale**: Matches spec out-of-scope for CI redesign.
