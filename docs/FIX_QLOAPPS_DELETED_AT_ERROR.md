# Fix: Removed Non-existent `deleted_at` Column Query

## Problem

The backend was throwing a database error when trying to query the `qloapps_config` table:

```
ERROR: select * from "qloapps_config" where "property_id" = $1 
       and "deleted_at" is null limit $2 - 
       column "deleted_at" does not exist
```

## Root Cause

In the `ChannelManagerService.getStatus()` method, the code was attempting to filter by a `deleted_at` column that doesn't exist on the `qloapps_config` table:

```typescript
// WRONG - deleted_at column doesn't exist
const qloAppsConfig = await db('qloapps_config')
  .where({ property_id: this.propertyId })
  .whereNull('deleted_at')  // ❌ This column doesn't exist
  .first();
```

The `qloapps_config` table was created with only these timestamp columns:
- `created_at` 
- `updated_at`

It does **not** have a `deleted_at` column for soft deletes.

## Solution

Removed the `.whereNull('deleted_at')` filter from the QloApps config query:

```typescript
// CORRECT - no deleted_at filter
const qloAppsConfig = await db('qloapps_config')
  .where({ property_id: this.propertyId })
  .first();
```

## File Changed

**File:** `/backend/src/integrations/channel-manager/channel_manager_service.ts`

**Method:** `getStatus()`

**Line:** ~149-150

**Change:** Removed `.whereNull('deleted_at')` from qloapps_config query

## Why This Happened

The `beds24_config` table likely uses soft deletes with a `deleted_at` column, so the pattern of filtering by `whereNull('deleted_at')` was carried over to the QloApps config query. However, the QloApps config table doesn't implement soft deletes, so this filter was unnecessary and caused the error.

## Migration Context

The `qloapps_config` table is created with this structure (no `deleted_at`):

```typescript
// From migration: 20260106000001_create_qloapps_config.ts
table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
table.uuid('property_id').notNullable();
table.string('base_url', 500).notNullable();
table.text('api_key_encrypted').notNullable();
table.integer('qloapps_hotel_id').notNullable();
// ... configuration fields ...
table.timestamp('created_at', { useTz: true }).notNullable();
table.timestamp('updated_at', { useTz: true }).notNullable();
// NOTE: No deleted_at column - no soft delete support
```

## Testing

After the fix:
- ✅ The `getStatus()` method queries correctly
- ✅ No SQL errors on `deleted_at` column
- ✅ Frontend can fetch Channel Manager status without errors
- ✅ Test Connection button works properly

## Related Files Reviewed

- `beds24_config` table: HAS `deleted_at` column (soft delete)
- `qloapps_config` table: NO `deleted_at` column (hard delete only)
- No other queries on `qloapps_config` table use `whereNull('deleted_at')`

## Recommendations

1. **Consistency**: If QloApps config needs to support soft deletes in the future, add a migration to add the `deleted_at` column and update queries accordingly.

2. **Documentation**: Document which tables support soft deletes vs hard deletes in the database schema.

3. **Code Review**: Check for similar patterns in other integrations where soft delete filters might be applied to tables without the column.
