# Feature Specification: Phase 0 PMS Baseline

**Feature Branch**: `001-phase0-baseline-spec`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "Analyze codebase and the current frontend/src/pages and backend/src to create a baseline spec for Phase 0, using IMPLEMENTATION_PHASE_PLAN.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish Current Product Baseline (Priority: P1)

As a product owner, I need a validated baseline of what the current PMS already supports so
that planning and prioritization are based on real behavior instead of assumptions.

**Why this priority**: Phase 0 depends on understanding current capabilities before any design
or implementation decisions.

**Independent Test**: Review the baseline document and verify that each listed capability
maps to at least one observable UI flow and one backend service area.

**Acceptance Scenarios**:

1. **Given** the current frontend pages and backend modules, **When** baseline analysis is
   completed, **Then** core capabilities are documented by domain (reservations, guests,
   rooms, invoicing, housekeeping, maintenance, reporting, settings, audit).
2. **Given** each documented capability, **When** reviewers inspect traceability, **Then** each
   capability has evidence from both user-facing flow and backend service ownership.

---

### User Story 2 - Identify Gaps Against Core PMS Scope (Priority: P2)

As a delivery lead, I need a clear gap matrix between required core PMS behaviors and current
implementation so that future phases can prioritize high-impact completion work.

**Why this priority**: Core PMS completion is explicitly required before deep channel-manager
work, so missing core behavior must be visible and ranked.

**Independent Test**: Compare baseline coverage with required core PMS use cases and confirm
that each high-priority gap has a severity and target phase recommendation.

**Acceptance Scenarios**:

1. **Given** the required core PMS workflows in the phase plan, **When** gaps are mapped,
   **Then** missing or partial behaviors are tagged as Must/Should/Could with rationale.
2. **Given** known technical debt or flow mismatches, **When** the gap matrix is reviewed,
   **Then** each item identifies scope impact and whether it blocks Phase 1 or Phase 2.

---

### User Story 3 - Confirm Security and Integration Risk Baseline (Priority: P3)

As an operations and security stakeholder, I need baseline visibility into security and
integration risks so that production readiness gates are explicit early in planning.

**Why this priority**: Security is a hard gate before go-live and integration complexity can
   cause hidden delivery risk if not identified during baseline analysis.

**Independent Test**: Validate that baseline output includes a risk list covering access
control, tenant isolation, auditability, and external synchronization reliability concerns.

**Acceptance Scenarios**:

1. **Given** authentication, authorization, and auditing behavior in the current code,
   **When** baseline risk review is completed, **Then** risk items and affected domains are
   explicitly documented.
2. **Given** channel sync and worker behavior, **When** baseline integration risk is assessed,
   **Then** incomplete, deferred, or potentially unstable paths are identified with impact notes.

---

### Edge Cases

- What happens when a capability exists in backend services but is not exposed clearly in the UI?
- How does baseline classification handle partially implemented workflows that are present but not
  production-ready?
- What happens when role restrictions differ across modules for similar administrative actions?
- How are integration features treated when core PMS dependencies are incomplete?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The baseline MUST document all currently implemented user-facing PMS domains from
  existing frontend pages and map each domain to backend ownership.
- **FR-002**: The baseline MUST classify each core PMS workflow as fully supported, partially
  supported, or unsupported based on observable behavior.
- **FR-003**: The baseline MUST produce a prioritized gap matrix using Must/Should/Could tags
  for Phase 0 planning output.
- **FR-004**: The baseline MUST identify and document inconsistencies across UI flow, API
  behavior, lifecycle states, and role enforcement where they affect core operations.
- **FR-005**: The baseline MUST capture security-relevant findings that can influence release
  gate readiness, including access control, auditability, and secret-handling concerns.
- **FR-006**: The baseline MUST identify integration dependency risks related to external sync
  behavior and operational reliability, while keeping deep integration design out of Phase 0.
- **FR-007**: The baseline MUST define traceability links from high-priority use cases to current
  implementation evidence and identified gaps.
- **FR-008**: The baseline MUST provide recommended Phase 1 design focus areas derived directly
  from the gap matrix and risk findings.

### Traceability & Constraints *(mandatory)*

- **P1/P2 linkage**:
  - FR-001, FR-002 -> User Story 1 acceptance scenarios 1 and 2
  - FR-003, FR-004, FR-007, FR-008 -> User Story 2 acceptance scenarios 1 and 2
  - FR-005, FR-006 -> User Story 3 acceptance scenarios 1 and 2
- **Change scope**: This feature defines analysis outputs only; it does not require immediate
  schema, API, or UI behavior changes.
- **Documentation obligations**: Findings from this baseline are expected to feed subsequent
  updates in `docs/USE_CASES.md`, `docs/ARCHITECTURE.md`, and design artifacts created in Phase 1.
- **Scope confirmation**: This is core PMS scope first; channel integration is included only for
  baseline risk and dependency visibility, not deep design.
- **Security implications to validate before production**: role consistency, tenant boundary
  enforcement, audit coverage, auth/session hardening, secret protection, and backup/restore
  readiness evidence.

### Key Entities *(include if feature involves data)*

- **Capability Baseline Item**: Represents one currently implemented business capability, with
  fields for domain, supporting UI flows, supporting backend ownership, and support status.
- **Gap Matrix Item**: Represents one required behavior not fully satisfied, with fields for
  priority class, severity, scope impact, and target phase recommendation.
- **Risk Finding**: Represents one security or integration concern, with fields for impacted area,
  observed behavior, potential impact, and mitigation direction.
- **Traceability Link**: Represents a mapping between use case, existing implementation evidence,
  and gap/risk records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of high-priority core PMS use cases have a baseline status
  (supported/partial/unsupported) with traceable evidence.
- **SC-002**: 100% of identified high-priority gaps include priority class, impact statement, and
  recommended next phase.
- **SC-003**: Baseline review participants can locate supporting evidence for at least 95% of
  documented capabilities and gaps without additional implementation discovery.
- **SC-004**: Stakeholders can approve or reject Phase 1 scope in one review cycle based on the
  baseline output, with no critical unknowns left in core PMS scope.

## Assumptions

- The existing frontend pages and backend service modules represent the current source of truth
  for product capability discovery.
- Phase 0 baseline work is documentation and analysis only; remediation is deferred to later
  implementation phases.
- Existing use cases and architecture docs are available and can be updated after baseline
  validation.
- Current role model and tenant model are intended for production, unless explicitly identified as
  temporary in baseline findings.
