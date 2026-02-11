# Multi-Hotel Backend Implementation Guide

## Overview
This document provides patterns for completing the multi-hotel RBAC implementation across all backend controllers.

## Pattern for Updating Controllers

### Step 1: Add hotel_id to all handlers
For EVERY handler function in EVERY controller:

```typescript
export async function someHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const hotelId = (req as any).hotelId; // ADD THIS LINE FIRST
    
    // Rest of handler logic...
  }
}
```

### Step 2: Add hotel_id to SELECT queries
```typescript
// BEFORE:
const items = await db('table_name')
  .select('*')
  .where({ some_field: value })
  .first();

// AFTER:
const items = await db('table_name')
  .select('*')
  .where({ some_field: value, hotel_id: hotelId })
  .first();
```

### Step 3: Add hotel_id to INSERT queries
```typescript
// BEFORE:
const [item] = await db('table_name')
  .insert({
    field1: value1,
    field2: value2,
  })
  .returning('*');

// AFTER:
const [item] = await db('table_name')
  .insert({
    hotel_id: hotelId,  // ADD THIS
    field1: value1,
    field2: value2,
  })
  .returning('*');
```

### Step 4: Update routes to add hotelContext middleware
```typescript
// BEFORE:
import { authenticateToken, requireRole } from '../auth/auth_middleware.js';
const router = Router();
router.use(authenticateToken);

// AFTER:
import { authenticateToken, requireRole, hotelContext } from '../auth/auth_middleware.js';
const router = Router();
router.use(authenticateToken);
router.use(hotelContext); // ADD THIS
```

## Controllers Requiring Updates

### ✅ Completed:
- [x] auth (updated to return hotels)
- [x] users (updated for hotel_ids)
- [x] hotels (new module created)
- [x] rooms
- [x] room_types

### 🚧 Partially Complete / Needs Completion:
- [ ] **reservations** - Critical handlers updated, needs:
  - createReservationHandler: Add `hotel_id: hotelId` to insert
  - updateReservationHandler: Add hotel_id to where clause
  - deleteReservationHandler: Add hotel_id to where clause
  - checkAvailabilityHandler: Pass hotelId to availability check
  - reservations_routes.ts: Add `hotelContext` middleware

- [ ] **guests** - Needs:
  - All handlers: Add `const hotelId = (req as any).hotelId;`
  - getGuestsHandler: Add `.where('hotel_id', hotelId)`
  - getGuestHandler: Add `.where('hotel_id', hotelId)`
  - createGuestHandler: Add `hotel_id: hotelId` to insert
  - updateGuestHandler: Add `.where('hotel_id', hotelId)`
  - deleteGuestHandler: Add `.where('hotel_id', hotelId)`
  - guests_routes.ts: Add `hotelContext` middleware

- [ ] **invoices** - Needs:
  - All handlers: Add `const hotelId = (req as any).hotelId;`
  - Query filters: Add `.where('invoices.hotel_id', hotelId)`
  - Insert operations: Add `hotel_id: hotelId`
  - invoices_routes.ts: Add `hotelContext` middleware

- [ ] **expenses** - Needs:
  - All handlers: Add `const hotelId = (req as any).hotelId;`
  - Query filters: Add `.where('expenses.hotel_id', hotelId)`
  - Insert operations: Add `hotel_id: hotelId`
  - expenses_routes.ts: Add `hotelContext` middleware

- [ ] **maintenance** - Needs:
  - All handlers: Add `const hotelId = (req as any).hotelId;`
  - Query filters: Add `.where('maintenance_requests.hotel_id', hotelId)`
  - Insert operations: Add `hotel_id: hotelId`
  - maintenance_routes.ts: Add `hotelContext` middleware

- [ ] **reports** - Needs:
  - All handlers: Add `const hotelId = (req as any).hotelId;`
  - All aggregation queries must filter by `hotel_id`
  - reports_routes.ts: Add `hotelContext` middleware

- [ ] **audit** - Needs:
  - All handlers: Add `const hotelId = (req as any).hotelId;`
  - getAuditLogsHandler: Add `.where('audit_logs.hotel_id', hotelId)`
  - audit_routes.ts: Add `hotelContext` middleware
  - audit_utils.ts: Update logCreate, logUpdate, logDelete to get hotel_id from request

- [ ] **settings** - Needs:
  - getSettingsHandler: Should return hotel settings for current hotel
  - updateSettingsHandler: Should update current hotel only
  - settings_routes.ts: Add `hotelContext` middleware
  - NOTE: Settings are now PER HOTEL (stored in hotels table)

