# Feature Specification: Backend and Documentation Alignment

**Feature Branch**: `005-backend-spec-alignment`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "Perform detailed analysis of the backend source code, compare it with the system specs in `docs/` and `docs/USE_CASES.md`, file by file, to find bugs, issues, misalignments, missing features, and anti-patterns; fix them and achieve a robust, minimal, simple setup."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trustworthy role-based access (Priority: P1)

A hotel operations lead needs the access described for each staff role in the canonical use-case document to match what the product actually allows or denies (including audit visibility and financial actions).

**Why this priority**: Incorrect or undocumented permissions create compliance risk, training confusion, and support incidents.

**Independent Test**: Using a fixed matrix of representative actions (view audit trail, create expense, manage users, check-in/out), verify that outcomes for each role match either the published role table or an explicit, same-release documentation exception.

**Acceptance Scenarios**:

1. **Given** a user with the Viewer role, **When** they attempt to view audit logs as described in the use-case catalog, **Then** the outcome matches the documented permission (access granted or denied) without contradiction across docs.
2. **Given** a user with the Front Desk role, **When** they attempt to create or update an expense, **Then** the outcome matches the documented actor list for expense management (default: **deny** if the doc excludes Front Desk), unless the use-case document was **explicitly** amended in the same release to grant that access.

---

### User Story 2 - Authentication promises match product (Priority: P1)

Any authenticated user needs self-service account flows that **`docs/USE_CASES.md`** lists as available (such as recovering access or changing credentials) to exist as **real, product-backed flows**; narrowing scope requires an **explicit** same-release revision of the use cases, not silent omission.

**Why this priority**: Authentication gaps block users and undermine trust in the specification.

**Independent Test**: Compare the authentication and account-management section of the use-case document against every self-service path; every listed capability is **implemented** or **formally revised** in the same release per stakeholder approval (default: **implement**).

**Acceptance Scenarios**:

1. **Given** the use-case catalog lists password reset for all users, **When** a user requests recovery and completes the documented flow, **Then** they can set a new password through the product, unless the use-case document was explicitly revised to defer that capability for this release.
2. **Given** the use-case catalog lists password change for authenticated users, **When** an authenticated user changes password, **Then** the operation succeeds through the product API and subsequent login uses the new credentials.

---

### User Story 3 - Integration and operations clarity (Priority: P2)

An administrator configuring channel integration needs canonical documentation to state honestly whether conflict resolution, mapping maintenance, sync logs, and manual sync are available through everyday product screens, through administrative tools only, or planned—without conflicting statements across architecture, gap analysis, and use cases.

**Why this priority**: Misaligned expectations drive failed rollouts and duplicate work.

**Independent Test**: For QloApps-related high-priority use cases (sync, conflicts, status, manual trigger, configuration), a reader of only `docs/` can classify each as UI-delivered, operator/API-only, or out of scope—and that classification matches observed product behavior.

**Acceptance Scenarios**:

1. **Given** the use-case document describes handling sync conflicts and viewing sync status, **When** an administrator reads architecture and gap analysis, **Then** they find no assertion that the main product UI covers workflows that are only available elsewhere unless that exception is explicit.
2. **Given** notifications are described as user-visible alerts with specific triggers, **When** operations staff open their notification list after a qualifying event (for example check-in day or maintenance assignment), **Then** those notifications exist as durable records they can list and mark read through the product, consistent with the use-case catalog.

---

### User Story 4 - Accurate operational edge cases (Priority: P2)

Front desk staff need documentation of check-in, check-out, and invoicing edge cases (including failures partway through a flow) to match real behavior—for example, what happens if invoicing cannot complete after a stay is closed.

**Why this priority**: Mismatches cause incorrect training and reconciliation errors.

**Independent Test**: Walk through documented check-out and invoice scenarios including failure paths; narrative in use cases or dedicated check-in/check-out documentation matches observed results.

