---
description: "Task list for root Docker Compose orchestration and backend cleanup"
---

# Tasks: Root Compose Dev Stack and Backend Cleanup

**Input**: Design documents from `/specs/004-root-compose-orchestration/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/local-runtime-compose.md](./contracts/local-runtime-compose.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested in spec — verification via [quickstart.md](./quickstart.md) manual checks and compose smoke only.

**Organization**: Phases follow user story priorities (P1 → P2); setup and foundational work blocks story execution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label ([US1], [US2], [US3]) for story phases only

## Path Conventions

- Repository root: `/home/abdallah/Projects/freelance/hotelmanangement/`
- Web app: `backend/`, `frontend/`, `infra/`

---

## Phase 1: Setup (Discovery)

**Purpose**: Find coupling to old compose location before moving files.

- [X] T001 [P] Search `.github/workflows/` and repository root shell scripts for references to `backend/docker-compose.yml` or `cd backend` + `docker compose`
- [X] T002 [P] Read `specs/004-root-compose-orchestration/contracts/local-runtime-compose.md` and note required service names, profiles, and ports for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Root compose and env templates MUST exist before user stories are accepted.

**⚠️ CRITICAL**: No user story phase should be marked complete until this phase’s compose file validates with `docker compose config` from repository root.

- [X] T003 Create `/home/abdallah/Projects/freelance/hotelmanangement/docker-compose.yml` by porting services from `backend/docker-compose.yml` with `build.context` `./backend`, volume mounts to `./backend`, and preserved profiles (`workers`, `infra`, `tools`)
- [X] T004 Add `frontend` service to `/home/abdallah/Projects/freelance/hotelmanangement/docker-compose.yml` with build or image strategy for Node 18+, command to run `npm run dev`, bind mount `./frontend`, and published dev port (align with [contracts/local-runtime-compose.md](./contracts/local-runtime-compose.md))
- [X] T005 Update `/home/abdallah/Projects/freelance/hotelmanangement/frontend/vite.config.js` so `server.host` is `0.0.0.0` (and `server.port` matches compose port mapping)
- [X] T006 Document `VITE_API_URL` (or equivalent) for browser-to-API access in `/home/abdallah/Projects/freelance/hotelmanangement/frontend/.env.example` and ensure `docker-compose.yml` passes env to `frontend` if required
- [X] T007 Create `/home/abdallah/Projects/freelance/hotelmanangement/.env.example` at repository root listing variables used by root compose (database, RabbitMQ, JWT, ports, optional QloApps)

**Checkpoint**: Run `docker compose config` from repository root with no errors; then proceed to User Story 1.

---

## Phase 3: User Story 1 - One-command full-stack local development (Priority: P1) 🎯 MVP

**Goal**: From repository root, default `docker compose up` brings up API, Vite frontend, PostgreSQL, and RabbitMQ; optional profiles documented.

**Independent Test**: Follow [quickstart.md](./quickstart.md) §1–§3; UI and API health succeed; migrate/seed via `tools` profile.

### Implementation for User Story 1

- [X] T008 [US1] Smoke-test `/home/abdallah/Projects/freelance/hotelmanangement/docker-compose.yml` with `docker compose up -d` from repository root; fix networking, depends_on, and healthchecks until `api` and `frontend` reach running state alongside healthy `postgres` and `rabbitmq`
- [X] T009 [US1] From repository root run `docker compose --profile tools run --rm migrate` and `docker compose --profile tools run --rm seed`; document one-time order and failures in `backend/README.md` or root `README.md`
- [X] T010 [US1] Update `/home/abdallah/Projects/freelance/hotelmanangement/docs/ARCHITECTURE.md` Development Runtime section to describe root `docker-compose.yml`, default stack, and profiles (`workers`, `infra`, `tools`)
- [X] T011 [P] [US1] Update `/home/abdallah/Projects/freelance/hotelmanangement/backend/README.md` so every compose example runs from repository root (no `backend/docker-compose.yml` as primary path)
- [X] T012 [P] [US1] Update `/home/abdallah/Projects/freelance/hotelmanangement/README.md` with the primary full-stack dev flow using root compose
- [X] T013 [P] [US1] Update `/home/abdallah/Projects/freelance/hotelmanangement/frontend/README.md` if it documents starting the UI only — cross-link root compose

**Checkpoint**: MVP = Phase 1 + Phase 2 + Phase 3 complete; new developer can follow docs and reach working UI + API.

---

## Phase 4: User Story 2 - Production-style overlay (Priority: P2)

**Goal**: `docker compose -f docker-compose.yml -f docker-compose.prod.yml` yields production-oriented services; docs cover secrets and relation to `infra/docker/`.

**Independent Test**: [quickstart.md](./quickstart.md) §4; merged config has no dev bind mounts on API/workers; `NODE_ENV=production` where appropriate.

### Implementation for User Story 2

- [X] T014 [US2] Create `/home/abdallah/Projects/freelance/hotelmanangement/docker-compose.prod.yml` overriding `api` and worker services to use `backend/Dockerfile`, remove dev volume mounts, set production env defaults, and keep postgres/rabbitmq definitions compatible with merge rules
- [X] T015 [US2] Document merge command, required env files, host-exposed ports, and prohibition of dev-only flags (e.g. default hotel bypass) in `/home/abdallah/Projects/freelance/hotelmanangement/docs/ARCHITECTURE.md` and/or `/home/abdallah/Projects/freelance/hotelmanangement/infra/DEPLOYMENT_CHECKLIST.md`
- [X] T016 [P] [US2] Update `/home/abdallah/Projects/freelance/hotelmanangement/infra/docker/docker-compose.prod.yml` comments or structure to reference root `docker-compose.yml` / `docker-compose.prod.yml` as source of truth (use Compose `include` if supported, or document path duplication policy per [research.md](./research.md))
- [X] T017 [P] [US2] Update `/home/abdallah/Projects/freelance/hotelmanangement/docs/IMPLEMENTATION_PHASE_PLAN.md` Primary Reference Inputs to include root `docker-compose.yml` and `docker-compose.prod.yml` alongside `infra/docker/docker-compose.prod.yml`

**Checkpoint**: Operators can follow docs for merge-based prod-like runs without breaking base dev workflow.

---

## Phase 5: User Story 3 - Simplified backend folder (Priority: P2)

**Goal**: No competing compose project under `backend/`; scripts and docs grep clean.

**Independent Test**: [quickstart.md](./quickstart.md) §5; `backend/docker-compose.yml` absent; `rg 'backend/docker-compose'` only yields intentional migration notes if any.

### Implementation for User Story 3

- [X] T018 [US3] Delete `/home/abdallah/Projects/freelance/hotelmanangement/backend/docker-compose.yml` after Phases 2–3 are verified (do not remove until T008–T009 pass)
- [X] T019 [P] [US3] Audit `/home/abdallah/Projects/freelance/hotelmanangement/backend/test-hotels-api.sh` — update default `BASE_URL`/paths for root compose or remove if superseded; ensure no stale references
- [X] T020 [P] [US3] Resolve `/home/abdallah/Projects/freelance/hotelmanangement/backend/setup-db.sh` per [research.md](./research.md): relocate to `scripts/` with clearer name and header for host-native Postgres **or** keep with updated documentation distinguishing Docker vs host workflows
- [X] T021 [P] [US3] Replace `backend/docker-compose.yml` citations in `/home/abdallah/Projects/freelance/hotelmanangement/specs/001-phase0-baseline-spec/quickstart.md`, `/home/abdallah/Projects/freelance/hotelmanangement/specs/002-reservation-checkout-lifecycle/tasks.md`, and any other `specs/**/*.md` matches from ripgrep
- [X] T022 [US3] Ripgrep `docs/`, `README.md`, `backend/README.md`, `infra/README.md`, and `infra/DEPLOYMENT_CHECKLIST.md` for `backend/docker-compose` and fix stale primary-path instructions

**Checkpoint**: Backend folder contains only justified Docker assets (Dockerfiles, `.dockerignore` if any) plus documented scripts.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contract alignment, CI, and quickstart exit criteria.

- [X] T023 Execute all sections of `/home/abdallah/Projects/freelance/hotelmanangement/specs/004-root-compose-orchestration/quickstart.md` and record pass/fail; fix implementation or docs for any failure
- [X] T024 [P] Sync `/home/abdallah/Projects/freelance/hotelmanangement/specs/004-root-compose-orchestration/contracts/local-runtime-compose.md` with final ports, service names, and profile behavior if they differ from the draft
- [X] T025 [P] Update `.github/workflows/` files (if T001 found hits) to use repository root `docker compose` commands and paths
- [X] T026 [P] Re-run `./.specify/scripts/bash/update-agent-context.sh cursor-agent` from repository root if stack or structure changed materially after implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** → **Phase 2**: Discovery informs whether T025 is needed early.
- **Phase 2** → **Phase 3–5**: Foundational compose and env templates block story acceptance.
- **Phase 3 (US1)** → **Phase 5 T018**: Do not delete `backend/docker-compose.yml` until US1 smoke and migrate/seed succeed.
- **Phase 4 (US2)** can start after Phase 2 (parallel with Phase 3 if staffed); recommend completing T008 before final prod overlay smoke.
- **Phase 6** → After all desired user story phases.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2; no dependency on US2/US3.
- **US2 (P2)**: Depends on Phase 2; independent of US3.
- **US3 (P2)**: Depends on Phase 2 and **US1 verification** (T008–T009) before T018.

### Parallel Opportunities

- **Phase 1**: T001 and T002 in parallel.
- **US1**: T011, T012, T013 in parallel after T008–T010 sequencing as needed.
- **US2**: T016 and T017 in parallel after T014–T015.
- **US3**: T019, T020, T021 in parallel after T018.
- **Phase 6**: T024, T025, T026 in parallel after T023.

### Parallel Example: User Story 1

```bash
# After T008–T010 land, run in parallel:
# T011 backend/README.md
# T012 README.md
# T013 frontend/README.md
```

### Parallel Example: User Story 3

```bash
# After T018 deletes backend compose:
# T019 test-hotels-api.sh
# T020 setup-db.sh / scripts/
# T021 specs/**/*.md updates
# Then T022 cross-doc grep
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2  
2. Complete Phase 3 (US1)  
3. Stop and run [quickstart.md](./quickstart.md) §1–§3 + migrate/seed  
4. Demo / hand off before US2–US3

### Incremental Delivery

1. Foundational compose → US1 docs + smoke → MVP  
2. Add US2 overlay + deployment doc links → prod-like validation  
3. Add US3 cleanup + grep hygiene → reduced support noise  
4. Polish phase + maintainer doc review (spec SC-003)

### Parallel Team Strategy

- Developer A: Phase 2–3 (compose + US1 docs)  
- Developer B: Phase 4 (overlay + infra doc) after Phase 2 `docker-compose.yml` stable  
- Developer C: Phase 5 after US1 verified — script audit and spec reference updates

---

## Notes

- Do not commit real secrets; only `.env.example` and documented placeholders.  
- If `Dockerfile_all` is unused after overlay work, handle in a follow-up — out of spec unless blocking.  
- Format validation: every story-phase task includes `[US#]` and an absolute or repo-root-relative file path in the description.