- [ ] **qloapps** - Needs:
  - All handlers: Add `const hotelId = (req as any).hotelId;`
  - getConfigHandler: Add `.where('hotel_id', hotelId)`
  - updateConfigHandler: Add `.where('hotel_id', hotelId)`
  - Sync handlers: Filter by hotel_id
  - qloapps routes: Add `hotelContext` middleware

## Integration Updates

### QloApps Integration
The QloApps integration needs hotel-aware configuration:

1. **Config table**: Already has `hotel_id` column (from migration)
2. **Sync workers**: Must be updated to:
   - Accept hotel_id as parameter
   - Filter all queries by hotel_id
   - Store hotel_id in sync state/logs

3. **Key files to update**:
   - `backend/src/integrations/qloapps/config_service.ts`: Add hotel_id filtering
   - `backend/src/integrations/qloapps/sync/*.ts`: Pass hotel_id to all operations
   - `backend/src/workers/qloapps_*.ts`: Update workers to handle hotel_id

### Audit Logging
Update `backend/src/services/audit/audit_utils.ts`:

```typescript
export async function logCreate(req: any, entityType: string, entityId: string, newData: any) {
  const hotelId = req.hotelId; // Get from request
  
  await db('audit_logs').insert({
    hotel_id: hotelId, // ADD THIS
    user_id: req.user?.userId,
    action: 'CREATE',
    entity_type: entityType,
    entity_id: entityId,
    new_data: JSON.stringify(newData),
  });
}

// Similar updates for logUpdate, logDelete, logAction
```

## Main Routes Registration

Update `backend/src/routes.ts`:

```typescript
import { hotelsRoutes } from './services/hotels/hotels_routes.js';

// Add after other v1 routes:
apiV1Router.use('/v1/hotels', hotelsRoutes);
```

## Testing Checklist

After all updates are complete:

1. **Migration Testing**:
   ```bash
   npm run migrate:latest
   npm run migrate:rollback
   npm run migrate:latest
   ```

2. **API Testing**:
   - Test all CRUD operations with `X-Hotel-Id` header
   - Verify 400 error when header is missing
   - Verify 403 error when user lacks hotel access
   - Verify SUPER_ADMIN can access all hotels
   - Verify data isolation between hotels

3. **Integration Testing**:
   - Test QloApps sync with multiple hotels
   - Verify audit logs are hotel-scoped
   - Test reports are hotel-scoped

## Quick Command Reference

### Add hotelContext to all route files:
```bash
# Find all route files that need updating:
find backend/src/services -name "*_routes.ts" -exec grep -L "hotelContext" {} \;

# Pattern to add after authenticateToken:
# router.use(hotelContext);
```

### Find all handlers missing hotel_id extraction:
```bash
# Search for handler functions that don't have hotelId extraction:
grep -r "export async function.*Handler" backend/src/services --include="*_controller.ts" -A 3 | grep -v "hotelId"
```

## Notes

- **SUPER_ADMIN**: Always has implicit access to all hotels (no need for user_hotels entries)
- **Settings**: Previously a single-row table, now each hotel has its own settings in the `hotels` table
- **Guest Privacy**: Guests are hotel-scoped; same person at different hotels = different records (prevents data leaks)
- **Channel Manager**: Each hotel can have its own QloApps/Beds24 configuration
- **Audit Logs**: All audit logs must include hotel_id for proper isolation

## Priority Order

1. **HIGH PRIORITY** (affects data integrity):
   - All CREATE operations (must include hotel_id)
   - All READ operations (must filter by hotel_id)
   - All UPDATE operations (must verify hotel_id)
   - All DELETE operations (must verify hotel_id)

2. **MEDIUM PRIORITY** (affects functionality):
   - Add hotelContext to all routes
   - Update availability/reporting services
   - Update audit logging

3. **LOWER PRIORITY** (affects integration):
   - QloApps integration updates
   - Worker updates
   - Additional validation

## Completion Status

**Migration**: ✅ Complete  
**Core Auth**: ✅ Complete  
**Hotels Module**: ✅ Complete  
**Users Module**: ✅ Complete  
**Rooms/Room Types**: ✅ Complete  
**Reservations**: 🚧 50% Complete  
**Other Controllers**: ⏳ Pending  
**Routes**: ⏳ Pending  
**Integration**: ⏳ Pending  

---

**Last Updated**: 2026-02-11  
**Status**: In Progress

