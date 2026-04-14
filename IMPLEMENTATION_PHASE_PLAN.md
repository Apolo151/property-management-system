# PMS Implementation Phase Plan

## Purpose
This plan defines implementation phases to complete the Hotel PMS with clear outcomes, deliverables, and exit criteria for each phase.

## Guiding Constraints
- Preserve the current stack and architecture patterns already used in this repository.
- Complete core PMS workflows before deep channel-manager implementation.
- Treat security as a hard gate before production deployment.
- Keep requirements traceable to use cases and current frontend/backend behavior.

## Phase 0: Business Domain Definition
### Scope
- Review system goals and requirements from existing use cases.
- Research popular PMS products, with focused analysis of QloApps PMS and channel workflows.
- Define and standardize business terminology and core domain rules.
- Use current frontend pages/features as baseline for expected product scope.

### Clear Outcome
A validated domain baseline exists, with agreed terminology, prioritized features, and a gap matrix between current implementation and required behavior.

### Deliverables
- Domain glossary and terminology dictionary.
- Prioritized requirements list (Must/Should/Could).
- Competitive findings summary (QloApps-focused).
- Feature gap matrix (use cases vs implemented features).

### Exit Criteria
- All high-priority use cases have business-level acceptance definitions.
- Terminology conflicts are resolved and documented.
- Scope for Phase 1 design is approved.

## Phase 1: High-Level Design (No Channel Manager Details)
### Scope
- Produce ERD (core PMS domain only).
- Produce UI page map and navigation flow.
- Produce API endpoint map and module boundaries.
- Confirm architecture remains aligned with current tech stack.

### Clear Outcome
The system blueprint is approved for core PMS development, including data model, UI information architecture, and API surface.

### Deliverables
- ERD v2 for core modules.
- UI page/flow diagrams.
- API endpoint inventory with ownership per module.
- Design assumptions and tradeoff log.

### Exit Criteria
- ERD, UI, and API diagrams are mutually consistent.
- No unresolved design blockers remain for core module implementation.
- Stakeholder signoff for moving to execution.

## Phase 2: Core PMS Completion (Non-Channel)
### Scope
- Complete high-priority core workflows across rooms, reservations, guests, invoices/payments, housekeeping, maintenance, reporting, and audit consistency.
- Resolve schema/API/UI lifecycle mismatches (states, enums, transitions).
- Add missing UX and backend logic for critical operational paths.

### Clear Outcome
Core hotel operations run end-to-end without channel-manager dependency, and all critical use cases are functionally complete.

### Deliverables
- Completed backlog for critical core use cases.
- Updated schema/contracts for lifecycle consistency.
- Test cases for completed core workflows.
- Updated module-level documentation.

### Exit Criteria
- All high-priority non-channel use cases pass acceptance checks.
- Core operational flows are stable (reservation -> check-in -> check-out -> invoice).
- Audit logging and role checks are validated for core actions.

## Phase 3: Channel Manager (QloApps) Architecture and Mapping
### Scope
- Review QloApps PMS and channel-manager docs in detail.
- Design and implement mapping layer between local entities and QloApps entities.
- Extend schema/models with sync metadata and conflict-handling fields.
- Define sync architecture (queueing, retries, idempotency, DLQ, reconciliation).

### Clear Outcome
Channel-sync architecture is defined and ready for reliable operation, with explicit data mapping and failure-handling strategy.

### Deliverables
- QloApps mapping specification.
- Sync sequence/state diagrams.
- Schema/model update plan for mapping and sync metadata.
- Conflict resolution and reconciliation runbook.

### Exit Criteria
- Every synced entity has a documented field mapping.
- Retry, conflict, and recovery behaviors are fully specified and testable.
- Integration design is approved for implementation/hardening.

## Phase 4: Security and Compliance Hardening
### Scope
- Validate RBAC and permission matrix.
- Verify auth/session/token policies and secret handling.
- Verify encryption, audit retention, and data protection controls.
- Establish backup/restore and incident response basics.

### Clear Outcome
Security and compliance controls are demonstrably enforced and become release gates, not optional tasks.

### Deliverables
- Security control checklist and evidence.
- RBAC matrix validation report.
- Backup/restore runbook and test results.
- Risk register with mitigations and owners.

### Exit Criteria
- Security baseline checks pass for all critical modules.
- Backup/restore drill succeeds.
- Open high-risk issues are either resolved or formally accepted.

## Phase 5: Developer Flow and Delivery Tooling
### Scope
- Standardize local dev orchestration with Docker Compose profiles.
- Add helper scripts for reset/migrate/seed/smoke checks.
- Improve developer docs and onboarding path.
- Define quality gates (lint, typecheck, tests, smoke).

### Clear Outcome
Any developer can set up, run, validate, and contribute to the system quickly and consistently.

### Deliverables
- Developer quickstart and workflow docs.
- Script catalog with purpose and usage.
- CI/local quality gate checklist.
- Seed/test-data strategy documentation.

### Exit Criteria
- Clean machine onboarding works using docs only.
- Quality gates are reproducible and enforced.
- Dev flow supports API + worker services reliably.

## Phase 6: Deployment and Operations
### Scope
- Finalize single-VM cloud deployment using Docker Compose and reverse proxy.
- Align Terraform resources and runtime topology.
- Define release, rollback, monitoring, and day-2 operations.
- Document production configuration and operational responsibilities.

### Clear Outcome
Production deployment is repeatable, observable, and recoverable, with clear runbooks for operation and rollback.

### Deliverables
- Deployment architecture document.
- Terraform/deployment checklist.
- Production runbook (release, rollback, incidents, maintenance).
- Monitoring/logging and health-check baseline.

### Exit Criteria
- Deployment can be executed from documented steps.
- Rollback procedure is tested successfully.
- Operational runbooks are complete and owned.

## Phase 7: Verification, UAT, and Go-Live Readiness
### Scope
- Execute full functional and integration verification.
- Run role-based UAT scenarios from use cases.
- Validate performance and security acceptance thresholds.
- Produce final launch readiness decision.

### Clear Outcome
The system is proven ready for go-live with documented evidence, approved signoffs, and known residual risks.

### Deliverables
- Verification and UAT evidence pack.
- Performance/security validation summary.
- Go-live checklist and signoff record.
- Residual risk register.

### Exit Criteria
- UAT passes for representative role-based workflows.
- Critical defects are closed or formally deferred.
- Go-live decision is approved with evidence.

## Cross-Phase Governance
- Traceability: every high-priority use case maps to a phase, owner, and acceptance condition.
- Change control: design/schema/contract changes must update docs in the same milestone.
- Risk review: risks reviewed at each phase boundary.
- Release gate: security hardening and operational readiness are mandatory before production go-live.

## Suggested Sequence and Dependencies
1. Phase 0 -> Phase 1 (required)
2. Phase 1 -> Phase 2 (required)
3. Phase 2 -> Phase 3 (required)
4. Phase 3 and Phase 4 can overlap partially; Phase 4 must complete before Phase 6
5. Phase 5 starts once Phases 2-3 stabilize
6. Phase 6 follows Phase 4 and Phase 5
7. Phase 7 runs after implementation and deployment readiness are complete

## Primary Reference Inputs
- docs/USE_CASES.md
- docs/ARCHITECTURE.md
- docs/DATABASE_SCHEMA.md
- backend/src/routes.ts
- backend/src/integrations/qloapps/
- frontend/src/pages/
- backend/docker-compose.yml
- infra/main.tf
- infra/vm.tf
- infra/docker/docker-compose.prod.yml
