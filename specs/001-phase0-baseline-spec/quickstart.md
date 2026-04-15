# Phase 0 Baseline Verification: Developer Quickstart

**Feature**: Phase 0 PMS Baseline  
**Branch**: `001-phase0-baseline-spec`  
**Date**: 2026-04-14  
**Purpose**: Verify the current system baseline is runnable and that key implemented flows
work end-to-end before proceeding to Phase 1 design.

---

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and npm
- Ports available: `8000` (API), `5432` or `HOST_DB_PORT` (PostgreSQL on host), `5672`/`15672` (RabbitMQ), `5173` (frontend)

---

## 1. Start stack (repository root)

All `docker compose` commands run from the **repository root** (not `backend/`).

```bash
cp .env.example .env          # sets COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml; adjust HOST_DB_PORT if 5432 is busy
docker compose up -d          # postgres, rabbitmq, api, frontend (Vite with bind mounts)
docker compose ps             # wait until postgres + rabbitmq are healthy, api + frontend running
```

---

## 2. Run migrations and seeds

```bash
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
```

Expected: migrations complete without errors, seed data inserts baseline rooms/users.

---

## 3. API and frontend URLs

- API: `http://localhost:8000`
- Frontend (container): `http://localhost:5173` with `VITE_API_URL` defaulting to `http://localhost:8000/api` for the browser

Optional workers + QloApps:

```bash
docker compose --profile workers up -d
docker compose --profile infra up -d    # optional local QloApps image
```

Alternatively, run **backend only** on the host (no Docker API):

```bash
cd backend && npm install && npm run dev
```

---

## 4. Frontend on the host (optional)

If you prefer not to use the compose `frontend` service:

```bash
cd frontend && npm install && npm run dev
```

Frontend available at `http://localhost:5173`.

---

## 5. Baseline Smoke Checks

Run these checks manually or via a REST client (e.g., curl / Postman / Bruno).

### 5.1 Authentication (UC-001)

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotel.com","password":"admin123"}'
```

Expected: `200 OK` with `access_token`, `refresh_token`, and `user.role`.

---

### 5.2 Hotel Context Header

All subsequent requests require:
```
Authorization: Bearer <access_token>
X-Hotel-Id: <hotel_uuid>
```

Retrieve your hotel ID from the seed data or via:
```bash
curl http://localhost:8000/api/v1/hotels \
  -H "Authorization: Bearer <token>"
```

---

### 5.3 Room Listing (UC-202, UC-205)

```bash
curl "http://localhost:8000/api/v1/rooms" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>"
```

Expected: `200 OK` with paginated list of rooms with `status`, `room_number`, `floor`.

---

### 5.4 Room Type Availability (UC-310)

```bash
curl "http://localhost:8000/api/v1/room-types/availability?check_in=2026-05-01&check_out=2026-05-05" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>"
```

Expected: `200 OK` with available room types and unit counts.

---

### 5.5 Create Reservation (UC-301)

```bash
curl -X POST http://localhost:8000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>" \
  -d '{
    "room_id": "<room_uuid>",
    "primary_guest_id": "<guest_uuid>",
    "check_in": "2026-05-01",
    "check_out": "2026-05-05",
    "total_amount": 400.00,
    "source": "Direct"
  }'
```

Expected: `201 Created` with reservation `id` and `status: Confirmed`.

---

### 5.6 Check-in (UC-305)

```bash
curl -X POST http://localhost:8000/api/v1/check-ins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>" \
  -d '{"reservation_id": "<reservation_uuid>"}'
```

Expected: `201 Created` with check-in record; reservation status should become `Checked-in`.

---

### 5.7 Check-out and Invoice Auto-generation (UC-306, UC-409)

```bash
curl -X POST "http://localhost:8000/api/v1/check-ins/<check_in_id>/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>" \
  -d '{"notes": "smooth checkout"}'
```

Expected: `200 OK`; reservation status becomes `Checked-out`; room status becomes `Cleaning`;
invoice should be created (verify via `GET /api/v1/invoices?reservation_id=<id>`).

---

### 5.8 Housekeeping Update (UC-504)

```bash
curl -X PUT "http://localhost:8000/api/v1/rooms/<room_id>/housekeeping" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>" \
  -d '{"status": "Clean"}'
```

Expected: `200 OK`; room housekeeping status is now `Clean`.

---

### 5.9 Audit Log Visibility (UC-901)

```bash
curl "http://localhost:8000/api/v1/audit?limit=10" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>"
```

Expected: `200 OK` with log entries showing CREATE/UPDATE actions from smoke-check operations.

---

### 5.10 Dashboard (UC-801)

```bash
curl "http://localhost:8000/api/v1/reports/stats" \
  -H "Authorization: Bearer <token>" \
  -H "X-Hotel-Id: <hotel_id>"
```

Expected: `200 OK` with occupancy counts, today's check-ins/outs, and revenue totals.

---

## 6. Phase 0 Exit Criteria Verification

After completing smoke checks, confirm the following:

| Exit Criterion | How to Verify |
|---|---|
| All high-priority use cases have baseline status | Review `docs/specs/00-gap-analysis.md` |
| Gap matrix complete with priority/phase tags | All rows in `00-gap-analysis.md` have Recommended Phase |
| Terminology conflicts resolved | Review `specs/001-phase0-baseline-spec/research.md` Section 6 |
| Schema drift documented | Review `specs/001-phase0-baseline-spec/data-model.md` drift table |
| Security risks enumerated | Review `research.md` Section 4 |
| Beds24 vs QloApps drift documented | `research.md` Section 3.1 and `docs/specs/00-gap-analysis.md` row UC-1001..UC-1008 |
| Phase 1 scope approved | Stakeholder sign-off on `IMPLEMENTATION_PHASE_PLAN.md` Phase 1 |

---

## 7. Known Issues to Note During Baseline Verification

| Issue | Where | Impact |
|---|---|---|
| `users_routes` missing `authenticateToken` | `backend/src/services/users/users_routes.ts` | User management endpoints may silently reject all requests |
| Invoice auto-generation reliability | Check-out flow; no DB trigger in test env | Manually verify invoice is created after each checkout |
| Housekeeping schedule view missing | Frontend RoomsPage | UC-506 not available in UI |
| Password reset flow missing | Login page and auth routes | UC-004 not available |
| Audit logs not hotel-scoped | `audit_controller.ts` | Reads may cross hotel boundaries |

---

## 8. Running Backend Tests

```bash
cd backend
npm test
```

Currently only `backend/src/services/check_ins/__tests__/check_ins_service.test.ts` exists.
Additional coverage is tracked as a Phase 2 requirement.

---

## 9. Code Quality Gates

```bash
cd backend
npm run lint          # ESLint
npm run format        # Prettier
npm run build         # TypeScript compile check
```

All three should pass before Phase 1 work begins.
