# Hotel Property Management System (PMS) Architecture

## Overview

This document describes the architecture of a production-grade Property Management System (PMS) designed to integrate with the Beds24 channel manager. The system is built with scalability, reliability, and comprehensive audit logging in mind.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  React Frontend (SPA)                                                        │
│  - Dashboard, Rooms, Reservations, Calendar, Guests, Reports                │
│  - Real-time updates via WebSocket                                          │
│  - Optimistic UI updates with rollback                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Express.js API Server                                                       │
│  ├── Rate Limiting (express-rate-limit)                                     │
│  ├── Request Validation (Joi/Zod)                                           │
│  ├── Authentication (JWT + Refresh Tokens)                                  │
│  ├── Authorization (RBAC - Role Based Access Control)                       │
│  ├── Audit Logging Middleware                                               │
│  └── Error Handling Middleware                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│   CORE SERVICES      │ │  INTEGRATION LAYER   │ │   BACKGROUND JOBS    │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│ • RoomService        │ │ • Beds24Client       │ │ • SyncScheduler      │
│ • ReservationService │ │ • Beds24SyncService  │ │ • ReportGenerator    │
│ • GuestService       │ │ • WebhookHandler     │ │ • NotificationWorker │
│ • InvoiceService     │ │ • ChannelMapper      │ │ • AuditArchiver      │
│ • HousekeepingService│ │ • ConflictResolver   │ │ • CleanupWorker      │
│ • MaintenanceService │ │                      │ │                      │
│ • ReportService      │ │                      │ │                      │
│ • AuditService       │ │                      │ │                      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │    PostgreSQL       │  │       Redis         │  │   File Storage      │ │
│  │    (Primary DB)     │  │    (Cache/Queue)    │  │   (Documents)       │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤ │
│  │ • Users             │  │ • Session Store     │  │ • Invoices (PDF)    │ │
│  │ • Properties        │  │ • Rate Limiting     │  │ • Reports           │ │
│  │ • Rooms             │  │ • Beds24 Sync Queue │  │ • Guest Documents   │ │
│  │ • Reservations      │  │ • Pub/Sub Events    │  │ • Backup Archives   │ │
│  │ • Guests            │  │ • API Response Cache│  │                     │ │
│  │ • Invoices          │  │                     │  │                     │ │
│  │ • Housekeeping      │  │                     │  │                     │ │
│  │ • Maintenance       │  │                     │  │                     │ │
│  │ • Audit Logs        │  │                     │  │                     │ │
│  │ • Sync Status       │  │                     │  │                     │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Beds24 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BEDS24 INTEGRATION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐     │
│  │   Beds24 API    │◄────►│  Beds24Client   │◄────►│  SyncService    │     │
│  │   (External)    │      │  (API Wrapper)  │      │  (Orchestrator) │     │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘     │
│           │                        │                        │               │
│           │                        │                        │               │
│           ▼                        ▼                        ▼               │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐     │
│  │ Webhook Handler │      │ Channel Mapper  │      │Conflict Resolver│     │
│  │ (Inbound Events)│      │(Data Transform) │      │ (Merge Logic)   │     │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

SYNC STRATEGIES:
================
1. PUSH SYNC (PMS → Beds24)
   - Triggered on local changes (room updates, rate changes)
   - Uses optimistic locking with retry mechanism
   - Queued via Redis for reliability

2. PULL SYNC (Beds24 → PMS)
   - Scheduled polling every 5 minutes
   - Webhook-based instant updates when available
   - Incremental sync using lastModified timestamps

3. CONFLICT RESOLUTION
   - Last-Write-Wins with configurable override
   - Beds24 as source of truth for OTA bookings
   - PMS as source of truth for direct bookings
   - Manual review queue for conflicts
