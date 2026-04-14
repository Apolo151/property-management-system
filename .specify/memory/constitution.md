<!--
Sync Impact Report
- Version change: 0.0.0-template -> 1.0.0
- Modified principles:
  - Template Principle 1 -> I. Preserve Existing Architecture
  - Template Principle 2 -> II. Core PMS Before Channel Expansion
  - Template Principle 3 -> III. Security as Release Gate (NON-NEGOTIABLE)
  - Template Principle 4 -> IV. End-to-End Traceability
  - Template Principle 5 -> V. Incremental, Testable Delivery
- Added sections:
  - Technical and Operational Constraints
  - Delivery Workflow and Quality Gates
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ reviewed (no command templates present): .specify/templates/commands/*.md
- Runtime guidance docs reviewed:
  - ✅ reviewed: README.md
  - ✅ reviewed: backend/README.md
  - ✅ reviewed: IMPLEMENTATION_PHASE_PLAN.md
- Follow-up TODOs:
  - None
-->
# Hotel Management System (PMS) Constitution

## Core Principles

### I. Preserve Existing Architecture
All implementation work MUST preserve the current repository architecture and technology
choices unless a documented exception is approved. Proposed deviations MUST include a
clear migration plan, compatibility impact, and rollback path.
Rationale: Stability and delivery speed depend on minimizing unnecessary architectural churn.

### II. Core PMS Before Channel Expansion
Teams MUST complete core PMS workflows (rooms, reservations, guests, billing, housekeeping,
maintenance, reporting, and audit consistency) before deep channel-manager expansion work.
Channel integration work MAY proceed only when it does not block or regress core workflows.
Rationale: Operational hotel value is delivered first by complete internal PMS capability.

### III. Security as Release Gate (NON-NEGOTIABLE)
Security controls are mandatory release gates for production. RBAC enforcement, session and
secret handling, auditability, data protection controls, and backup/restore readiness MUST be
verified before go-live approval.
Rationale: Production readiness is invalid without enforceable security and recovery controls.

### IV. End-to-End Traceability
Every high-priority requirement MUST map to a user scenario, implementation tasks, ownership,
and explicit acceptance criteria. Any change to schema, API contracts, or user behavior MUST
be reflected in docs and affected plans in the same milestone.
Rationale: Traceability prevents scope drift and ensures design-to-delivery consistency.

### V. Incremental, Testable Delivery
Work MUST be organized into independently testable increments with explicit phase exit
criteria. Each increment MUST include verification evidence for critical flows before advancing
to the next phase or deployment step.
Rationale: Incremental validation reduces integration risk and late-stage surprises.

## Technical and Operational Constraints

- The stack remains Node.js + TypeScript + Express + Knex + PostgreSQL for backend services,
  with the current frontend architecture and Docker Compose-based orchestration.
- Core functionality MUST remain operable without channel-manager dependency.
- Security and operational readiness (including backup/restore validation) are hard gates
  before production deployment.
- Integration design MUST include idempotency, retry, conflict handling, and reconciliation
  for external sync workflows.

## Delivery Workflow and Quality Gates

- Plans MUST define constitution gates before Phase 0 research and re-check gates after
  Phase 1 design.
- Specs MUST include prioritized, independently testable user stories and measurable success
  criteria.
- Tasks MUST be dependency-ordered, mapped to user stories, and include verification tasks for
  security, contracts, and critical end-to-end flows when applicable.
- Phase transitions require documented exit-criteria evidence; unresolved blockers or accepted
  risks MUST be explicit.

## Governance

This constitution is the highest process authority for this repository. Any plan, spec, task
list, or implementation decision that conflicts with this document is non-compliant until
updated or explicitly amended.

Amendment process:
- Proposed changes MUST include rationale, impacted principles/sections, and affected template
  updates.
- Amendments MUST be reviewed and approved by project maintainers before adoption.
- Versioning policy MUST follow semantic versioning for governance:
  - MAJOR: incompatible principle removals or redefinitions.
  - MINOR: new principle or materially expanded guidance.
  - PATCH: clarifications and editorial refinements with no policy change.

Compliance review expectations:
- Each implementation plan MUST contain a constitution check gate.
- Each pull request SHOULD reference relevant principle compliance in its description.
- Release readiness review MUST explicitly confirm Principle III and Principle IV compliance.

**Version**: 1.0.0 | **Ratified**: 2026-04-14 | **Last Amended**: 2026-04-14
