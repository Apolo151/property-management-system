# Fix: Removed Non-existent `deleted_at` Column Queries (Round 2)

## Problem

When clicking the "Test Connection" button in the Settings page, the backend was throwing a database error:

```
{
    "success": false,
    "message": "select * from \"qloapps_config\" where \"property_id\" = $1 and \"deleted_at\" is null limit $2 - column \"deleted_at\" does not exist"
}
```

## Root Cause

The error was coming from two methods in the `QloAppsChannelStrategy` class:

1. `isEnabled()` method (line 33)
2. `testConnection()` method (line 47)

Both were filtering by a non-existent `deleted_at` column on the `qloapps_config` table.

## Solution

Removed the `.whereNull('deleted_at')` filter from both methods in the QloApps strategy:

### Before:
```typescript
// isEnabled() method
async isEnabled(): Promise<boolean> {
  const config = await db('qloapps_config')
    .where({ property_id: this.propertyId })
    .whereNull('deleted_at')  // ❌ Column doesn't exist
    .first();
  
  return config?.sync_enabled === true;
}

// testConnection() method
async testConnection(): Promise<ConnectionTestResult> {
  const config = await db('qloapps_config')
    .where({ property_id: this.propertyId })
    .whereNull('deleted_at')  // ❌ Column doesn't exist
    .first();
  
  if (!config) {
    return { success: false, message: 'QloApps is not configured' };
  }
  // ... rest of method
}
```

### After:
```typescript
// isEnabled() method
async isEnabled(): Promise<boolean> {
  const config = await db('qloapps_config')
    .where({ property_id: this.propertyId })
    .first();  // ✅ Direct query, no soft delete filter
  
  return config?.sync_enabled === true;
}

// testConnection() method
async testConnection(): Promise<ConnectionTestResult> {
  const config = await db('qloapps_config')
    .where({ property_id: this.propertyId })
    .first();  // ✅ Direct query, no soft delete filter
  
  if (!config) {
    return { success: false, message: 'QloApps is not configured' };
  }
  // ... rest of method
}
```

## Files Changed

**File:** `/backend/src/integrations/channel-manager/strategies/qloapps_strategy.ts`

**Methods Updated:**
1. `isEnabled()` - Removed `.whereNull('deleted_at')`
2. `testConnection()` - Removed `.whereNull('deleted_at')`

## Why This Happened

The `qloapps_config` table does not implement soft deletes (no `deleted_at` column):

```typescript
// From migration: 20260106000001_create_qloapps_config.ts
table.uuid('id').primary();
table.uuid('property_id').notNullable();
table.string('base_url', 500).notNullable();
table.text('api_key_encrypted').notNullable();
// ... other fields ...
table.timestamp('created_at', { useTz: true }).notNullable();
table.timestamp('updated_at', { useTz: true }).notNullable();
// NOTE: No deleted_at column
```

The soft delete filter was likely copied from the `beds24_config` table (which does have `deleted_at`), but wasn't needed for QloApps config.

## Testing

After the fix:
- ✅ Test Connection button works without errors
- ✅ Backend successfully queries `qloapps_config`
- ✅ Returns correct configuration status
- ✅ Connection test completes successfully

### Manual Test Steps:
1. Navigate to Settings → Channel Manager
2. Click "Test Connection" button
3. Should see result (connected or not configured) without SQL errors

## Related Context

**Previous Fix:** We also removed `.whereNull('deleted_at')` from the `getStatus()` method in `channel_manager_service.ts` earlier in this session. This was a separate location with the same issue.

**Pattern to Watch:** When copying query patterns between tables, verify that both tables have the same soft delete implementation. Don't assume all tables support soft deletes.

## Verification

No other queries on `qloapps_config` contain `.whereNull('deleted_at')`:
- ✅ Verified with grep search across entire backend
- ✅ All other queries are clean

## Notes

- The `qloapps_config` table uses hard deletes only (if needed, records would be deleted entirely)
- Future soft delete support would require:
  1. Migration to add `deleted_at` column
  2. Update queries to include `.whereNull('deleted_at')`
  3. Update deletion logic to set `deleted_at` instead of destroying records
