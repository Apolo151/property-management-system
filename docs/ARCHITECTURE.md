# Hotel PMS Backend Architecture

## Overview

The backend is a TypeScript + Express application for hotel operations.
It stores operational data in PostgreSQL and syncs channel-manager data with QloApps using RabbitMQ-backed workers.

Core runtime components:

- API server (`src/server.ts`)
- QloApps inbound worker (`src/integrations/qloapps/workers/inbound_worker.ts`)
- QloApps outbound worker (`src/integrations/qloapps/workers/outbound_worker.ts`)
- QloApps sync scheduler (`src/integrations/qloapps/workers/sync_scheduler.ts`)
- PostgreSQL
- RabbitMQ

## High-level Flow

```mermaid
flowchart LR
  frontend[Frontend] --> api[ExpressAPI]
  api --> postgres[(PostgreSQL)]
  api --> rabbitmq[(RabbitMQ)]
  rabbitmq --> inboundWorker[QloAppsInboundWorker]
  rabbitmq --> outboundWorker[QloAppsOutboundWorker]
  scheduler[QloAppsSyncScheduler] --> rabbitmq
  inboundWorker --> qloapps[QloAppsAPI]
  outboundWorker --> qloapps
  scheduler --> qloapps
  inboundWorker --> postgres
  outboundWorker --> postgres
  scheduler --> postgres
```

## API Layer

- App bootstrap: `src/server.ts` and `src/app.ts`
- Route aggregation: `src/routes.ts`
- Feature services live under `src/services/*` (auth, rooms, reservations, guests, invoices, settings, etc.)

Patterns currently used:

- Controllers + route modules per feature
- Knex query builder for persistence
- Shared auth and role middleware
- Non-blocking sync triggers for channel updates

## Integration Layer (QloApps only)

All integration logic is under `src/integrations/qloapps/`:

- `qloapps_client.ts`: HTTP client for QloApps API
- `services/*`: pull/push orchestration and sync services
- `queue/*`: exchange/queue topology, publisher, and consumer base
- `workers/*`: long-running consumers and scheduler
- `hooks/sync_hooks.ts`: application hooks used by domain controllers

### Queue Topology

The integration uses RabbitMQ topic exchange + durable queues with DLQ support.

- Exchange: QloApps events exchange
- Inbound queue: remote to local sync operations
- Outbound queue: local to remote sync operations
- Dead-letter queues for failed processing

This design keeps API writes fast and moves sync retries/error handling to workers.

## Data Layer

- PostgreSQL is the system of record for PMS data.
- Knex migrations and seeds define schema and baseline data.
- Sync state/mappings are persisted in dedicated tables for traceability and idempotency.

Important implementation detail:

- `src/config/database.ts` overrides PostgreSQL DATE parsing to preserve exact date strings and avoid timezone drift.

## Worker Model

### Inbound Worker

Consumes inbound QloApps events and applies changes to local PMS records.

### Outbound Worker

Consumes locally queued sync jobs and pushes updates to QloApps.

### Sync Scheduler

Runs periodic pull syncs for configured hotels with lock + backoff behavior.

## Development Runtime

`docker-compose.yml` supports:

- Default profile: API + PostgreSQL + RabbitMQ
- `workers` profile: QloApps workers
- `infra` profile: optional local QloApps container

Common local flow:

1. Start infrastructure
2. Run API
3. Run workers (or use combined dev script)

## Design Decisions

- Keep RabbitMQ: reliable async processing, retry behavior, and DLQ visibility
- Keep Knex migrations: predictable schema evolution
- Keep feature-oriented service structure: low coupling and readable boundaries
- Remove unused multi-provider abstractions until a second provider is required

## Multi-property tenancy

- **Tenant**: Each **hotel** row is an independent property. Operational data (rooms, reservations, guests, invoices, maintenance, audit rows, etc.) is scoped with `hotel_id`.
- **Property context**: Authenticated API requests that operate on tenant data use middleware **`hotelContext`** after **`authenticateToken`**. The client sends **`X-Hotel-Id`** with the active property UUID. **`SUPER_ADMIN`** may call any hotel they pass in the header; other roles must be linked in **`user_hotels`**.
- **Production**: Missing `X-Hotel-Id` on `hotelContext` routes returns **400** with `code: PROPERTY_CONTEXT_REQUIRED`. For local scripts and tests only, set **`ALLOW_DEFAULT_HOTEL=true`** (non-production) to allow the legacy default UUID; never enable in production.
- **Global routes (no hotel header)**: `/api/auth/*`, **`/api/v1/hotels`** (list/manage properties), and **`/api/v1/users`** (user admin uses JWT only; hotel assignment rules are enforced in the users service).
- **Frontend**: Users with multiple assigned properties must **select** an active hotel; the SPA stores it and sends `X-Hotel-Id` on operational calls.

## Out of Scope

The backend does not currently implement:

- Redis or Bull queues
- WebSocket realtime transport
- Multi-channel-manager strategy runtime

Any documentation or code claiming these as active architecture is outdated.
