# Feature Specification: Documentation-then-product alignment (multi-property)

**Feature Branch**: `003-docs-code-alignment`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "define plan to align docs, then code"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operations staff trust property boundaries (Priority: P1)

Front-desk and operations staff work in one hotel property at a time. They must never see or change another property’s maintenance tickets, audit history, or operational records when using normal workflows.

**Why this priority**: Wrong property data is a confidentiality and operational integrity failure; it blocks safe multi-property rollout.

**Independent Test**: Using two properties with distinct data, a staff member assigned only to property A cannot obtain lists or details of property B’s maintenance or audit entries through the standard product UI or documented API usage.

**Acceptance Scenarios**:

1. **Given** a user is assigned only to property A and has selected property A as their active context, **When** they open maintenance and audit views, **Then** they only see records belonging to property A.
2. **Given** the same user, **When** they attempt to open a specific record identifier that belongs to property B, **Then** the product denies access or reports not found in line with documented rules (no data from property B is returned).
3. **Given** a user creates a maintenance request for a room, **When** the request is stored, **Then** it is associated with the same property as that room without manual property entry by the user.

---

### User Story 2 - Canonical documentation matches reality (Priority: P2)

Implementers, auditors, and new team members rely on the architecture overview, data dictionary, and API contract. Those documents must describe multi-property tenancy, property context rules, and exceptions (such as elevated roles) without contradicting the live schema descriptions or each other.

**Why this priority**: Misleading docs cause repeated defects and slow delivery; fixing docs first makes subsequent product work verifiable.

**Independent Test**: A reviewer can trace from “what is a tenant” through “how property context is established” to “which capabilities are global vs property-scoped” using only the canonical documentation set, with no section that asserts a single-property-only model unless explicitly marked historical.

**Acceptance Scenarios**:

1. **Given** the canonical database schema narrative, **When** it describes hotel settings and operational tables, **Then** it matches the intended multi-property model (one settings record per property, operational data scoped by property) and any legacy or historical excerpt is clearly labeled so it is not mistaken for current design.
2. **Given** the architecture overview, **When** a reader looks for tenancy and access boundaries, **Then** they find an explicit description of property context, how staff select a property, and which capabilities intentionally omit property context (for example, listing properties or global administration).
3. **Given** the published API contract for operational endpoints, **When** it states requirements for property context, **Then** those requirements match what the product is expected to enforce after alignment (including behavior when context is missing or invalid).

---

### User Story 3 - User administration matches documented access rules (Priority: P2)

Property administrators and global administrators manage users according to documented rules: authentication is always validated before role checks, and assignments to properties respect who may grant access to which properties.

**Why this priority**: Weak or inconsistent admin flows undermine RBAC and multi-property onboarding.

**Independent Test**: Attempts to manage users without a valid session are rejected; only appropriately authorized roles can assign users to properties they are allowed to manage, per documented rules.

**Acceptance Scenarios**:

1. **Given** an unauthenticated caller, **When** they invoke user administration actions described in the contract, **Then** they are rejected before any role check succeeds.
2. **Given** an authenticated administrator with access limited to specific properties, **When** they assign a user to a property outside that scope, **Then** the product rejects the assignment per documented rules.
3. **Given** an authenticated global administrator (as defined in documentation), **When** they assign users across properties, **Then** the action succeeds only where policy allows and is reflected in user–property assignments.

---

### Edge Cases

- User has access to multiple properties but has not selected an active property: the product must not silently assume a default property for operational actions; documented behavior applies (clear prompt or error).
- Elevated role can access any property: documentation and product behavior must agree on whether audit and maintenance views are still filtered when a property context is selected vs when operating in a global mode (if offered).
- Legacy or migrated data where historical records shared a single default property: documentation should note migration assumptions without implying ongoing single-tenant operation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Canonical documentation MUST describe the multi-property tenant model (property as the scope for operational data) and MUST identify which user-facing capabilities are property-scoped vs global.
- **FR-002**: Canonical documentation MUST not present obsolete single-property schema excerpts as the current design unless clearly marked as historical reference.
- **FR-003**: The product MUST enforce property scoping for maintenance operations (list, view, create, update) consistent with the documented rules and the property of the underlying room or resource.
- **FR-004**: The product MUST enforce property scoping for audit log retrieval (list and single-record access) consistent with documented rules for the caller’s role and selected property context.
- **FR-005**: User administration endpoints MUST validate an authenticated session before evaluating role permissions, and MUST enforce documented rules for which administrators may assign users to which properties.
- **FR-006**: When an operational request lacks a valid property context where the contract requires one, the product MUST fail in a documented, predictable way (not by silently using another property’s data).
- **FR-007**: Any change to property-context rules or schema meaning in a release MUST update the same release’s canonical documentation (architecture, schema narrative, API contract as applicable) so they remain mutually consistent.

### Traceability & Constraints *(mandatory)*

| Requirement | Acceptance scenarios | Doc / contract updates in milestone |
|-------------|----------------------|-------------------------------------|
| FR-001, FR-002 | Story 2 (all) | `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, `specs/001-phase0-baseline-spec/contracts/core-api.md` (or successor contract doc) |
| FR-003 | Story 1 (1, 3), Edge (migration note) | Contract doc, optional `docs/specs/00-gap-analysis.md` status refresh |
| FR-004 | Story 1 (1–2), Edge (elevated role) | Contract doc, `docs/ARCHITECTURE.md` |
| FR-005 | Story 3 (all) | Contract doc |
| FR-006 | Story 1, Edge (no active property) | Contract doc, `docs/ARCHITECTURE.md` |
| FR-007 | All stories | All touched canonical docs |

- **Scope**: Core PMS and internal administration only; channel-manager integration behavior is out of scope except where documentation must clarify boundaries between property-scoped PMS data and integration configuration.
- **Security validation**: Property isolation, admin authentication ordering, and audit visibility MUST be included in pre-production verification for this feature. No change to backup/restore or encryption assumptions unless documentation currently contradicts practice.

### Key Entities *(include if feature involves data)*

- **Property (hotel)**: The tenant boundary for operational data; staff may be assigned to one or many.
- **Operational record**: Maintenance requests, audit log entries, and similar items that MUST belong to exactly one property for routine use.
- **User–property assignment**: Links a user account to the properties they may access; governs what an administrator may grant.
- **Canonical documentation set**: The agreed references (architecture, schema narrative, API contract) that define expected behavior for implementers and operators.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a defined acceptance suite covering at least two properties, 100% of property-scoped maintenance and audit checks pass (no cross-property reads or writes for property-limited roles).
- **SC-002**: Within one structured documentation review (checklist-based), zero unresolved contradictions remain between the architecture overview, schema overview, and API contract regarding property context and multi-property tenancy.
- **SC-003**: At least three independent scenarios (maintenance list, audit list, user administration) demonstrate that unauthenticated access is rejected before role evaluation, verified by test or controlled demonstration.
- **SC-004**: For staff with a single property assignment, 100% of sampled operational tasks complete without requiring knowledge of another property’s identifiers (no dependency on “knowing” foreign property IDs to work).

## Assumptions

- Documentation corrections are completed or released in the same delivery sequence before or together with product behavior changes, so verification always compares code to an updated canonical doc set.
- “Global administrator” and “property-scoped administrator” behaviors follow the existing RBAC model already described in project materials; this feature aligns docs and product to that model rather than inventing a new permission matrix.
- A development-only escape hatch for missing property context (if any) is acceptable only if it is explicitly non-production and documented as such; production behavior follows FR-006.
- Frontend or client applications will obtain and send a stable property context for operational calls after login when the user has a current property, consistent with the documented contract.