```

## Audit Logging System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUDIT LOGGING SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      AUDIT MIDDLEWARE                                │   │
│  │  • Intercepts all API requests                                       │   │
│  │  • Captures before/after state for mutations                         │   │
│  │  • Records user context, IP, timestamp                              │   │
│  │  • Generates unique correlation IDs                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      AUDIT EVENT TYPES                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  AUTHENTICATION          RESERVATIONS           ROOMS                │   │
│  │  • LOGIN                 • CREATE               • STATUS_CHANGE      │   │
│  │  • LOGOUT                • UPDATE               • RATE_UPDATE        │   │
│  │  • PASSWORD_CHANGE       • CANCEL               • MAINTENANCE        │   │
│  │  • PERMISSION_CHANGE     • CHECK_IN             • HOUSEKEEPING       │   │
│  │                          • CHECK_OUT                                 │   │
│  │  GUESTS                  INVOICES               SYNC                 │   │
│  │  • CREATE                • CREATE               • BEDS24_PUSH        │   │
│  │  • UPDATE                • UPDATE               • BEDS24_PULL        │   │
│  │  • MERGE                 • PAYMENT              • CONFLICT_RESOLVED  │   │
│  │  • DELETE                • VOID                 • SYNC_ERROR         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      AUDIT STORAGE                                   │   │
│  │  • PostgreSQL: Primary storage (last 90 days hot data)              │   │
│  │  • Archive: Compressed JSON files (compliance retention)            │   │
│  │  • Indexed by: timestamp, entity_type, entity_id, user_id, action   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
AUTHENTICATION FLOW
===================
                    ┌──────────────┐
                    │   Client     │
                    └──────┬───────┘
                           │ 1. Login (email/password)
                           ▼
                    ┌──────────────┐
                    │  Auth API    │
                    └──────┬───────┘
                           │ 2. Validate credentials
                           ▼
                    ┌──────────────┐
                    │  Database    │ (bcrypt hashed passwords)
                    └──────┬───────┘
                           │ 3. Generate tokens
                           ▼
         ┌─────────────────┴─────────────────┐
         │                                   │
    ┌────▼────┐                        ┌────▼────┐
    │  JWT    │ (15min exp)            │ Refresh │ (7 days exp)
    │  Token  │                        │  Token  │ (stored in DB)
    └─────────┘                        └─────────┘

AUTHORIZATION (RBAC)
====================
ROLES:
• SUPER_ADMIN  - Full system access, multi-property
• ADMIN        - Full property access, user management
• MANAGER      - Reservations, guests, reports
• FRONT_DESK   - Check-in/out, reservations, guests
• HOUSEKEEPING - Room status updates only
• MAINTENANCE  - Maintenance requests only
• VIEWER       - Read-only access to all data

PERMISSIONS MATRIX:
┌───────────────────┬────────┬───────┬─────────┬────────────┬─────────────┬─────────────┬────────┐
│ Resource          │ S.ADMIN│ ADMIN │ MANAGER │ FRONT_DESK │ HOUSEKEEPING│ MAINTENANCE │ VIEWER │
├───────────────────┼────────┼───────┼─────────┼────────────┼─────────────┼─────────────┼────────┤
│ Users             │ CRUD   │ CRUD  │ R       │ R          │ -           │ -           │ -      │
│ Properties        │ CRUD   │ RU    │ R       │ R          │ R           │ R           │ R      │
│ Rooms             │ CRUD   │ CRUD  │ RU      │ R          │ RU (status) │ R           │ R      │
│ Reservations      │ CRUD   │ CRUD  │ CRUD    │ CRU        │ R           │ R           │ R      │
│ Guests            │ CRUD   │ CRUD  │ CRUD    │ CRU        │ -           │ -           │ R      │
│ Invoices          │ CRUD   │ CRUD  │ CRUD    │ R          │ -           │ -           │ R      │
│ Housekeeping      │ CRUD   │ CRUD  │ RU      │ R          │ RU          │ R           │ R      │
│ Maintenance       │ CRUD   │ CRUD  │ CRUD    │ CRU        │ R           │ CRU         │ R      │
│ Reports           │ CRUD   │ CRUD  │ R       │ -          │ -           │ -           │ R      │
│ Audit Logs        │ R      │ R     │ R       │ -          │ -           │ -           │ R      │
│ Settings          │ CRUD   │ CRUD  │ R       │ R          │ -           │ -           │ R      │
│ Beds24 Sync       │ CRUD   │ CRUD  │ R       │ -          │ -           │ -           │ R      │
└───────────────────┴────────┴───────┴─────────┴────────────┴─────────────┴─────────────┴────────┘
```

## Data Flow Patterns

### Reservation Creation Flow

```
1. User submits reservation form
   │
   ▼
2. API validates input (Joi schema)
   │
   ▼
3. Check room availability (DB query with locking)
   │
   ▼
4. Start database transaction
   │
   ├──► 5a. Create reservation record
   │
   ├──► 5b. Update room status
   │
   ├──► 5c. Create guest record (if new)
   │
   ├──► 5d. Log audit event
   │
   └──► 5e. Commit transaction
   │
   ▼
6. Queue Beds24 sync job (Redis)
   │
   ▼
7. Return response to client
   │
   ▼
8. Background worker syncs to Beds24
   │
   ├──► Success: Update sync status
   │
   └──► Failure: Retry with backoff, alert on exhaustion
```

## Scalability Considerations

1. **Horizontal Scaling**
   - Stateless API servers behind load balancer
   - Redis for shared session/cache state
   - Database read replicas for reporting

2. **Performance Optimizations**
   - Connection pooling (pg-pool)
   - Query optimization with proper indexes
   - Response caching for static data
   - Pagination for large datasets

3. **Reliability**
   - Database transactions for data integrity
   - Retry mechanisms for external APIs
   - Circuit breaker pattern for Beds24
   - Health checks and graceful degradation

## Tech Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Server | Express.js | REST API, middleware |
| Database | PostgreSQL | Primary data store |
| Query Builder | Knex.js | SQL queries, migrations |
| Cache/Queue | Redis | Sessions, job queue, caching |
| Auth | JWT + bcrypt | Authentication |
| Validation | Joi/Zod | Request validation |
| Jobs | Bull | Background job processing |
| Logging | Winston | Application logging |
| Testing | Jest + Supertest | Unit & integration tests |
| Documentation | Swagger/OpenAPI | API documentation |

## File Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── db/
│   │   ├── migrations/   # Knex migrations
│   │   ├── seeds/        # Seed data
│   │   └── knexfile.js   # Knex configuration
│   ├── middleware/       # Express middleware
│   ├── modules/          # Feature modules
│   │   ├── auth/
│   │   ├── rooms/
│   │   ├── reservations/
│   │   ├── guests/
│   │   ├── invoices/
│   │   ├── housekeeping/
│   │   ├── maintenance/
│   │   ├── reports/
│   │   └── audit/
│   ├── integrations/     # External integrations
│   │   └── beds24/
│   ├── jobs/             # Background jobs
│   ├── utils/            # Utilities
│   └── app.js            # Express app setup
├── tests/
├── .env.example
├── package.json
└── README.md
```