**Acceptance Scenarios**:

1. **Given** a successful check-out with invoicing rules in the document, **When** invoice creation fails after checkout state changes, **Then** published documentation describes the resulting state and operator follow-up consistently with the product.

---

### User Story 5 - Documentation integrity (Priority: P3)

A new engineer onboarding to the repository needs core indexed documentation links (database schema, architecture references) to resolve to current locations without hunting.

**Why this priority**: Broken links waste time and hide authoritative sources.

**Independent Test**: From `docs/DOCUMENTATION_INDEX.md` and cross-references inside `USE_CASES.md`, all cited paths open the intended current document.

**Acceptance Scenarios**:

1. **Given** the use-case appendix links to database documentation, **When** a reader follows the link, **Then** they reach the maintained database document for this repository version.

---

### Edge Cases

- Multi-property context: permissions and documentation remain consistent when switching property context.
- Integration disabled or misconfigured: documented behavior for sync queueing and operator visibility remains accurate.
- Roles with overlapping duties: edge cases where a user holds multiple roles do not contradict the single-role matrices after alignment.
- Guest merge and duplicate handling: operators can complete a merge workflow that matches **UC-106**, or any intentional limitation must be an explicit product decision reflected in the same documentation set—not an undocumented gap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST enforce access control for operational features such that outcomes match the role and actor tables in `docs/USE_CASES.md` for the same release. **Normative intent lives in the docs**: where behavior today differs, **implementation MUST be corrected** unless stakeholders have explicitly revised the use-case document in the same release to record a new policy. *(Covers audit log access for Viewer vs implementation, expense creation roles vs implementation.)*
- **FR-002**: Every authentication-related use case marked as available to end users (including password reset and password change) MUST be satisfied by a **reachable flow in the product** that matches `docs/USE_CASES.md`. Deferral or scope reduction is permitted only when **`docs/USE_CASES.md` is explicitly amended** in the same release and no other core document still claims the capability as current.
- **FR-003**: Check-in and check-out rules (including date interpretation relative to the property) MUST be described consistently across operator-facing documentation and the gap analysis so staff are not trained on “calendar today” semantics if the product uses property-local dates.
- **FR-004**: For QloApps-related use cases (sync, conflicts, logs, manual sync, configuration), canonical documentation MUST classify each capability as delivered through primary product UI, delivered through API or operator-only tooling, or not available—with no two core documents asserting different classifications for the same capability.
- **FR-005**: Notifications MUST be **persisted and server-managed**: users MUST be able to view notifications and mark them read through capabilities backed by durable records, with creation tied to the operational events described in `docs/USE_CASES.md` (for example check-in/check-out reminders, maintenance and housekeeping alerts). Client-only synthesis MUST NOT be the sole source of truth for notification history.
- **FR-006**: Export and PDF-related use cases (reports, audit logs, invoices) MUST be **implemented as documented** in `docs/USE_CASES.md` for the current product version. Deferring or narrowing scope is permitted only through an **explicit, same-release** revision of the use-case document when stakeholders agree—not by leaving code incomplete while the doc still promises the capability.
- **FR-007**: Guest duplicate merge (**UC-106**) MUST be available as an operator workflow consistent with `docs/USE_CASES.md`. **Docs are authoritative** for intent; weakening the use case in documentation is only allowed when that is an explicit product decision in the same release, not as a shortcut to avoid implementation.
- **FR-008**: Cross-document references among indexed core files (`docs/DOCUMENTATION_INDEX.md`, `docs/USE_CASES.md`, architecture, schema, gap report, check-in API notes) MUST resolve to the current canonical paths after the alignment release.
- **FR-009**: How operational capabilities are grouped and versioned for integrators MUST be reflected consistently wherever the project lists those entry points, so readers are not directed to incorrect or obsolete locations.
- **FR-010**: Client connectivity and access rules that affect who may call operational entry points from untrusted origins MUST either match documented security expectations in non-functional requirements or those requirements MUST be revised to match the intentional posture for each deployment environment.

