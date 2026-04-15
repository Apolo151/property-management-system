# Feature Specification: Root Compose Dev Stack and Backend Cleanup

**Feature Branch**: `004-root-compose-orchestration`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "Enhance the Docker Compose setup: root-level compose for full-stack development with a production overlay; clean up backend Docker/Compose and remove unneeded scripts; keep documentation aligned with `docs/`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-command full-stack local development (Priority: P1)

As a developer joining or returning to the project, I want to start the backend, frontend, and required backing services from the repository root using a single documented orchestration entry point, so that I do not hunt across folders or merge conflicting instructions.

**Why this priority**: This removes the highest day-one friction and matches the architecture expectation of profiles for API, data, messaging, workers, and optional local channel software.

**Independent Test**: From a clean clone (with only documented prerequisites installed), follow the updated developer guide; all services needed for routine UI + API development reach a healthy, reachable state without starting pieces manually from separate locations.

**Acceptance Scenarios**:

1. **Given** a developer has met documented prerequisites, **When** they run the documented root-level development command sequence, **Then** the API, web client, PostgreSQL, and RabbitMQ (and any other services declared as default for development) start and become ready per documented health checks.
2. **Given** the stack is running, **When** the developer follows documented URLs or ports, **Then** they can load the web client and exercise a basic authenticated or public flow without errors attributable to miswired service discovery.
3. **Given** optional heavy or channel-local dependencies (e.g. worker profiles, optional local PMS container), **When** the developer enables the documented optional profile or overlay, **Then** only those extra services start and documented ports and resource expectations apply.

---

### User Story 2 - Production-style run from the same project (Priority: P2)

As someone preparing a demo, staging, or single-host deployment, I want to layer production-oriented settings on top of the same compose project, so that development and production-like runs stay aligned without duplicating unrelated files.

**Why this priority**: Reduces drift between “works on my machine” and “runs like prod” and supports phased delivery goals for standardized deployment.

**Independent Test**: Using only documented commands, apply the production overlay to the base project and confirm stricter or production-appropriate behaviors (e.g. image-based services, non-dev bindings, documented secrets handling) without breaking the base development workflow when the overlay is not used.

**Acceptance Scenarios**:

1. **Given** the base development compose project, **When** the operator applies the documented production overlay command, **Then** services start with production-oriented configuration as described in deployment documentation (e.g. no accidental dev-only shortcuts unless explicitly documented).
2. **Given** the production overlay is documented to coexist with infrastructure references (e.g. reverse proxy, TLS termination), **When** operators follow the cross-linked runbook, **Then** they can reach the application through the documented external entry point.

---

### User Story 3 - Simplified backend folder (Priority: P2)

As a maintainer, I want the backend package to contain only Docker and helper assets that are still authoritative after the root move, so that contributors are not misled by obsolete scripts or duplicate compose definitions.

**Why this priority**: Duplicate or stale artifacts cause support load and wrong incidents; cleanup is a direct quality improvement.

**Independent Test**: List backend Docker-related files after the change; every remaining file has a documented purpose tied to either image build or a clearly scoped exception; removed scripts are absent from README and other guides.

**Acceptance Scenarios**:

1. **Given** the migration to root orchestration, **When** a contributor opens the backend folder, **Then** they do not find a second, competing compose project that contradicts root instructions.
2. **Given** scripts were removed, **When** someone searches documentation for old command names, **Then** they find no references—or explicit redirects to the new commands.

---

### Edge Cases

