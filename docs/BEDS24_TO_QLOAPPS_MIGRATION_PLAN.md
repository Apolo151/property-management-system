# Migration Plan: Implement Strategy Pattern + Enable QloApps

**Document Version:** 2.0  
**Date:** January 6, 2026  
**Status:** Planning Phase (Strategy Pattern Approach)  
**Estimated Duration:** 2-3 weeks (includes Strategy Pattern implementation)

---

## ⚠️ IMPORTANT: Strategy Pattern Approach

This migration plan uses the **Strategy Pattern** to make channel manager integrations pluggable and switchable. This allows:
- ✅ Easy switching between Beds24 and QloApps
- ✅ Running both simultaneously during migration
- ✅ Quick rollback if needed
- ✅ Future addition of new channel managers without code changes

**See:** `CHANNEL_MANAGER_STRATEGY_PATTERN.md` for detailed architecture.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Migration Strategy](#3-migration-strategy)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Testing Strategy](#6-testing-strategy)
7. [Rollback Plan](#7-rollback-plan)
8. [Post-Migration Tasks](#8-post-migration-tasks)

---

## 1. Executive Summary

### Objective
Implement a **Strategy Pattern** architecture for channel manager integrations, then migrate from Beds24 to QloApps as the active channel manager. This approach provides maximum flexibility and reduces migration risk.

### Why Strategy Pattern?
1. **Plug & Play**: Switch between channel managers with a single API call
2. **Zero Code Changes**: Add new channel managers without modifying existing code
3. **Safe Migration**: Run both Beds24 and QloApps simultaneously during transition
4. **Easy Rollback**: Switch back to Beds24 instantly if issues arise
5. **Future-Proof**: Add Cloudbeds, Booking.com, etc. without architectural changes

### Approach

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Strategy Infrastructure (Week 1)                  │
│  - Create IChannelManagerStrategy interface                 │
│  - Implement ChannelManagerService (context)                │
│  - Create ChannelManagerFactory                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Strategy Adapters (Week 1-2)                      │
│  - Create Beds24ChannelStrategy (wraps existing code)       │
│  - Create QloAppsChannelStrategy (wraps QloApps code)       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: Application Integration (Week 2)                  │
│  - Update controllers to use ChannelManagerService          │
│  - Replace direct sync hooks with strategy calls            │
│  - Add API routes for switching                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: Frontend Updates (Week 2-3)                       │
│  - Add channel manager switcher UI                          │
│  - Show status of all available managers                    │
│  - Unified settings interface                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 5: Testing & Migration (Week 3)                      │
│  - Test switching between Beds24 ↔ QloApps                  │
│  - Parallel sync testing                                    │
│  - Switch to QloApps as primary                             │
└─────────────────────────────────────────────────────────────┘
```

### Scope
- **Backend**: Strategy pattern implementation + both channel manager adapters
- **Frontend**: Unified channel manager UI with switching capability
- **Data**: No data migration needed - both configs remain in database
- **Workers**: Strategy-aware workers that use active channel manager

### Key Benefits Over Direct Migration
| Aspect | Direct Migration | Strategy Pattern |
|--------|-----------------|------------------|
| Rollback Time | 30 minutes | < 1 minute (API call) |
| Risk Level | Medium-High | Low |
| Future Changes | Hard | Easy |
| A/B Testing | Not possible | Built-in |
| Multi-Manager | Not supported | Supported |
| Code Changes | Many | Minimal |

---

## 2. Architecture Overview

### 2.1 Current State (Before)

```
ReservationController
         │
         ├─► queueReservationSyncHook() [Beds24 specific]
         │
         └─► Beds24Client → Beds24 API
```

### 2.2 Target State (After)

```
ReservationController
         │
         ├─► channelManagerService.syncReservation()
         │                 │
         │                 ├─► getCurrentStrategy()
         │                 │          │
         │                 │          ├─► Beds24ChannelStrategy → Beds24Client
         │                 │          │
         │                 │          └─► QloAppsChannelStrategy → QloAppsClient
         │                 │
         │                 └─► [Active strategy executes]
         │
         └─► Clean, channel-agnostic code
```

### 2.3 Strategy Pattern Components

```
┌──────────────────────────────────────────────────────────────┐
│           IChannelManagerStrategy (Interface)                 │
│  • syncReservation()                                         │
│  • syncAvailability()                                        │
│  • pullReservations()                                        │
│  • testConnection()                                          │
│  • isEnabled()                                               │
└──────────────┬──────────────────────┬────────────────────────┘
               │                      │
               ▼                      ▼
    ┌──────────────────┐   ┌──────────────────┐
    │ Beds24Strategy   │   │ QloAppsStrategy  │
    │ (Adapter)        │   │ (Adapter)        │
    └────────┬─────────┘   └─────────┬────────┘
             │                        │
             ▼                        ▼
    ┌──────────────────┐   ┌──────────────────┐
    │ Beds24 Code      │   │ QloApps Code     │
    │ (Unchanged)      │   │ (Unchanged)      │
    └──────────────────┘   └──────────────────┘
```

---

## 3. Migration Strategy

### Phase Approach

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Backend Preparation (1-2 hours)                    │
├─────────────────────────────────────────────────────────────┤
│ • Disable Beds24 routes and webhooks                        │
│ • Comment out Beds24 sync hooks in reservation controller   │
│ • Update routes.ts to remove Beds24, keep QloApps          │
│ • Verify TypeScript compilation                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Frontend Preparation (1-2 hours)                   │
├─────────────────────────────────────────────────────────────┤
│ • Replace Beds24 settings tab with QloApps tab             │
│ • Update API calls from Beds24 to QloApps endpoints        │
│ • Remove Beds24-specific UI components                      │
│ • Test UI compilation                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Worker Migration (30 minutes)                      │
├─────────────────────────────────────────────────────────────┤
│ • Stop Beds24 workers (inbound, outbound, sync scheduler)  │
│ • Update package.json scripts                               │
│ • Start QloApps workers                                     │
│ • Verify RabbitMQ queue setup                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Integration Testing (1 hour)                       │
├─────────────────────────────────────────────────────────────┤
│ • Test QloApps connection                                   │
│ • Test room type mapping                                    │
│ • Test reservation sync (create/update/cancel)             │
│ • Verify worker logs                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Migration

### 3.1 Routes and API Endpoints

#### File: `backend/src/routes.ts`

**Current State:**
```typescript
import beds24WebhookRoutes from './integrations/beds24/webhooks/webhook_routes.js';
import { qloAppsRoutes } from './services/qloapps/index.js';

apiV1Router.use('/integrations/beds24', beds24WebhookRoutes);
apiV1Router.use('/v1/integrations/qloapps', qloAppsRoutes);
```

**Action:** Comment out Beds24 webhook routes
```typescript
// DISABLED: Beds24 integration - migrated to QloApps
// import beds24WebhookRoutes from './integrations/beds24/webhooks/webhook_routes.js';
import { qloAppsRoutes } from './services/qloapps/index.js';

// apiV1Router.use('/integrations/beds24', beds24WebhookRoutes);
apiV1Router.use('/v1/integrations/qloapps', qloAppsRoutes);
```

**Files to modify:**
- `backend/src/routes.ts` - Remove Beds24 webhook routes

---

### 3.2 Settings Routes

#### File: `backend/src/services/settings/settings_routes.ts`

**Current State:** Has 11 Beds24-specific routes:
- `/settings/beds24` - GET/PUT config
- `/settings/beds24/authenticate` - POST
- `/settings/beds24/test` - POST
- `/settings/beds24/initial-sync` - POST
- `/settings/beds24/rooms/*` - 6 room mapping routes

**Action:** Comment out all Beds24 route handlers
```typescript
// ============================================================================
// DISABLED: Beds24 Integration (Migrated to QloApps)
// ============================================================================
/*
import {
  getBeds24ConfigHandler,
  authenticateBeds24Handler,
  updateBeds24ConfigHandler,
  testBeds24ConnectionHandler,
  triggerInitialSyncHandler,
} from './beds24_controller.js';
import {
  getBeds24RoomsHandler,
  getUnmappedBeds24RoomsHandler,
  getPmsRoomsWithMappingHandler,
  mapRoomHandler,
  unmapRoomHandler,
  autoCreateRoomsHandler,
} from './beds24_rooms_controller.js';

// ... all 11 Beds24 routes commented out ...
*/
```

**Files to modify:**
- `backend/src/services/settings/settings_routes.ts`

---

### 3.3 Reservation Sync Hooks

#### File: `backend/src/services/reservations/reservations_controller.ts`

**Current State:**
```typescript
import {
  queueReservationSyncHook,
  queueReservationCancelHook,
} from '../../integrations/beds24/hooks/sync_hooks.js';

// Line ~486: After creating reservation
queueReservationSyncHook(reservation.id, 'create').catch((err) => {
  console.error(`Failed to queue sync for reservation ${reservation.id}:`, err);
});

// Line ~619: After updating reservation
queueReservationSyncHook(id, 'update').catch((err) => {
  console.error(`Failed to queue sync for reservation ${id}:`, err);
});
```

**Action:** Replace Beds24 hooks with QloApps hooks
```typescript
// CHANGED: Migrated from Beds24 to QloApps
import {
  queueQloAppsReservationSyncHook,
  queueQloAppsReservationCancelHook,
} from '../../integrations/qloapps/hooks/sync_hooks.js';

// After creating reservation
queueQloAppsReservationSyncHook(reservation.id, 'create').catch((err) => {
  console.error(`[QloApps] Failed to queue sync for reservation ${reservation.id}:`, err);
});

// After updating reservation
queueQloAppsReservationSyncHook(id, 'update').catch((err) => {
  console.error(`[QloApps] Failed to queue sync for reservation ${id}:`, err);
});
```

**Files to modify:**
- `backend/src/services/reservations/reservations_controller.ts` (2 import + 2-3 function call sites)

---

### 3.4 Room Sync Hooks

#### File: `backend/src/services/rooms/rooms_controller.ts`

**Current State:**
```typescript
import {
  queueRoomAvailabilitySyncHook,
} from '../../integrations/beds24/hooks/sync_hooks.js';

// After room status change
await queueRoomAvailabilitySyncHook(roomId);
```

**Action:** Replace with QloApps hooks
```typescript
// CHANGED: Migrated from Beds24 to QloApps
import {
  queueQloAppsAvailabilitySyncHook,
} from '../../integrations/qloapps/hooks/sync_hooks.js';

// After room status change
// Note: QloApps hook requires date range, calculate from room changes
const today = new Date().toISOString().slice(0, 10);
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 365);
const dateTo = futureDate.toISOString().slice(0, 10);

await queueQloAppsAvailabilitySyncHook(roomTypeId, today, dateTo);
```

**Files to modify:**
- `backend/src/services/rooms/rooms_controller.ts`

---

### 3.5 Admin Channel Events

#### File: `backend/src/services/admin/channel_events_controller.ts`

**Current State:**
```typescript
import {
  createChannelEvent,
  getChannelEvents,
  getChannelEventById,
  updateChannelEventStatus,
} from '../../integrations/beds24/repositories/channel_event_repository.js';
import { publishInbound, publishOutbound } from '../../integrations/beds24/queue/rabbitmq_publisher.js';
```

**Action:** Comment out or create QloApps equivalent
- **Option 1**: Keep using Beds24 channel_events table for QloApps (rename conceptually)
- **Option 2**: Create QloApps-specific channel events tracking

**Recommendation**: Keep existing channel_events infrastructure but update imports to be integration-agnostic

**Files to modify:**
- `backend/src/services/admin/channel_events_controller.ts`

---

### 3.6 Worker Entry Points

#### Files: `backend/src/workers/*.ts`

**Current Beds24 Workers:**
- `inbound_worker.ts` - Beds24 inbound sync
- `outbound_worker.ts` - Beds24 outbound sync
- `sync_scheduler.ts` - Beds24 scheduled sync

**Action:** Keep files but add README to indicate they're disabled
- Add comment at top of each file: `// DISABLED: Beds24 integration - use qloapps_*_worker.ts instead`

**New QloApps Workers (already created):**
- `qloapps_inbound_worker.ts` ✅
- `qloapps_outbound_worker.ts` ✅
- `qloapps_sync_scheduler.ts` ✅

**Files to modify:**
- `backend/src/workers/inbound_worker.ts` - Add disabled comment
- `backend/src/workers/outbound_worker.ts` - Add disabled comment
- `backend/src/workers/sync_scheduler.ts` - Add disabled comment

---

### 3.7 Package.json Scripts

#### File: `backend/package.json`

**Current State:**
```json
{
  "scripts": {
    "worker:inbound": "tsx src/workers/inbound_worker.ts",
    "worker:outbound": "tsx src/workers/outbound_worker.ts",
    "worker:sync": "tsx src/workers/sync_scheduler.ts"
  }
}
```

**Action:** Rename Beds24 scripts, add QloApps scripts
```json
{
  "scripts": {
    "worker:beds24-inbound": "tsx src/workers/inbound_worker.ts",
    "worker:beds24-outbound": "tsx src/workers/outbound_worker.ts",
    "worker:beds24-sync": "tsx src/workers/sync_scheduler.ts",
    
    "worker:inbound": "tsx src/workers/qloapps_inbound_worker.ts",
    "worker:outbound": "tsx src/workers/qloapps_outbound_worker.ts",
    "worker:sync": "tsx src/workers/qloapps_sync_scheduler.ts",
    
    "worker:qloapps-inbound": "tsx src/workers/qloapps_inbound_worker.ts",
    "worker:qloapps-outbound": "tsx src/workers/qloapps_outbound_worker.ts",
    "worker:qloapps-sync": "tsx src/workers/qloapps_sync_scheduler.ts"
  }
}
```

**Files to modify:**
- `backend/package.json`

---

### 3.8 Type Definitions Cleanup

#### File: `backend/src/integrations/qloapps/mappers/room_type_mapper.ts`

**Current Issue:**
```typescript
import type { Beds24RoomType } from '../../../services/rooms/rooms_types.js';
```

**Action:** Remove Beds24 type import (not needed for QloApps)

**Files to modify:**
- `backend/src/integrations/qloapps/mappers/room_type_mapper.ts`

---

### 3.9 Environment Variables

#### File: `backend/.env`

**Current Beds24 Variables:**
```env
# Beds24 Configuration
BEDS24_API_URL=https://api.beds24.com/v2
BEDS24_SYNC_INTERVAL_MS=60000
BEDS24_WEBHOOK_SECRET=your_webhook_secret
```

**Action:** Add QloApps variables (keep Beds24 commented)
```env
# Channel Manager Configuration

# DISABLED: Beds24
# BEDS24_API_URL=https://api.beds24.com/v2
# BEDS24_SYNC_INTERVAL_MS=60000
# BEDS24_WEBHOOK_SECRET=your_webhook_secret

# QloApps Configuration
QLOAPPS_API_URL=https://your-hotel.qloapps.com
QLOAPPS_API_KEY=your_api_key_here
QLOAPPS_HOTEL_ID=1
QLOAPPS_SYNC_INTERVAL_MS=300000
```

**Files to modify:**
- `backend/.env`
- `backend/.env.example`

---

## 4. Frontend Migration

### 4.1 Settings Page Tabs

#### File: `frontend/src/pages/SettingsPage.jsx`

**Current State:**
- Has "Beds24" tab with full Beds24 configuration UI
- State variables: `beds24Config`, `beds24Loading`, `beds24Error`, `inviteCode`, `beds24PropertyId`, etc.
- Functions: `handleAuthenticateBeds24`, `handleTestConnection`, `handleTriggerInitialSync`, etc.

**Action:** Replace entire Beds24 tab with QloApps tab
```jsx
// Remove Beds24 state (lines ~19-33)
// const [beds24Config, setBeds24Config] = useState(null)
// const [beds24Loading, setBeds24Loading] = useState(false)
// ... etc

// Add QloApps state
const [qloAppsConfig, setQloAppsConfig] = useState(null)
const [qloAppsLoading, setQloAppsLoading] = useState(false)
const [qloAppsError, setQloAppsError] = useState(null)
const [qloAppsApiKey, setQloAppsApiKey] = useState('')
const [qloAppsBaseUrl, setQloAppsBaseUrl] = useState('')
const [qloAppsHotelId, setQloAppsHotelId] = useState('')

// Replace useEffect for fetching Beds24 config
useEffect(() => {
  const fetchQloAppsConfig = async () => {
    try {
      setQloAppsLoading(true)
      setQloAppsError(null)
      const data = await api.integrations.qloapps.getConfig()
      setQloAppsConfig(data)
    } catch (err) {
      setQloAppsError(err.message || 'Failed to load QloApps configuration')
    } finally {
      setQloAppsLoading(false)
    }
  }

  if (activeTab === 'qloapps') {
    fetchQloAppsConfig()
  }
}, [activeTab])

// Replace Beds24 tab in JSX (around line 800+)
// Change:
<button
  onClick={() => setActiveTab('beds24')}
  className={activeTab === 'beds24' ? 'active' : ''}
>
  Beds24
</button>

// To:
<button
  onClick={() => setActiveTab('qloapps')}
  className={activeTab === 'qloapps' ? 'active' : ''}
>
  QloApps Channel Manager
</button>

// Replace entire Beds24 tab content with QloApps UI
{activeTab === 'qloapps' && (
  <QloAppsSettingsTab 
    config={qloAppsConfig}
    loading={qloAppsLoading}
    error={qloAppsError}
    onUpdate={fetchQloAppsConfig}
  />
)}
```

**Sections to Remove/Replace:**
1. **Authentication Section** (~200 lines)
   - Beds24 invite code form → QloApps API key form
   - Property ID field → Hotel ID field
2. **Connection Testing** (~100 lines)
   - Keep structure, change endpoint calls
3. **Sync Status** (~150 lines)
   - Update to use QloApps sync state
4. **Room Mapping** (~300 lines)
   - Update to use QloApps room type mappings
5. **Webhook Configuration** (~50 lines)
   - Remove (QloApps doesn't use webhooks)

**Files to modify:**
- `frontend/src/pages/SettingsPage.jsx` (major refactor, ~800 lines affected)

---

### 4.2 API Client Updates

#### File: `frontend/src/utils/api.js`

**Current State:**
```javascript
// Beds24 endpoints (lines 451-492)
getBeds24Config: () => request('/v1/settings/beds24'),
authenticateBeds24: (inviteCode, beds24PropertyId, deviceName) => 
  request('/v1/settings/beds24/authenticate', { ... }),
updateBeds24Config: (configData) => 
  request('/v1/settings/beds24', { ... }),
testBeds24Connection: () => 
  request('/v1/settings/beds24/test', { ... }),
triggerInitialSync: () => 
  request('/v1/settings/beds24/initial-sync', { ... }),

// Beds24 room mapping endpoints (lines 475-492)
getBeds24Rooms: () => request('/v1/settings/beds24/rooms'),
getUnmappedBeds24Rooms: () => request('/v1/settings/beds24/rooms/unmapped'),
// ... 4 more room mapping endpoints
```

**Action:** Comment out Beds24, add QloApps endpoints
```javascript
// ============================================================================
// Channel Manager Integration
// ============================================================================

// DISABLED: Beds24 Integration
/*
  getBeds24Config: () => request('/v1/settings/beds24'),
  authenticateBeds24: (inviteCode, beds24PropertyId, deviceName) => 
    request('/v1/settings/beds24/authenticate', { ... }),
  ... etc (all 11 endpoints)
*/

// QloApps Integration
integrations: {
  qloapps: {
    // Configuration
    getConfig: () => request('/v1/integrations/qloapps/config'),
    createConfig: (data) => request('/v1/integrations/qloapps/config', {
      method: 'POST',
      body: data,
    }),
    updateConfig: (id, data) => request(`/v1/integrations/qloapps/config/${id}`, {
      method: 'PUT',
      body: data,
    }),
    testConnection: (id) => request(`/v1/integrations/qloapps/config/${id}/test`, {
      method: 'POST',
    }),
    
    // Room Type Mappings
    getRoomTypeMappings: () => request('/v1/integrations/qloapps/mappings/room-types'),
    createRoomTypeMapping: (data) => request('/v1/integrations/qloapps/mappings/room-types', {
      method: 'POST',
      body: data,
    }),
    deleteRoomTypeMapping: (id) => request(`/v1/integrations/qloapps/mappings/room-types/${id}`, {
      method: 'DELETE',
    }),
    
    // Sync Operations
    triggerSync: (data) => request('/v1/integrations/qloapps/sync', {
      method: 'POST',
      body: data,
    }),
    getSyncStatus: () => request('/v1/integrations/qloapps/sync/status'),
  },
},
```

**Files to modify:**
- `frontend/src/utils/api.js`

---

### 4.3 Room Types and Reservation Pages

#### Files with Minor Beds24 References:

**1. `frontend/src/pages/RoomTypesPage.jsx`**
- Line 37: `beds24RoomTypeOptions` - Keep as generic "room type options"
- Line 246: Comment "Manage room types with quantity (Beds24-style)" → "Manage room types with quantity"
- Line 412: Label "Beds24 Room Type *" → "Room Type *"

**2. `frontend/src/pages/AvailabilityPage.jsx`**
- Line 161: `beds24RoomTypeOptions` - Keep as generic "room type options"

**3. `frontend/src/pages/CalendarPage.jsx`**
- Line 32: Comment "beds24-style" → Remove or change to "2-step booking"

**4. `frontend/src/store/roomTypesStore.js`**
- Line 41: `beds24RoomId` → Keep as is (generic field, maps to any channel manager)

**5. `frontend/src/store/roomsStore.js`**
- Line 45: Comment "Required Beds24 room type" → "Required room type"

**6. `frontend/src/components/BookingTimeline.jsx`**
- Line 77: Comment "old reservations and Beds24 bookings" → "old reservations and channel manager bookings"

**Files to modify:**
- `frontend/src/pages/RoomTypesPage.jsx` (3 cosmetic changes)
- `frontend/src/pages/AvailabilityPage.jsx` (1 variable rename)
- `frontend/src/pages/CalendarPage.jsx` (1 comment change)
- `frontend/src/store/roomTypesStore.js` (no change needed)
- `frontend/src/store/roomsStore.js` (1 comment change)
- `frontend/src/components/BookingTimeline.jsx` (1 comment change)

---

### 4.4 Create QloApps Settings Component

#### New File: `frontend/src/components/QloAppsSettings.jsx`

**Purpose:** Dedicated component for QloApps configuration UI

**Structure:**
```jsx
import React, { useState } from 'react'
import { api } from '../utils/api'
import { useToast } from '../hooks/useToast'

const QloAppsSettings = ({ config, loading, error, onUpdate }) => {
  const toast = useToast()
  const [formData, setFormData] = useState({
    baseUrl: config?.base_url || '',
    apiKey: config?.api_key || '',
    hotelId: config?.hotel_id || 1,
    syncEnabled: config?.sync_enabled || false,
    pullSyncEnabled: config?.pull_sync_enabled || true,
    pushSyncEnabled: config?.push_sync_enabled || true,
  })
  
  // Sections:
  // 1. Connection Configuration Form
  // 2. Test Connection Button
  // 3. Sync Settings (Enable/Disable)
  // 4. Room Type Mapping Interface
  // 5. Sync Status Display
  // 6. Manual Sync Trigger
  
  return (
    <div className="qloapps-settings">
      {/* Configuration forms */}
    </div>
  )
}

export default QloAppsSettings
```

**Files to create:**
- `frontend/src/components/QloAppsSettings.jsx` (~400-500 lines)

---

## 5. Testing Strategy

### 5.1 Backend Testing Checklist

**TypeScript Compilation:**
```bash
cd backend
npm run build
# Should complete with 0 errors
```

**API Endpoint Testing:**
```bash
# Test QloApps config endpoint
curl -X GET http://localhost:3000/api/v1/integrations/qloapps/config \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test QloApps test connection
curl -X POST http://localhost:3000/api/v1/integrations/qloapps/config/CONFIG_ID/test \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify Beds24 endpoints return 404
curl -X GET http://localhost:3000/api/v1/settings/beds24 \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 404 Not Found
```

**Worker Testing:**
```bash
# Start QloApps workers in separate terminals
npm run worker:qloapps-inbound
npm run worker:qloapps-outbound
npm run worker:qloapps-sync

# Check logs for successful initialization
# Expected: "QloApps InboundWorker Running. Press Ctrl+C to stop."
```

**RabbitMQ Queue Verification:**
```bash
# List queues (should see QloApps queues, not Beds24)
curl -u guest:guest http://localhost:15672/api/queues | jq '.[] | .name'
# Expected: qloapps.inbound, qloapps.outbound, qloapps.inbound.dlq, qloapps.outbound.dlq
```

---

### 5.2 Frontend Testing Checklist

**Build Verification:**
```bash
cd frontend
npm run build
# Should complete with 0 errors
```

**UI Navigation:**
- [ ] Login to application
- [ ] Navigate to Settings page
- [ ] Verify "QloApps Channel Manager" tab exists
- [ ] Verify "Beds24" tab is removed
- [ ] Click QloApps tab - should load without errors

**QloApps Configuration:**
- [ ] Enter QloApps API credentials
- [ ] Click "Test Connection" - should show success/error message
- [ ] Enable sync settings
- [ ] Save configuration

**Room Type Mapping:**
- [ ] View room type mappings interface
- [ ] Create a mapping between PMS room type and QloApps room type
- [ ] Verify mapping appears in list
- [ ] Delete a mapping

**Reservation Flow:**
- [ ] Create a new reservation
- [ ] Check browser console - should see QloApps sync queue message (not Beds24)
- [ ] Update a reservation
- [ ] Cancel a reservation
- [ ] Verify no Beds24 errors in console

---

### 5.3 Integration Testing

**End-to-End Sync Test:**

1. **Setup QloApps Connection**
   - Configure QloApps API credentials
   - Test connection (should succeed)

2. **Room Type Sync**
   - Create a room type in PMS
   - Map it to QloApps room type
   - Verify mapping in database: `select * from qloapps_room_type_mappings;`

3. **Reservation Sync (PMS → QloApps)**
   - Create a reservation in PMS
   - Check RabbitMQ: `qloapps.outbound` queue should have 1 message
   - Outbound worker should process it
   - Verify in QloApps: booking should appear

4. **Reservation Sync (QloApps → PMS)**
   - Create a booking in QloApps (manually or via OTA)
   - Sync scheduler should pull it (runs every 5 minutes)
   - Verify in PMS: reservation should appear with source "QloApps"

5. **Availability Sync**
   - Block a room in PMS
   - Availability sync should trigger
   - Verify in QloApps: availability should reflect the block

---

## 6. Rollback Plan

### If Issues Arise

**Step 1: Stop QloApps Workers**
```bash
# Kill all QloApps workers
pkill -f qloapps_inbound_worker
pkill -f qloapps_outbound_worker
pkill -f qloapps_sync_scheduler
```

**Step 2: Re-enable Beds24 Backend**
```bash
cd backend/src
# Uncomment Beds24 routes in routes.ts
# Uncomment Beds24 routes in settings/settings_routes.ts
# Restore Beds24 hooks in reservations_controller.ts
# Restore Beds24 hooks in rooms_controller.ts
```

**Step 3: Re-enable Beds24 Frontend**
```bash
cd frontend/src
# Restore Beds24 tab in SettingsPage.jsx
# Uncomment Beds24 API endpoints in utils/api.js
```

**Step 4: Restart Beds24 Workers**
```bash
cd backend
npm run worker:beds24-inbound &
npm run worker:beds24-outbound &
npm run worker:beds24-sync &
```

**Step 5: Rebuild and Redeploy**
```bash
# Backend
cd backend
npm run build
pm2 restart pms-backend

# Frontend
cd frontend
npm run build
# Deploy dist/ folder
```

**Estimated Rollback Time:** 15-30 minutes

---

## 7. Post-Migration Tasks

### 7.1 Monitoring

**Week 1 - Intensive Monitoring:**
- Check worker logs daily
- Monitor RabbitMQ queue depths
- Track sync success/failure rates in `qloapps_sync_logs` table
- Review error logs for any QloApps API issues

**Week 2-4 - Regular Monitoring:**
- Weekly review of sync metrics
- Monthly review of integration performance

### 7.2 Documentation Updates

**Update Documentation:**
- [ ] Update README.md - replace Beds24 references with QloApps
- [ ] Update API documentation - remove Beds24 endpoints, add QloApps
- [ ] Update worker documentation - document QloApps workers
- [ ] Create QloApps troubleshooting guide

### 7.3 Database Cleanup (Optional - After 30 Days)

If QloApps integration proves stable and Beds24 is confirmed no longer needed:

```sql
-- Archive Beds24 data (don't delete immediately)
-- Option 1: Keep tables but truncate data
-- Option 2: Rename tables with _archived_ prefix
-- Option 3: Export to JSON and drop tables

-- Example: Rename tables for archival
ALTER TABLE beds24_config RENAME TO _archived_beds24_config;
ALTER TABLE beds24_room_mappings RENAME TO _archived_beds24_room_mappings;
-- etc.
```

**Warning:** Only perform cleanup after 30+ days of stable QloApps operation

### 7.4 Code Cleanup (Optional - After 60 Days)

If Beds24 is permanently retired:

**Phase 1 - Comment out (Already done in migration)**
- All Beds24 routes commented
- All Beds24 hooks commented

**Phase 2 - Archive (After 30 days)**
- Move `backend/src/integrations/beds24/` to `backend/src/_archived/beds24/`
- Move Beds24 controllers to archive folder

**Phase 3 - Remove (After 60 days)**
- Delete archived Beds24 code
- Remove Beds24 dependencies from package.json
- Remove Beds24 tables from database

---

## 8. Implementation Checklist

### Backend Changes (Estimated: 2 hours)

**Phase 1: Routes & API** (30 min)
- [ ] `backend/src/routes.ts` - Comment Beds24 webhook routes
- [ ] `backend/src/services/settings/settings_routes.ts` - Comment all 11 Beds24 routes
- [ ] Verify TypeScript compilation: `npm run build`

**Phase 2: Sync Hooks** (45 min)
- [ ] `backend/src/services/reservations/reservations_controller.ts` - Replace Beds24 hooks with QloApps (2-3 locations)
- [ ] `backend/src/services/rooms/rooms_controller.ts` - Replace Beds24 hooks with QloApps
- [ ] Verify TypeScript compilation: `npm run build`

**Phase 3: Workers** (15 min)
- [ ] Add disable comments to `backend/src/workers/inbound_worker.ts`
- [ ] Add disable comments to `backend/src/workers/outbound_worker.ts`
- [ ] Add disable comments to `backend/src/workers/sync_scheduler.ts`
- [ ] Update `backend/package.json` - rename Beds24 scripts, make QloApps default

**Phase 4: Cleanup** (15 min)
- [ ] Remove Beds24 type import from `backend/src/integrations/qloapps/mappers/room_type_mapper.ts`
- [ ] Update `backend/.env` - comment Beds24 vars, add QloApps vars
- [ ] Update `backend/.env.example` - same as above
- [ ] Final TypeScript compilation check

**Phase 5: Testing** (15 min)
- [ ] Start backend: `npm run dev`
- [ ] Test QloApps endpoint: `curl http://localhost:3000/api/v1/integrations/qloapps/config`
- [ ] Verify Beds24 endpoints return 404

---

### Frontend Changes (Estimated: 2 hours)

**Phase 1: Settings Page** (60 min)
- [ ] `frontend/src/pages/SettingsPage.jsx` - Remove Beds24 state variables
- [ ] Add QloApps state variables
- [ ] Replace Beds24 tab with QloApps tab
- [ ] Replace Beds24 useEffects with QloApps equivalents
- [ ] Test compilation: `npm run build`

**Phase 2: API Client** (20 min)
- [ ] `frontend/src/utils/api.js` - Comment out 11 Beds24 endpoints
- [ ] Add QloApps integrations object with 8 new endpoints
- [ ] Test compilation: `npm run build`

**Phase 3: Cosmetic Changes** (20 min)
- [ ] `frontend/src/pages/RoomTypesPage.jsx` - 3 label/comment changes
- [ ] `frontend/src/pages/AvailabilityPage.jsx` - 1 variable rename
- [ ] `frontend/src/pages/CalendarPage.jsx` - 1 comment change
- [ ] `frontend/src/store/roomsStore.js` - 1 comment change
- [ ] `frontend/src/components/BookingTimeline.jsx` - 1 comment change

**Phase 4: QloApps Component** (30 min)
- [ ] Create `frontend/src/components/QloAppsSettings.jsx`
- [ ] Implement configuration form
- [ ] Implement room type mapping UI
- [ ] Implement sync controls
- [ ] Import and use in SettingsPage.jsx

**Phase 5: Testing** (10 min)
- [ ] `npm run dev` - verify no compilation errors
- [ ] Navigate to Settings → QloApps tab
- [ ] Verify UI renders correctly
- [ ] Check browser console for errors

---

### Worker Migration (Estimated: 30 min)

**Phase 1: Stop Beds24 Workers** (5 min)
```bash
# Find and kill Beds24 workers
ps aux | grep beds24
pkill -f inbound_worker
pkill -f outbound_worker
pkill -f sync_scheduler
```

**Phase 2: Clear Beds24 Queues** (5 min)
```bash
cd backend/scripts
./clear-rabbitmq-queues.sh beds24
```

**Phase 3: Start QloApps Workers** (10 min)
```bash
cd backend

# Terminal 1
npm run worker:qloapps-inbound

# Terminal 2
npm run worker:qloapps-outbound

# Terminal 3
npm run worker:qloapps-sync
```

**Phase 4: Verify Workers** (10 min)
- [ ] Check each worker terminal for startup messages
- [ ] Verify RabbitMQ queues exist: `curl localhost:15672/api/queues`
- [ ] Check worker logs for errors
- [ ] Create test reservation to trigger outbound sync
- [ ] Verify message appears in qloapps.outbound queue

---

### Post-Migration Testing (Estimated: 1 hour)

**Backend Tests** (20 min)
- [ ] TypeScript compilation: `npm run build` (0 errors)
- [ ] API health check: `curl localhost:3000/api/health-check`
- [ ] QloApps config endpoint: `GET /v1/integrations/qloapps/config`
- [ ] Beds24 endpoints return 404
- [ ] Workers running without errors

**Frontend Tests** (20 min)
- [ ] Login to application
- [ ] Navigate to Settings
- [ ] QloApps tab loads
- [ ] Configuration form renders
- [ ] Test connection button works
- [ ] No console errors

**Integration Tests** (20 min)
- [ ] Create reservation in PMS
- [ ] Verify outbound queue has message
- [ ] Outbound worker processes message
- [ ] Check QloApps for new booking
- [ ] Trigger manual sync from UI
- [ ] Verify sync completes

---

## 9. Risk Assessment

### High Risk

**Risk:** QloApps API credentials not configured
- **Impact:** All syncs will fail
- **Mitigation:** Test connection before full migration
- **Rollback:** Re-enable Beds24 (15 min)

**Risk:** Room type mapping not complete
- **Impact:** Reservations can't sync to QloApps
- **Mitigation:** Complete room type mapping before migration
- **Rollback:** Re-enable Beds24

### Medium Risk

**Risk:** Workers fail to start
- **Impact:** No background sync
- **Mitigation:** Test workers in dev environment first
- **Rollback:** Restart Beds24 workers

**Risk:** Database performance issues with QloApps tables
- **Impact:** Slow sync operations
- **Mitigation:** Monitor database query performance
- **Rollback:** Not needed (data isolation)

### Low Risk

**Risk:** Frontend UI bugs
- **Impact:** Settings page not usable
- **Mitigation:** Thorough UI testing before deployment
- **Rollback:** Redeploy previous frontend build (5 min)

---

## 10. Success Criteria

### Must Have (Go/No-Go)
- ✅ All Beds24 routes return 404 or are removed
- ✅ QloApps configuration endpoint accessible
- ✅ QloApps workers start successfully
- ✅ TypeScript compiles without errors (backend & frontend)
- ✅ Frontend loads without console errors
- ✅ Can create reservation and see outbound queue message

### Should Have (Within 24 hours)
- ✅ At least one successful PMS → QloApps reservation sync
- ✅ At least one successful QloApps → PMS reservation sync
- ✅ Room type mappings configured for all room types
- ✅ Availability sync working
- ✅ No worker crashes in first 24 hours

### Nice to Have (Within 1 week)
- ✅ 95%+ sync success rate
- ✅ Average sync time < 10 seconds
- ✅ Zero manual interventions needed
- ✅ Documentation updated

---

## 11. Timeline

### Day 1 (4-6 hours)
- **Morning (2-3 hours):** Backend migration
  - Comment Beds24 routes
  - Replace sync hooks
  - Update workers
  - Test compilation
  
- **Afternoon (2-3 hours):** Frontend migration
  - Update Settings page
  - Update API client
  - Create QloApps component
  - Test UI

### Day 2 (2-4 hours)
- **Morning (1-2 hours):** Worker migration
  - Stop Beds24 workers
  - Start QloApps workers
  - Verify queues
  
- **Afternoon (1-2 hours):** Integration testing
  - End-to-end sync tests
  - Performance testing
  - Bug fixes

### Day 3+ (Ongoing)
- Monitor sync operations
- Address any issues
- Fine-tune configuration
- Update documentation

---

## 12. Appendix

### A. File Change Summary

**Backend Files to Modify (13 files):**
1. `src/routes.ts` - Remove Beds24 webhook routes
2. `src/services/settings/settings_routes.ts` - Comment 11 Beds24 routes
3. `src/services/reservations/reservations_controller.ts` - Replace Beds24 hooks (3 locations)
4. `src/services/rooms/rooms_controller.ts` - Replace Beds24 hooks
5. `src/services/admin/channel_events_controller.ts` - Update imports (optional)
6. `src/workers/inbound_worker.ts` - Add disable comment
7. `src/workers/outbound_worker.ts` - Add disable comment
8. `src/workers/sync_scheduler.ts` - Add disable comment
9. `src/integrations/qloapps/mappers/room_type_mapper.ts` - Remove Beds24 import
10. `package.json` - Update worker scripts
11. `.env` - Comment Beds24 vars, add QloApps
12. `.env.example` - Same as .env

**Frontend Files to Modify (7 files):**
1. `src/pages/SettingsPage.jsx` - Major refactor (~800 lines affected)
2. `src/utils/api.js` - Comment Beds24 endpoints, add QloApps
3. `src/pages/RoomTypesPage.jsx` - 3 cosmetic changes
4. `src/pages/AvailabilityPage.jsx` - 1 variable rename
5. `src/pages/CalendarPage.jsx` - 1 comment change
6. `src/store/roomsStore.js` - 1 comment change
7. `src/components/BookingTimeline.jsx` - 1 comment change

**Frontend Files to Create (1 file):**
1. `src/components/QloAppsSettings.jsx` - New component (~400-500 lines)

**Total:** 21 files to modify/create

---

### B. Database Tables (No Changes Needed)

**Beds24 Tables (Keep but unused):**
- `beds24_config`
- `beds24_room_mappings`
- `channel_events` (can be reused for QloApps)
- `sync_conflicts` (can be reused for QloApps)
- `webhook_events` (Beds24-specific, not used by QloApps)

**QloApps Tables (Already exist from Phase 1):**
- `qloapps_config`
- `qloapps_room_type_mappings`
- `qloapps_reservation_mappings`
- `qloapps_customer_mappings`
- `qloapps_sync_state`
- `qloapps_sync_logs`

---

### C. Environment Variables

**Required QloApps Variables:**
```env
# QloApps API Configuration
QLOAPPS_API_URL=https://your-hotel.qloapps.com
QLOAPPS_API_KEY=your_api_key_here
QLOAPPS_HOTEL_ID=1

# QloApps Sync Configuration
QLOAPPS_SYNC_INTERVAL_MS=300000
QLOAPPS_PULL_SYNC_ENABLED=true
QLOAPPS_PUSH_SYNC_ENABLED=true

# QloApps Rate Limiting
QLOAPPS_MAX_REQUESTS_PER_SECOND=10
QLOAPPS_MAX_RETRIES=3
```

---

### D. Commands Reference

**Backend:**
```bash
# Build
npm run build

# Start dev server
npm run dev

# Start workers
npm run worker:qloapps-inbound
npm run worker:qloapps-outbound
npm run worker:qloapps-sync

# Check TypeScript
npx tsc --noEmit

# Run database migrations
npm run migrate

# Clear RabbitMQ queues
./scripts/clear-rabbitmq-queues.sh
```

**Frontend:**
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

**RabbitMQ:**
```bash
# List queues
curl -u guest:guest http://localhost:15672/api/queues

# Delete a queue
curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2F/beds24.inbound

# View queue messages
curl -u guest:guest http://localhost:15672/api/queues/%2F/qloapps.outbound
```

---

## Summary

This migration plan provides a comprehensive, step-by-step approach to disabling Beds24 and enabling QloApps integration. The process is designed to be:

1. **Non-destructive** - No data deletion, Beds24 code commented not deleted
2. **Reversible** - Can roll back to Beds24 in 15-30 minutes if needed
3. **Testable** - Clear testing checkpoints at each phase
4. **Low-risk** - Gradual migration with validation steps

**Total Estimated Time:** 4-6 hours for initial migration + 2-4 hours for testing and validation

**Next Steps:**
1. Review this plan with the team
2. Schedule migration window (recommend off-peak hours)
3. Backup database before starting
4. Execute Backend Migration (Phase 1)
5. Execute Frontend Migration (Phase 2)
6. Execute Worker Migration (Phase 3)
7. Run Integration Tests (Phase 4)
8. Monitor for 24-48 hours
9. Update documentation

**Questions or concerns?** Review the Risk Assessment and Rollback Plan sections.