### Traceability & Constraints *(mandatory)*

| Priority | Requirement IDs | Primary acceptance coverage |
| --- | --- | --- |
| P1 | FR-001, FR-002 | User Stories 1–2 |
| P2 | FR-003–FR-007 | User Stories 3–4 |
| P3 | FR-008–FR-010 | User Story 5; cross-cutting |

- **Documentation that MUST be updated in the same milestone when behavior or scope changes**: `docs/USE_CASES.md`, `docs/PMS_USE_CASE_QLOAPPS_GAP_REPORT.md`, `docs/ARCHITECTURE.md`, `docs/DOCUMENTATION_INDEX.md`, `docs/CHECK_INS_API_DOCUMENTATION.md` (if check-in/out semantics change), database documentation at the repository’s canonical path, and any appendix links inside `USE_CASES.md` that reference moved files.
- **Scope**: Core PMS and QloApps integration alignment as described in `docs/`; this specification does not require parity with third-party product marketing beyond what `USE_CASES.md` already claims.
- **Security-impacting items to validate before production**: role matrices (FR-001), authentication self-service (FR-002), cross-client access assumptions (FR-010), audit visibility (FR-001), consistency of “all operational entry points require authentication” claims vs explicitly public endpoints such as health checks and sign-in.

### Key Entities *(include if feature involves data)*

- **Staff role**: Named responsibility level (Super Admin, Admin, Manager, Front Desk, Housekeeping, Maintenance, Viewer) tied to allowed operations.
- **Property context**: The hotel property whose data is being accessed; documentation and behavior must stay consistent for multi-property operation.
- **Audit event**: A record of a significant change; visibility must align with documented roles.
- **Notification**: User-visible alert **stored by the system**, scoped to property and recipient where applicable, with read state and timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Within one structured review (half day or less), a stakeholder can trace every High-priority use case in `docs/USE_CASES.md` to either verified product behavior or an explicit same-release deferral in the core documentation set, with zero unresolved contradictions.
- **SC-002**: A role-permission sample matrix of at least ten representative operations achieves **100% match** between **`docs/USE_CASES.md`** and observed allow/deny outcomes, achieved by **correcting implementation** (default) or by an **explicit, same-release** use-case amendment when the business changes policy.
- **SC-003**: Zero broken internal links among the files listed in `docs/DOCUMENTATION_INDEX.md` and the appendix of `docs/USE_CASES.md` after the alignment release.
- **SC-004**: For QloApps conflict, mapping, sync log, and manual sync capabilities, 100% of items can be classified by a reader as UI, API-only, or not available—with matching classification across `USE_CASES.md`, gap report, and architecture notes.
- **SC-005**: Qualitative: operations and engineering stakeholders report that “what the docs say” matches “what the product does” for authentication, RBAC, integration operations, and **server-backed notifications** in a joint sign-off session.

## Assumptions

- **`docs/USE_CASES.md` (and linked core docs) are the normative statement of product intent.** When code and docs disagree, **default to changing code** to match the documented intent. Amending documentation instead is reserved for **explicit** product or compliance decisions in the same release, not for papering over missing implementation.
- “Robust but minimal and simple” still applies: prefer the smallest **correct** implementation that satisfies the documented use case (for example one notifications table and a small API rather than a second message bus) rather than speculative features outside the doc set.
- Multi-property tenancy and property-scoped headers (as described in architecture) remain the operational model; alignment work does not redefine tenancy.
- Frontend coverage for API-only capabilities may lag if documentation clearly states API-only delivery; this specification still requires backend and documentation honesty for those capabilities.
- The alignment effort was informed by comparing published use cases and gap analysis to current product behavior and access rules; detailed file-by-file findings belong in implementation planning and tasks, not in this specification.