- Host port conflicts with already-running databases or brokers on default ports: documented detection and override variables or port mapping guidance.
- Missing or incomplete environment files: fail fast with a clear message and a pointer to the sample env template; no silent partial startup that looks healthy.
- Partial service failure (e.g. database up, broker down): documented how to identify the failing service and retry without corrupting state.
- Developer only needs a subset (e.g. API + DB, no UI): documented minimal profile or command variant without requiring the full stack.
- Optional local channel/PMS container: remains optional; default dev path does not force it unless the team explicitly documents otherwise.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a primary, root-level orchestration definition that can start, in one documented flow, the backend API, the web client, PostgreSQL, RabbitMQ, and any other services the product treats as default for day-to-day development.
- **FR-002**: The root orchestration MUST support optional groupings (profiles or equivalent) consistent with the product architecture: at minimum infrastructure (database, message broker), API, workers, and optional local channel software, so teams can enable only what they need.
- **FR-003**: The repository MUST provide a documented production overlay (or equivalent merge strategy) applied to the same base project, describing when to use it and how it differs from default development behavior (security, image usage, host exposure, secrets).
- **FR-004**: After consolidation, the backend package MUST NOT retain a competing primary compose project; any backend-local Docker assets that remain MUST be justified in documentation (e.g. image build context only).
- **FR-005**: Obsolete backend shell or helper scripts tied to the old layout MUST be removed unless repurposed with updated names and documentation; no dead references in README or guides.
- **FR-006**: `docs/ARCHITECTURE.md` (Development Runtime), `docs/IMPLEMENTATION_PHASE_PLAN.md` (file references under Primary Reference Inputs), and any developer-facing guide that today instructs `docker compose` from `backend/` MUST be updated in the same delivery so paths, commands, and profiles match the new layout.
- **FR-007**: Cross-links between root developer docs, deployment checklist, and infrastructure runbooks MUST be checked so a reader is never sent to a removed file or command without a replacement.

### Traceability & Constraints *(mandatory)*

| Priority | Requirement IDs | Acceptance scenarios (story) |
|----------|-----------------|------------------------------|
| P1 | FR-001, FR-002, FR-006, FR-007 | US1 |
| P2 | FR-003, FR-004, FR-005, FR-006, FR-007 | US2, US3 |

- **Schema / API / UI behavior**: No change to application schema, public API contracts, or end-user UI behavior is required by this feature; it is delivery and documentation alignment only.
- **Docs that MUST ship updated**: `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PHASE_PLAN.md`, `backend/README.md` (or its successor section in a root README if content moves), and `infra/` deployment docs if they reference backend-local compose paths.
- **Scope**: Core developer experience and operations documentation; out of scope for this spec: changing cloud Terraform beyond path references, redesigning CI pipelines unless required to invoke new compose entry points, or adding new application features.

- **Security-impacting notes**: Production overlay documentation MUST describe secrets handling (no committed secrets), which ports are exposed on hosts, and that production-equivalent runs must not enable non-production-only shortcuts (e.g. default tenant bypass) called out in architecture docs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with a standard team-issued laptop follows only the updated onboarding steps and reaches a working full-stack local environment (web client reachable, API health or equivalent check passes, database and broker reachable from services) in under 30 minutes, assuming network access for image pulls.
- **SC-002**: 100% of documented `docker compose` (or equivalent) commands referenced from `docs/` and the primary backend developer guide resolve to the new root entry point or explicitly documented overlay—zero stale references to a removed backend-only compose project as the primary path.
- **SC-003**: In a doc review checklist, at least two maintainers independently confirm that architecture “Development Runtime” text matches the actual profiles and default services (infra, API, workers, optional local channel) without contradiction.
- **SC-004**: Support-style questions classified as “wrong folder / wrong compose file / script not found” decrease in the first month after release compared to the prior baseline (measured by team retrospective or ticket tag, whichever the team already uses).

## Assumptions

- The existing architecture intent (PostgreSQL + RabbitMQ, optional workers and optional local QloApps-style container, multi-property context rules) remains unchanged; only where and how orchestration is invoked moves and is clarified.
- Frontend may continue to support host-based dev servers inside containers if that is already the team norm, provided the documented root flow still yields a single coherent story; fully containerizing the UI is optional unless already committed elsewhere.
- Production overlay may wrap or replace paths previously documented under `infra/docker/` as long as documentation and deployment checklists are updated together.
- “Unneeded scripts” means those made redundant by the root compose move or unused in CI; scripts still required for migrations, seeds, or one-off operations will move or be re-documented at the root, not silently deleted without a replacement story.
