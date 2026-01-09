# Channel Manager Strategy Pattern Design

**Document Version:** 2.0  
**Date:** January 6, 2026  
**Status:** Implementation Ready (QloApps Only)  
**Pattern:** Strategy + Factory + Adapter  
**Approach:** Incremental - QloApps with Strategy, Beds24 remains as-is

---

## 🎯 Quick Summary

### What's Changed from v1.0?

**v1.0 Approach** (Full Migration - 2-3 weeks):
- Migrate BOTH Beds24 and QloApps to Strategy Pattern
- Create full abstraction layer
- Modify all integration points

**v2.0 Approach** (Incremental - 3-4 days):
- ✅ Implement Strategy Pattern for **QloApps ONLY**
- ❌ **DO NOT** migrate Beds24 (keep as-is)
- ✅ Lightweight service (not full context pattern)
- ✅ Conditional logic in controllers (if QloApps → strategy, if Beds24 → direct)

### Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Beds24** | Keep direct integration | Works well, no need to change |
| **QloApps** | Use Strategy Pattern | New integration, clean architecture |
| **Service** | Lightweight facade | Only manages QloApps, not full context |
| **Controllers** | Conditional logic | Check active manager, route accordingly |
| **Timeline** | 3-4 days | Much faster than full migration |

### What Gets Built

```
✨ NEW FILES (7):
   - types.ts (simplified)
   - channel_manager_service.ts (lightweight)
   - strategies/qloapps_strategy.ts (adapter)
   - Database migration

✏️ MODIFIED FILES (6):
   - app.ts (+5 lines)
   - routes.ts (+20 lines)
   - reservations_controller.ts (+30 lines)
   - rooms_controller.ts (+20 lines)
   - settings_routes.ts (+40 lines)
   - SettingsPage.jsx (+100 lines)

✅ UNCHANGED:
   - All Beds24 code
   - All QloApps core code
   - All mappers, clients, services
```

### User Experience

**Before:**
- Beds24 hardcoded everywhere
- QloApps Phase 1-5 complete but not enabled

**After:**
- UI toggle in Settings: "Active Channel Manager: [Beds24] [QloApps]"
- Click to switch (instant)
- Both configurations visible
- Clear indicator of which is active

---

## Table of Contents

1. [Overview](#1-overview)
2. [Modified Architecture](#2-modified-architecture)
3. [Incremental Implementation Plan](#3-incremental-implementation-plan)
4. [Benefits](#4-benefits)
5. [Usage Examples](#5-usage-examples)
6. [Migration Strategy](#6-migration-strategy)
7. [Phase 1: QloApps Strategy Implementation](#7-phase-1-qloapps-strategy-implementation)
8. [Phase 2: Future Beds24 Migration](#8-phase-2-future-beds24-migration)

---

## 1. Overview

### Purpose
Implement a pluggable channel manager integration system using the Strategy Pattern with an **incremental approach**:
- **Phase 1 (Now)**: Implement Strategy Pattern for QloApps only
- **Phase 2 (Future)**: Migrate Beds24 to Strategy Pattern when needed
- **Current State**: Beds24 remains as-is (direct integration)

### Why This Approach?

1. **Lower Risk**: Don't modify working Beds24 code
2. **Faster Implementation**: Only wrap QloApps (~3-4 days vs 2-3 weeks)
3. **Prove the Pattern**: Validate Strategy Pattern with QloApps first
4. **Incremental Migration**: Migrate Beds24 later when business requires it
5. **Immediate QloApps Enablement**: Get QloApps live faster

### Design Principles
1. **Open/Closed Principle**: Open for extension, closed for modification
2. **Dependency Inversion**: Depend on abstractions where beneficial
3. **Single Responsibility**: Each channel manager handles only its own logic
4. **Pragmatic Architecture**: Use patterns where they add value, not everywhere

---

## 2. Modified Architecture

### 2.1 Current State (Phase 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                      PMS APPLICATION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Controllers (Reservations, Rooms, Availability)                │
│       │                                │                         │
│       │ (Direct)                       │ (Strategy)              │
│       ▼                                ▼                         │
│  ┌──────────────┐          ┌───────────────────────┐           │
│  │ Beds24 Hooks │          │ ChannelManagerService │           │
│  │ (Existing)   │          │ (Lightweight Facade)   │           │
│  └──────┬───────┘          └──────────┬────────────┘           │
│         │                              │                         │
│         │                              ▼                         │
│         │                   ┌────────────────────┐              │
│         │                   │ IChannelManager    │              │
│         │                   │ Strategy Interface │              │
│         │                   └──────────┬─────────┘              │
│         │                              │                         │
│         │                              ▼                         │
│         │                   ┌────────────────────┐              │
│         │                   │ QloAppsStrategy    │              │
│         │                   │ (Adapter)          │              │
│         │                   └──────────┬─────────┘              │
│         │                              │                         │
│         ▼                              ▼                         │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │ Beds24Client     │      │ QloAppsClient    │                │
│  │ Beds24Services   │      │ QloAppsServices  │                │
│  │ (No Changes)     │      │ (No Changes)     │                │
│  └──────────────────┘      └──────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Key Points:
✅ QloApps uses Strategy Pattern
❌ Beds24 keeps direct integration (no changes)
✅ ChannelManagerService is simple facade (not full context)
✅ Controllers call Beds24 directly OR ChannelManagerService for QloApps
```

### 2.2 Application Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Reservation Created/Updated                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Reservation Controller                                      │
│                                                              │
│  • Check active channel manager (from settings)             │
│                                                              │
│  ┌─────────────────┐           ┌────────────────────┐      │
│  │ If Beds24:      │           │ If QloApps:        │      │
│  │ - Direct call   │           │ - Use strategy     │      │
│  └────────┬────────┘           └────────┬───────────┘      │
│           │                              │                   │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────┐      ┌──────────────────────────┐
│ Beds24 Hooks        │      │ ChannelManagerService    │
│ (queueReservation   │      │ .syncReservation()       │
│  SyncHook)          │      │                          │
└─────────────────────┘      └──────────┬───────────────┘
                                        │
                                        ▼
                             ┌──────────────────────────┐
                             │ QloAppsStrategy          │
                             │ .syncReservation()       │
                             └──────────┬───────────────┘
                                        │
                                        ▼
                             ┌──────────────────────────┐
                             │ QloApps Hooks            │
                             │ (queueQloApps...Hook)    │
                             └──────────────────────────┘
```

---

## 3. Incremental Implementation Plan

### Phase 1: QloApps with Strategy Pattern (3-4 Days)

#### Goal
Enable QloApps using Strategy Pattern while keeping Beds24 integration unchanged.

#### Files to Create (7 new files)

1. **`src/integrations/channel-manager/types.ts`** (~200 lines)
   - Core interfaces (simplified for QloApps only)
   - `IChannelManagerStrategy` interface
   - Common data types

2. **`src/integrations/channel-manager/channel_manager_service.ts`** (~150 lines)
   - Lightweight facade (not full context pattern)
   - Only manages QloApps strategy
   - Simple delegation methods

3. **`src/integrations/channel-manager/strategies/qloapps_strategy.ts`** (~200 lines)
   - QloApps adapter implementation
   - Wraps existing QloApps hooks and services

4. **`src/integrations/channel-manager/index.ts`** (~20 lines)
   - Exports for easy importing

#### Files to Modify (3 files)

1. **`backend/src/app.ts`** (+5 lines)
   - Initialize ChannelManagerService on startup
   ```typescript
   import { channelManagerService } from './integrations/channel-manager/index.js';
   await channelManagerService.initialize();
   ```

2. **`backend/src/routes.ts`** (+20 lines)
   - Add conditional logic to use QloApps via strategy
   - Keep Beds24 routes unchanged

3. **`backend/src/services/reservations/reservations_controller.ts`** (+30 lines)
   - Add logic to check active channel manager
   - Call strategy for QloApps, direct for Beds24

#### Database Changes

**Migration: Add active_channel_manager column**
```sql
ALTER TABLE hotel_settings 
ADD COLUMN active_channel_manager VARCHAR(50) 
COMMENT 'Active channel manager: beds24 or qloapps';

CREATE INDEX idx_hotel_settings_active_channel_manager 
ON hotel_settings(active_channel_manager);
```

#### Frontend Changes (Minimal)

1. **`frontend/src/pages/SettingsPage.jsx`**
   - Add "Active Channel Manager" selector (Radio: Beds24 / QloApps)
   - Keep both configuration tabs
   - Show which one is currently active

---

## 7. Phase 1: QloApps Strategy Implementation

### 7.1 Implementation Checklist

#### Day 1: Core Infrastructure (4 hours)

- [ ] Create `src/integrations/channel-manager/` directory
- [ ] Implement `types.ts` with simplified interfaces (QloApps focused)
- [ ] Implement `channel_manager_service.ts` (lightweight, QloApps only)
- [ ] Create database migration for `active_channel_manager`
- [ ] Run migration

#### Day 2: QloApps Strategy (4 hours)

- [ ] Create `strategies/qloapps_strategy.ts`
- [ ] Implement all interface methods
- [ ] Delegate to existing QloApps hooks
- [ ] Add error handling and logging
- [ ] Write unit tests for strategy

#### Day 3: Application Integration (4 hours)

- [ ] Update `src/app.ts` to initialize service
- [ ] Modify `reservations_controller.ts`:
  - Add conditional logic for active channel manager
  - Use strategy for QloApps
  - Keep Beds24 direct calls
- [ ] Modify `rooms_controller.ts` (similar pattern)
- [ ] Update `routes.ts` if needed
- [ ] Test backend integration

#### Day 4: Frontend & Testing (4 hours)

- [ ] Update `SettingsPage.jsx`:
  - Add channel manager selector
  - Show active/inactive status
  - Test connection button for both
- [ ] Update `api.js`:
  - Add endpoint for switching channel manager
- [ ] End-to-end testing:
  - Switch to QloApps
  - Create/update/cancel reservation
  - Verify sync to QloApps
  - Switch to Beds24
  - Verify Beds24 still works
- [ ] Deploy to staging

---

### 7.2 Detailed Implementation Steps

#### Step 1: Create Simplified Types

**File: `src/integrations/channel-manager/types.ts`**

```typescript
/**
 * Simplified Strategy Pattern Types (QloApps Only for Now)
 */

export interface ChannelManagerConfig {
  name: 'qloapps' | 'beds24';
  displayName: string;
  enabled: boolean;
  syncEnabled: boolean;
}

export interface SyncReservationInput {
  reservationId: string;
  action: 'create' | 'update' | 'cancel';
}

export interface SyncAvailabilityInput {
  roomTypeId: string;
  dateFrom: string;
  dateTo: string;
}

export interface SyncResult {
  success: boolean;
  operationType: string;
  itemsProcessed: number;
  duration: number;
  error?: string;
}

/**
 * Core Strategy Interface (simplified)
 */
export interface IChannelManagerStrategy {
  getName(): string;
  isEnabled(): Promise<boolean>;
  syncReservation(input: SyncReservationInput): Promise<SyncResult>;
  syncAvailability(input: SyncAvailabilityInput): Promise<SyncResult>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}
```

#### Step 2: Lightweight Channel Manager Service

**File: `src/integrations/channel-manager/channel_manager_service.ts`**

```typescript
/**
 * Lightweight Channel Manager Service
 * Only manages QloApps strategy for now
 */

import db from '../../config/database.js';
import type { IChannelManagerStrategy, SyncReservationInput } from './types.js';
import { QloAppsChannelStrategy } from './strategies/qloapps_strategy.js';

export class ChannelManagerService {
  private static instance: ChannelManagerService;
  private qloAppsStrategy: QloAppsChannelStrategy;
  private activeChannelManager: 'beds24' | 'qloapps' | null = null;

  private constructor() {
    this.qloAppsStrategy = new QloAppsChannelStrategy();
  }

  public static getInstance(): ChannelManagerService {
    if (!ChannelManagerService.instance) {
      ChannelManagerService.instance = new ChannelManagerService();
    }
    return ChannelManagerService.instance;
  }

  public async initialize(): Promise<void> {
    console.log('[ChannelManager] Initializing...');
    await this.qloAppsStrategy.initialize();
    await this.loadActiveChannelManager();
    console.log(`[ChannelManager] Active: ${this.activeChannelManager}`);
  }

  private async loadActiveChannelManager(): Promise<void> {
    const propertyId = '00000000-0000-0000-0000-000000000001';
    const settings = await db('hotel_settings').where({ id: propertyId }).first();
    this.activeChannelManager = settings?.active_channel_manager || 'beds24';
  }

  public getActiveChannelManager(): 'beds24' | 'qloapps' | null {
    return this.activeChannelManager;
  }

  public isQloAppsActive(): boolean {
    return this.activeChannelManager === 'qloapps';
  }

  public async switchTo(channelManager: 'beds24' | 'qloapps'): Promise<void> {
    const propertyId = '00000000-0000-0000-0000-000000000001';
    await db('hotel_settings')
      .where({ id: propertyId })
      .update({ active_channel_manager: channelManager });
    
    this.activeChannelManager = channelManager;
    console.log(`[ChannelManager] Switched to: ${channelManager}`);
  }

  // Delegate to QloApps strategy
  public async syncReservation(input: SyncReservationInput): Promise<any> {
    if (!this.isQloAppsActive()) {
      throw new Error('QloApps is not active');
    }
    return this.qloAppsStrategy.syncReservation(input);
  }

  public async syncAvailability(input: any): Promise<any> {
    if (!this.isQloAppsActive()) {
      throw new Error('QloApps is not active');
    }
    return this.qloAppsStrategy.syncAvailability(input);
  }

  public async testQloAppsConnection(): Promise<any> {
    return this.qloAppsStrategy.testConnection();
  }
}

export const channelManagerService = ChannelManagerService.getInstance();
```

#### Step 3: QloApps Strategy Adapter

**File: `src/integrations/channel-manager/strategies/qloapps_strategy.ts`**

```typescript
/**
 * QloApps Strategy Adapter
 */

import type { IChannelManagerStrategy, SyncReservationInput } from '../types.js';
import db from '../../../config/database.js';

export class QloAppsChannelStrategy implements IChannelManagerStrategy {
  getName(): string {
    return 'qloapps';
  }

  async initialize(): Promise<void> {
    console.log('[QloAppsStrategy] Initialized');
  }

  async isEnabled(): Promise<boolean> {
    const propertyId = '00000000-0000-0000-0000-000000000001';
    const config = await db('qloapps_config')
      .where({ property_id: propertyId })
      .whereNull('deleted_at')
      .first();
    return config?.sync_enabled === true;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Delegate to existing QloApps test logic
      const { QloAppsClient } = await import('../../qloapps/qloapps_client.js');
      // ... test connection logic
      return { success: true, message: 'Connected to QloApps' };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  async syncReservation(input: SyncReservationInput): Promise<any> {
    const startTime = Date.now();
    try {
      // Delegate to existing QloApps hooks
      const { queueQloAppsReservationSyncHook } = await import(
        '../../qloapps/hooks/sync_hooks.js'
      );
      
      await queueQloAppsReservationSyncHook(input.reservationId, input.action);
      
      return {
        success: true,
        operationType: 'reservation',
        itemsProcessed: 1,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'reservation',
        itemsProcessed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncAvailability(input: any): Promise<any> {
    const startTime = Date.now();
    try {
      const { queueQloAppsAvailabilitySyncHook } = await import(
        '../../qloapps/hooks/sync_hooks.js'
      );
      
      await queueQloAppsAvailabilitySyncHook(
        input.roomTypeId,
        input.dateFrom,
        input.dateTo
      );
      
      return {
        success: true,
        operationType: 'availability',
        itemsProcessed: 1,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'availability',
        itemsProcessed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

#### Step 4: Update Reservation Controller

**File: `backend/src/services/reservations/reservations_controller.ts`**

Add at the top:
```typescript
import { channelManagerService } from '../../integrations/channel-manager/index.js';
```

Modify sync logic in create/update handlers:
```typescript
// Old approach (direct Beds24 call):
// import { queueReservationSyncHook } from '../../integrations/beds24/hooks/sync_hooks.js';
// await queueReservationSyncHook(reservation.id, 'create');

// New approach (conditional):
const activeManager = channelManagerService.getActiveChannelManager();

if (activeManager === 'qloapps') {
  // Use strategy
  await channelManagerService.syncReservation({
    reservationId: reservation.id,
    action: 'create',
  });
} else if (activeManager === 'beds24') {
  // Direct Beds24 call (unchanged)
  const { queueReservationSyncHook } = await import(
    '../../integrations/beds24/hooks/sync_hooks.js'
  );
  await queueReservationSyncHook(reservation.id, 'create');
}
```

#### Step 5: Frontend Settings Update

**File: `frontend/src/pages/SettingsPage.jsx`**

Add channel manager selector:
```jsx
const [activeChannelManager, setActiveChannelManager] = useState('beds24');

useEffect(() => {
  // Fetch active channel manager
  api.settings.getActiveChannelManager().then(data => {
    setActiveChannelManager(data.active);
  });
}, []);

const handleSwitchChannelManager = async (manager) => {
  try {
    await api.settings.switchChannelManager(manager);
    setActiveChannelManager(manager);
    toast.success(`Switched to ${manager === 'qloapps' ? 'QloApps' : 'Beds24'}`);
  } catch (error) {
    toast.error(`Failed to switch: ${error.message}`);
  }
};

return (
  <div className="settings-page">
    <h2>Channel Manager Settings</h2>
    
    {/* Channel Manager Selector */}
    <div className="channel-manager-selector">
      <h3>Active Channel Manager</h3>
      <div className="radio-group">
        <label>
          <input
            type="radio"
            value="beds24"
            checked={activeChannelManager === 'beds24'}
            onChange={() => handleSwitchChannelManager('beds24')}
          />
          Beds24
          {activeChannelManager === 'beds24' && (
            <span className="badge badge-success">Active</span>
          )}
        </label>
        
        <label>
          <input
            type="radio"
            value="qloapps"
            checked={activeChannelManager === 'qloapps'}
            onChange={() => handleSwitchChannelManager('qloapps')}
          />
          QloApps
          {activeChannelManager === 'qloapps' && (
            <span className="badge badge-success">Active</span>
          )}
        </label>
      </div>
    </div>

    {/* Existing Beds24 Config Tab */}
    {/* Existing QloApps Config Tab */}
  </div>
);
```

---

### 7.3 Testing Plan

#### Unit Tests
- [ ] Test QloAppsChannelStrategy methods
- [ ] Test ChannelManagerService initialization
- [ ] Test channel manager switching

#### Integration Tests
- [ ] Create reservation with QloApps active → verify queued to QloApps
- [ ] Create reservation with Beds24 active → verify queued to Beds24
- [ ] Switch from Beds24 to QloApps → verify next sync uses QloApps
- [ ] Test connection for both managers

#### E2E Tests
- [ ] Complete reservation flow with QloApps
- [ ] Complete reservation flow with Beds24
- [ ] Switch channel managers mid-session
- [ ] Verify workers process correct queues

---

## 8. Phase 2: Future Beds24 Migration (Optional)

### When to Migrate Beds24?

Consider migrating Beds24 to Strategy Pattern when:
1. **Business requirement** to switch between managers frequently
2. **Need to run both** Beds24 and QloApps simultaneously
3. **Adding a 3rd channel manager** (then it makes sense)
4. **Technical debt reduction** initiative

### Migration Effort
- **Time**: 2-3 days
- **Risk**: Low (QloApps pattern already proven)
- **Files**: Create `strategies/beds24_strategy.ts`, update factory

### Not Urgent Because:
- ✅ Beds24 works well as-is
- ✅ Pattern is proven with QloApps
- ✅ Can migrate later without breaking changes
- ✅ Focus on getting QloApps live first

---

## 4. Benefits

### 4.1 Incremental Approach Benefits

✅ **Lower Risk**: Don't touch working Beds24 code  
✅ **Faster Delivery**: 3-4 days vs 2-3 weeks  
✅ **Prove Pattern First**: Validate with QloApps before full migration  
✅ **Easier Testing**: Less code changes = less testing  
✅ **Flexible**: Can add Beds24 to strategy later if needed

### 4.2 QloApps Benefits

✅ **Clean Interface**: QloApps wrapped in strategy pattern  
✅ **Easy Switching**: Toggle between Beds24/QloApps with UI  
✅ **Testable**: Mock strategy for unit tests  
✅ **Maintainable**: Clear separation of concerns

### 4.3 Future-Ready

✅ **Pattern Established**: Easy to add more strategies later  
✅ **No Rework**: When migrating Beds24, just create adapter  
✅ **Proven Architecture**: Pattern validated with real usage

---

## 5. Usage Examples

### 5.1 Controller Usage (Conditional Logic)

```typescript
// src/services/reservations/reservations_controller.ts

import { channelManagerService } from '../../integrations/channel-manager/index.js';

export async function createReservationHandler(req, res, next) {
  try {
    // Create reservation in database
    const reservation = await createReservation(req.body);
    
    // Sync to active channel manager
    const activeManager = channelManagerService.getActiveChannelManager();
    
    if (activeManager === 'qloapps') {
      // Use strategy pattern
      await channelManagerService.syncReservation({
        reservationId: reservation.id,
        action: 'create',
      });
    } else if (activeManager === 'beds24') {
      // Direct Beds24 call (existing approach)
      const { queueReservationSyncHook } = await import(
        '../../integrations/beds24/hooks/sync_hooks.js'
      );
      await queueReservationSyncHook(reservation.id, 'create');
    }
    
    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
}
```

### 5.2 Settings Page - Switch Channel Manager

```jsx
// frontend/src/pages/SettingsPage.jsx

const ChannelManagerSelector = () => {
  const [active, setActive] = useState('beds24');
  
  const handleSwitch = async (manager) => {
    try {
      await api.settings.switchChannelManager(manager);
      setActive(manager);
      toast.success(`Switched to ${manager}`);
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  return (
    <div className="channel-manager-selector">
      <h3>Active Channel Manager</h3>
      
      <div className="radio-group">
        <label className={active === 'beds24' ? 'active' : ''}>
          <input
            type="radio"
            value="beds24"
            checked={active === 'beds24'}
            onChange={() => handleSwitch('beds24')}
          />
          <div>
            <strong>Beds24</strong>
            {active === 'beds24' && <span className="badge">Active</span>}
          </div>
        </label>
        
        <label className={active === 'qloapps' ? 'active' : ''}>
          <input
            type="radio"
            value="qloapps"
            checked={active === 'qloapps'}
            onChange={() => handleSwitch('qloapps')}
          />
          <div>
            <strong>QloApps</strong>
            {active === 'qloapps' && <span className="badge">Active</span>}
          </div>
        </label>
      </div>
      
      <button onClick={testConnection}>Test Connection</button>
    </div>
  );
};
```

### 5.3 Backend Routes

```typescript
// src/routes.ts or settings_routes.ts

import { channelManagerService } from './integrations/channel-manager/index.js';

// Get active channel manager
router.get('/api/v1/settings/channel-manager', async (req, res) => {
  const active = channelManagerService.getActiveChannelManager();
  const qloAppsEnabled = await channelManagerService.isQloAppsActive();
  
  res.json({
    active,
    qloAppsEnabled,
    available: ['beds24', 'qloapps'],
  });
});

// Switch channel manager
router.post('/api/v1/settings/channel-manager/switch', async (req, res) => {
  const { channelManager } = req.body;
  
  if (!['beds24', 'qloapps'].includes(channelManager)) {
    return res.status(400).json({ error: 'Invalid channel manager' });
  }
  
  await channelManagerService.switchTo(channelManager);
  
  res.json({
    success: true,
    message: `Switched to ${channelManager}`,
    active: channelManager,
  });
});

// Test QloApps connection
router.post('/api/v1/settings/qloapps/test-connection', async (req, res) => {
  const result = await channelManagerService.testQloAppsConnection();
  res.json(result);
});
```

---

## 6. Migration Strategy

### Phase 1: QloApps Strategy (Now) - 3-4 Days

**Day 1: Infrastructure**
- Create strategy types and interfaces
- Create lightweight service
- Database migration

**Day 2: QloApps Adapter**
- Implement QloAppsChannelStrategy
- Delegate to existing hooks
- Unit tests

**Day 3: Backend Integration**
- Update app.ts initialization
- Modify controllers (conditional logic)
- Add settings routes

**Day 4: Frontend & Testing**
- Update SettingsPage.jsx
- Add channel manager selector
- E2E testing
- Deploy to staging

### Phase 2: Beds24 Strategy (Future) - Optional

**When Needed:**
- Business requires frequent switching
- Need to run both simultaneously
- Adding 3rd channel manager

**Effort:**
- 2-3 days
- Create `strategies/beds24_strategy.ts`
- Remove conditional logic from controllers
- Use strategy for both

---

## 9. File Structure (Phase 1)

```
backend/
├── src/
│   ├── app.ts                          # ✏️ Modified (+5 lines)
│   ├── routes.ts                       # ✏️ Modified (+20 lines)
│   ├── integrations/
│   │   ├── channel-manager/            # ✨ NEW DIRECTORY
│   │   │   ├── types.ts                # ✨ NEW (simplified interfaces)
│   │   │   ├── channel_manager_service.ts  # ✨ NEW (lightweight)
│   │   │   ├── strategies/
│   │   │   │   ├── qloapps_strategy.ts # ✨ NEW (QloApps adapter)
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── beds24/                     # ✅ UNCHANGED
│   │   │   ├── beds24_client.ts
│   │   │   ├── hooks/
│   │   │   └── ... (all existing code)
│   │   └── qloapps/                    # ✅ UNCHANGED
│   │       ├── qloapps_client.ts
│   │       ├── hooks/
│   │       └── ... (all existing code)
│   ├── services/
│   │   ├── reservations/
│   │   │   └── reservations_controller.ts  # ✏️ Modified (+30 lines)
│   │   ├── rooms/
│   │   │   └── rooms_controller.ts     # ✏️ Modified (+20 lines)
│   │   └── settings/
│   │       └── settings_routes.ts      # ✏️ Modified (+40 lines)
│   └── database/
│       └── migrations/
│           └── 20260106000000_add_active_channel_manager.ts  # ✨ NEW

frontend/
├── src/
│   ├── pages/
│   │   └── SettingsPage.jsx            # ✏️ Modified (+100 lines)
│   └── utils/
│       └── api.js                      # ✏️ Modified (+20 lines)

docs/
└── CHANNEL_MANAGER_STRATEGY_PATTERN.md # ✏️ This document (updated)
```

**Summary:**
- ✨ **7 new files** (Strategy Pattern infrastructure)
- ✏️ **6 modified files** (Integration points)
- ✅ **All existing Beds24/QloApps code unchanged**

---

## 10. Implementation Timeline

### Week 1 (3-4 Days)

| Day | Task | Hours | Status |
|-----|------|-------|--------|
| 1 | Strategy infrastructure + DB migration | 4h | ⏳ Pending |
| 2 | QloApps strategy adapter | 4h | ⏳ Pending |
| 3 | Backend integration (controllers, routes) | 4h | ⏳ Pending |
| 4 | Frontend + E2E testing | 4h | ⏳ Pending |

**Total: 16 hours (3-4 days)**

### Future (Optional)

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 2 | Migrate Beds24 to strategy | 2-3 days | Low |
| 3 | Add 3rd channel manager | 1-2 days | Future |

---

## 11. Risk Assessment

### Phase 1 (QloApps Strategy)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| QloApps sync breaks | High | Low | Thorough testing, keep old code as fallback |
| Performance degradation | Medium | Low | Strategy adds minimal overhead (~1ms) |
| Beds24 accidentally affected | High | Very Low | No Beds24 code changes |
| Frontend bugs | Low | Medium | Incremental testing, feature flag |

**Overall Risk: LOW**

### Phase 2 (Beds24 Strategy - Future)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Beds24 sync breaks | High | Low | Pattern already proven with QloApps |
| Refactor takes longer | Low | Medium | Can postpone if not urgent |

---

## 12. Success Criteria

### Phase 1 Completion Criteria

- [ ] ✅ QloApps strategy adapter implemented
- [ ] ✅ Channel manager service initialized on startup
- [ ] ✅ Database migration completed
- [ ] ✅ Settings UI allows switching between Beds24/QloApps
- [ ] ✅ Creating reservation syncs to active manager (QloApps or Beds24)
- [ ] ✅ Updating reservation syncs correctly
- [ ] ✅ Canceling reservation syncs correctly
- [ ] ✅ Room availability syncs to active manager
- [ ] ✅ Beds24 integration still works (no regression)
- [ ] ✅ All existing tests pass
- [ ] ✅ New unit tests for strategy added
- [ ] ✅ E2E tests for switching managers pass
- [ ] ✅ Documentation updated

### Key Metrics

- **Switch Time**: < 1 second (UI toggle)
- **Sync Latency**: No increase compared to direct integration
- **Test Coverage**: > 80% for new strategy code
- **Zero Downtime**: Deployment without service interruption
- **Rollback Time**: < 5 minutes if needed

---

## 13. Rollback Plan

### If Issues Occur During Phase 1

**Option 1: Disable Strategy (Quick - 2 minutes)**
```typescript
// In channel_manager_service.ts
public isQloAppsActive(): boolean {
  return false; // Force disable, fallback to Beds24
}
```

**Option 2: Database Rollback (5 minutes)**
```sql
-- Set active manager back to Beds24
UPDATE hotel_settings 
SET active_channel_manager = 'beds24';
```

**Option 3: Code Rollback (10 minutes)**
- Revert commits
- Rollback database migration
- Deploy previous version

### Data Safety
- ✅ No data loss risk (strategy just wraps existing code)
- ✅ No schema changes to core tables
- ✅ Queue messages remain intact
- ✅ Existing sync logs preserved

---

## 14. Next Steps

### Immediate Actions (Before Implementation)

1. **Review this plan** with stakeholders
2. **Approve incremental approach** (QloApps first, Beds24 later)
3. **Create feature branch**: `feature/qloapps-strategy-pattern`
4. **Schedule 4-day implementation window**
5. **Set up staging environment testing**

### Implementation Start

1. Create strategy infrastructure (Day 1)
2. Implement QloApps adapter (Day 2)
3. Integrate with backend (Day 3)
4. Frontend + testing (Day 4)
5. Deploy to staging → production

### Post-Implementation

1. Monitor QloApps sync performance
2. Gather user feedback on switching UX
3. Document lessons learned
4. Decide on Beds24 migration timeline (if needed)

---

## 15. Summary

### Why This Approach?

✅ **Pragmatic**: Pattern where it adds value (QloApps), direct where it works (Beds24)  
✅ **Low Risk**: No changes to proven Beds24 code  
✅ **Fast**: 3-4 days vs 2-3 weeks for full migration  
✅ **Flexible**: Can migrate Beds24 later if business needs it  
✅ **Proven**: Validate pattern with QloApps first

### What Gets Done Now?

- ✅ QloApps wrapped in Strategy Pattern
- ✅ Easy switching between Beds24/QloApps via UI
- ✅ Clean architecture for QloApps integration
- ✅ Foundation for future channel managers

### What Can Wait?

- ⏳ Beds24 strategy adapter (works fine as-is)
- ⏳ Full abstraction layer (not needed yet)
- ⏳ 3rd channel manager support (future requirement)

**Estimated Time: 3-4 days**  
**Risk Level: Low**  
**ROI: High (QloApps live, pattern proven, Beds24 untouched)**

---

*End of Document*

```typescript
/**
 * Common types shared across all channel manager strategies
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ChannelManagerConfig {
  id: string;
  name: 'beds24' | 'qloapps' | string;
  displayName: string;
  enabled: boolean;
  syncEnabled: boolean;
  pushSyncEnabled: boolean;
  pullSyncEnabled: boolean;
  lastSyncAt?: Date;
  propertyId: string;
}

// ============================================================================
// Sync Operation Types
// ============================================================================

export interface SyncReservationInput {
  reservationId: string;
  action: 'create' | 'update' | 'cancel';
  reservation?: ReservationData;
  priority?: number;
}

export interface SyncAvailabilityInput {
  roomTypeId: string;
  dateFrom: string;
  dateTo: string;
  availability?: number;
}

export interface SyncRatesInput {
  roomTypeId: string;
  dateFrom: string;
  dateTo: string;
  rates?: DailyRate[];
}

export interface PullReservationsOptions {
  dateFrom?: string;
  dateTo?: string;
  syncType?: 'full' | 'incremental';
  modifiedSince?: Date;
}

// ============================================================================
// Result Types
// ============================================================================

export interface SyncResult {
  success: boolean;
  operationType: 'reservation' | 'availability' | 'rates' | 'pull';
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  apiVersion?: string;
  capabilities?: string[];
  error?: string;
}

export interface RoomTypeMapping {
  id: string;
  pmsRoomTypeId: string;
  externalRoomTypeId: string;
  pmsRoomTypeName: string;
  externalRoomTypeName: string;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  isActive: boolean;
}

// ============================================================================
// Data Transfer Objects
// ============================================================================

export interface ReservationData {
  id: string;
  roomTypeId: string;
  roomId?: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
  source: string;
  specialRequests?: string;
  numberOfGuests: number;
  primaryGuestName: string;
  primaryGuestEmail?: string;
  primaryGuestPhone?: string;
}

export interface DailyRate {
  date: string;
  rate: number;
  currency: string;
}

// ============================================================================
// Strategy Interface
// ============================================================================

/**
 * Core interface that all channel manager strategies must implement
 */
export interface IChannelManagerStrategy {
  /**
   * Get the strategy name (e.g., 'beds24', 'qloapps')
   */
  getName(): string;

  /**
   * Get the display name
   */
  getDisplayName(): string;

  /**
   * Check if the strategy is currently enabled
   */
  isEnabled(): Promise<boolean>;

  /**
   * Get current configuration
   */
  getConfig(): Promise<ChannelManagerConfig>;

  /**
   * Test connection to channel manager
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Sync a reservation to channel manager (create, update, or cancel)
   */
  syncReservation(input: SyncReservationInput): Promise<SyncResult>;

  /**
   * Sync availability to channel manager
   */
  syncAvailability(input: SyncAvailabilityInput): Promise<SyncResult>;

  /**
   * Sync rates to channel manager
   */
  syncRates(input: SyncRatesInput): Promise<SyncResult>;

  /**
   * Pull reservations from channel manager
   */
  pullReservations(options?: PullReservationsOptions): Promise<SyncResult>;

  /**
   * Cancel a reservation in the channel manager
   */
  cancelReservation(reservationId: string): Promise<SyncResult>;

  /**
   * Get room type mappings
   */
  getRoomTypeMappings(): Promise<RoomTypeMapping[]>;

  /**
   * Map a PMS room type to external room type
   */
  mapRoomType(pmsRoomTypeId: string, externalRoomTypeId: string): Promise<void>;

  /**
   * Unmap a room type
   */
  unmapRoomType(mappingId: string): Promise<void>;

  /**
   * Get sync statistics
   */
  getSyncStats(): Promise<{
    lastSyncAt?: Date;
    totalReservationsSynced: number;
    failedSyncsLast24h: number;
    averageSyncTime: number;
  }>;

  /**
   * Initialize the strategy (called on app startup)
   */
  initialize(): Promise<void>;

  /**
   * Cleanup resources (called on app shutdown)
   */
  cleanup(): Promise<void>;
}
```

---

### 3.2 Channel Manager Service (Context)

#### File: `src/integrations/channel-manager/channel_manager_service.ts`

```typescript
/**
 * Channel Manager Service (Strategy Context)
 * 
 * This service acts as the facade/context for the Strategy pattern.
 * It manages which channel manager strategy is currently active and
 * delegates operations to the appropriate strategy.
 */

import db from '../../config/database.js';
import type {
  IChannelManagerStrategy,
  SyncReservationInput,
  SyncAvailabilityInput,
  SyncRatesInput,
  PullReservationsOptions,
  SyncResult,
  ConnectionTestResult,
} from './types.js';
import { ChannelManagerFactory } from './channel_manager_factory.js';

export class ChannelManagerService {
  private static instance: ChannelManagerService;
  private currentStrategy: IChannelManagerStrategy | null = null;
  private strategies: Map<string, IChannelManagerStrategy> = new Map();

  private constructor() {}

  /**
   * Singleton instance
   */
  public static getInstance(): ChannelManagerService {
    if (!ChannelManagerService.instance) {
      ChannelManagerService.instance = new ChannelManagerService();
    }
    return ChannelManagerService.instance;
  }

  /**
   * Initialize the service (called on app startup)
   */
  public async initialize(): Promise<void> {
    console.log('[ChannelManager] Initializing Channel Manager Service...');

    // Register all available strategies
    const beds24Strategy = ChannelManagerFactory.createStrategy('beds24');
    const qloAppsStrategy = ChannelManagerFactory.createStrategy('qloapps');

    this.strategies.set('beds24', beds24Strategy);
    this.strategies.set('qloapps', qloAppsStrategy);

    // Initialize all strategies
    await Promise.all(
      Array.from(this.strategies.values()).map((s) => s.initialize())
    );

    // Load active strategy from database
    await this.loadActiveStrategy();

    console.log(
      `[ChannelManager] Initialized with active strategy: ${this.currentStrategy?.getName() || 'none'}`
    );
  }

  /**
   * Load the active channel manager from database
   */
  private async loadActiveStrategy(): Promise<void> {
    const propertyId = '00000000-0000-0000-0000-000000000001';

    // Check which channel manager is enabled
    // Priority: Check settings table for active_channel_manager
    const settings = await db('hotel_settings')
      .where({ id: propertyId })
      .first();

    const activeChannelManager = settings?.active_channel_manager;

    if (activeChannelManager && this.strategies.has(activeChannelManager)) {
      const strategy = this.strategies.get(activeChannelManager)!;
      const isEnabled = await strategy.isEnabled();

      if (isEnabled) {
        this.currentStrategy = strategy;
        console.log(`[ChannelManager] Active strategy: ${activeChannelManager}`);
        return;
      }
    }

    // Fallback: Check individual configs
    for (const [name, strategy] of this.strategies) {
      const isEnabled = await strategy.isEnabled();
      if (isEnabled) {
        this.currentStrategy = strategy;
        console.log(`[ChannelManager] Active strategy (fallback): ${name}`);
        return;
      }
    }

    console.warn('[ChannelManager] No active channel manager found');
  }

  /**
   * Get the currently active strategy
   */
  public getCurrentStrategy(): IChannelManagerStrategy | null {
    return this.currentStrategy;
  }

  /**
   * Get a specific strategy by name
   */
  public getStrategy(name: string): IChannelManagerStrategy | null {
    return this.strategies.get(name) || null;
  }

  /**
   * Get all registered strategies
   */
  public getAllStrategies(): IChannelManagerStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Switch to a different channel manager
   */
  public async switchChannelManager(name: string): Promise<void> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Channel manager strategy '${name}' not found`);
    }

    const isEnabled = await strategy.isEnabled();
    if (!isEnabled) {
      throw new Error(`Channel manager '${name}' is not enabled`);
    }

    this.currentStrategy = strategy;

    // Update database
    const propertyId = '00000000-0000-0000-0000-000000000001';
    await db('hotel_settings')
      .where({ id: propertyId })
      .update({ active_channel_manager: name });

    console.log(`[ChannelManager] Switched to: ${name}`);
  }

  /**
   * Enable a channel manager
   */
  public async enableChannelManager(name: string): Promise<void> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Channel manager strategy '${name}' not found`);
    }

    // Enable in config table (implementation depends on strategy)
    // This will be handled by each strategy's specific config

    console.log(`[ChannelManager] Enabled: ${name}`);
  }

  /**
   * Disable a channel manager
   */
  public async disableChannelManager(name: string): Promise<void> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Channel manager strategy '${name}' not found`);
    }

    if (this.currentStrategy === strategy) {
      this.currentStrategy = null;
    }

    console.log(`[ChannelManager] Disabled: ${name}`);
  }

  // ========================================================================
  // Delegated Operations (delegate to current strategy)
  // ========================================================================

  /**
   * Sync a reservation using the active strategy
   */
  public async syncReservation(input: SyncReservationInput): Promise<SyncResult> {
    if (!this.currentStrategy) {
      console.warn('[ChannelManager] No active strategy, skipping sync');
      return this.createSkippedResult('reservation');
    }

    try {
      return await this.currentStrategy.syncReservation(input);
    } catch (error) {
      console.error('[ChannelManager] Sync reservation failed:', error);
      throw error;
    }
  }

  /**
   * Sync availability using the active strategy
   */
  public async syncAvailability(input: SyncAvailabilityInput): Promise<SyncResult> {
    if (!this.currentStrategy) {
      console.warn('[ChannelManager] No active strategy, skipping sync');
      return this.createSkippedResult('availability');
    }

    try {
      return await this.currentStrategy.syncAvailability(input);
    } catch (error) {
      console.error('[ChannelManager] Sync availability failed:', error);
      throw error;
    }
  }

  /**
   * Sync rates using the active strategy
   */
  public async syncRates(input: SyncRatesInput): Promise<SyncResult> {
    if (!this.currentStrategy) {
      console.warn('[ChannelManager] No active strategy, skipping sync');
      return this.createSkippedResult('rates');
    }

    try {
      return await this.currentStrategy.syncRates(input);
    } catch (error) {
      console.error('[ChannelManager] Sync rates failed:', error);
      throw error;
    }
  }

  /**
   * Pull reservations using the active strategy
   */
  public async pullReservations(
    options?: PullReservationsOptions
  ): Promise<SyncResult> {
    if (!this.currentStrategy) {
      console.warn('[ChannelManager] No active strategy, skipping pull');
      return this.createSkippedResult('pull');
    }

    try {
      return await this.currentStrategy.pullReservations(options);
    } catch (error) {
      console.error('[ChannelManager] Pull reservations failed:', error);
      throw error;
    }
  }

  /**
   * Test connection using the active strategy
   */
  public async testConnection(): Promise<ConnectionTestResult> {
    if (!this.currentStrategy) {
      return {
        success: false,
        message: 'No active channel manager strategy',
      };
    }

    try {
      return await this.currentStrategy.testConnection();
    } catch (error) {
      console.error('[ChannelManager] Test connection failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cleanup (called on app shutdown)
   */
  public async cleanup(): Promise<void> {
    console.log('[ChannelManager] Cleaning up...');
    await Promise.all(
      Array.from(this.strategies.values()).map((s) => s.cleanup())
    );
  }

  /**
   * Helper: Create a skipped result
   */
  private createSkippedResult(operationType: SyncResult['operationType']): SyncResult {
    return {
      success: true,
      operationType,
      itemsProcessed: 0,
      itemsSucceeded: 0,
      itemsFailed: 0,
      duration: 0,
      details: { skipped: true, reason: 'No active channel manager' },
    };
  }
}

// Export singleton instance
export const channelManagerService = ChannelManagerService.getInstance();
```

---

### 3.3 Channel Manager Factory

#### File: `src/integrations/channel-manager/channel_manager_factory.ts`

```typescript
/**
 * Factory for creating channel manager strategies
 */

import type { IChannelManagerStrategy } from './types.js';
import { Beds24ChannelStrategy } from './strategies/beds24_strategy.js';
import { QloAppsChannelStrategy } from './strategies/qloapps_strategy.js';

export class ChannelManagerFactory {
  /**
   * Create a channel manager strategy by name
   */
  public static createStrategy(name: string): IChannelManagerStrategy {
    switch (name.toLowerCase()) {
      case 'beds24':
        return new Beds24ChannelStrategy();

      case 'qloapps':
        return new QloAppsChannelStrategy();

      default:
        throw new Error(`Unknown channel manager strategy: ${name}`);
    }
  }

  /**
   * Get list of available strategies
   */
  public static getAvailableStrategies(): string[] {
    return ['beds24', 'qloapps'];
  }
}
```

---

### 3.4 Beds24 Strategy Adapter

#### File: `src/integrations/channel-manager/strategies/beds24_strategy.ts`

```typescript
/**
 * Beds24 Channel Manager Strategy (Adapter)
 * 
 * Adapts the existing Beds24 integration to the IChannelManagerStrategy interface
 */

import type {
  IChannelManagerStrategy,
  ChannelManagerConfig,
  SyncReservationInput,
  SyncAvailabilityInput,
  SyncRatesInput,
  PullReservationsOptions,
  SyncResult,
  ConnectionTestResult,
  RoomTypeMapping,
} from '../types.js';
import db from '../../../config/database.js';
import { Beds24Client } from '../../beds24/beds24_client.js';
import { decrypt } from '../../../utils/encryption.js';

export class Beds24ChannelStrategy implements IChannelManagerStrategy {
  private client: Beds24Client | null = null;
  private config: any = null;

  getName(): string {
    return 'beds24';
  }

  getDisplayName(): string {
    return 'Beds24';
  }

  async initialize(): Promise<void> {
    console.log('[Beds24Strategy] Initializing...');
    await this.loadConfig();
  }

  async cleanup(): Promise<void> {
    console.log('[Beds24Strategy] Cleaning up...');
    this.client = null;
    this.config = null;
  }

  async isEnabled(): Promise<boolean> {
    await this.loadConfig();
    return this.config?.sync_enabled === true;
  }

  async getConfig(): Promise<ChannelManagerConfig> {
    await this.loadConfig();

    return {
      id: this.config?.id || '',
      name: 'beds24',
      displayName: 'Beds24',
      enabled: this.config?.sync_enabled || false,
      syncEnabled: this.config?.sync_enabled || false,
      pushSyncEnabled: this.config?.push_sync_enabled || false,
      pullSyncEnabled: this.config?.pull_sync_enabled || false,
      lastSyncAt: this.config?.last_successful_sync,
      propertyId: this.config?.property_id,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureClient();
      
      // Use existing Beds24 test connection logic
      const startTime = Date.now();
      // Implement actual test (e.g., fetch properties)
      const latency = Date.now() - startTime;

      return {
        success: true,
        message: 'Successfully connected to Beds24',
        latency,
        apiVersion: 'v2',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async syncReservation(input: SyncReservationInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Delegate to existing Beds24 hooks
      const { queueReservationSyncHook } = await import(
        '../../beds24/hooks/sync_hooks.js'
      );

      await queueReservationSyncHook(input.reservationId, input.action);

      return {
        success: true,
        operationType: 'reservation',
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'reservation',
        itemsProcessed: 1,
        itemsSucceeded: 0,
        itemsFailed: 1,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncAvailability(input: SyncAvailabilityInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Delegate to existing Beds24 availability sync
      const { queueRoomAvailabilitySyncHook } = await import(
        '../../beds24/hooks/sync_hooks.js'
      );

      await queueRoomAvailabilitySyncHook(input.roomTypeId);

      return {
        success: true,
        operationType: 'availability',
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'availability',
        itemsProcessed: 1,
        itemsSucceeded: 0,
        itemsFailed: 1,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncRates(input: SyncRatesInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Beds24 rate sync (if implemented)
      return {
        success: true,
        operationType: 'rates',
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        duration: Date.now() - startTime,
        details: { message: 'Beds24 rate sync not implemented yet' },
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'rates',
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async pullReservations(options?: PullReservationsOptions): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Delegate to existing Beds24 pull sync job
      const { runPullSyncJob } = await import(
        '../../beds24/jobs/pull_sync_job.js'
      );

      const result = await runPullSyncJob();

      return {
        success: result.success,
        operationType: 'pull',
        itemsProcessed: result.bookingsProcessed || 0,
        itemsSucceeded: result.bookingsCreated + result.bookingsUpdated,
        itemsFailed: result.bookingsFailed || 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'pull',
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelReservation(reservationId: string): Promise<SyncResult> {
    return this.syncReservation({
      reservationId,
      action: 'cancel',
    });
  }

  async getRoomTypeMappings(): Promise<RoomTypeMapping[]> {
    // Query beds24_room_mappings or room_types table
    const mappings = await db('room_types')
      .whereNotNull('beds24_room_id')
      .select('id', 'name', 'beds24_room_id');

    return mappings.map((m) => ({
      id: m.id,
      pmsRoomTypeId: m.id,
      externalRoomTypeId: m.beds24_room_id,
      pmsRoomTypeName: m.name,
      externalRoomTypeName: m.name,
      syncDirection: 'bidirectional' as const,
      isActive: true,
    }));
  }

  async mapRoomType(pmsRoomTypeId: string, externalRoomTypeId: string): Promise<void> {
    await db('room_types')
      .where({ id: pmsRoomTypeId })
      .update({ beds24_room_id: externalRoomTypeId });
  }

  async unmapRoomType(mappingId: string): Promise<void> {
    await db('room_types')
      .where({ id: mappingId })
      .update({ beds24_room_id: null });
  }

  async getSyncStats(): Promise<any> {
    const config = await this.getConfig();
    
    return {
      lastSyncAt: config.lastSyncAt,
      totalReservationsSynced: 0, // TODO: Query from sync logs
      failedSyncsLast24h: 0,
      averageSyncTime: 0,
    };
  }

  // Private helper methods

  private async loadConfig(): Promise<void> {
    if (this.config) return;

    const propertyId = '00000000-0000-0000-0000-000000000001';
    this.config = await db('beds24_config')
      .where({ property_id: propertyId })
      .first();
  }

  private async ensureClient(): Promise<void> {
    if (this.client) return;

    await this.loadConfig();

    if (!this.config) {
      throw new Error('Beds24 configuration not found');
    }

    const apiKey = decrypt(this.config.api_key_encrypted);
    const refreshToken = decrypt(this.config.refresh_token_encrypted);

    this.client = new Beds24Client({
      apiKey,
      refreshToken,
    });
  }
}
```

---

### 3.5 QloApps Strategy Adapter

#### File: `src/integrations/channel-manager/strategies/qloapps_strategy.ts`

```typescript
/**
 * QloApps Channel Manager Strategy (Adapter)
 * 
 * Adapts the QloApps integration to the IChannelManagerStrategy interface
 */

import type {
  IChannelManagerStrategy,
  ChannelManagerConfig,
  SyncReservationInput,
  SyncAvailabilityInput,
  SyncRatesInput,
  PullReservationsOptions,
  SyncResult,
  ConnectionTestResult,
  RoomTypeMapping,
} from '../types.js';
import db from '../../../config/database.js';
import { QloAppsClient } from '../../qloapps/qloapps_client.js';
import { QloAppsPullSyncService } from '../../qloapps/services/pull_sync_service.js';
import { QloAppsPushSyncService } from '../../qloapps/services/push_sync_service.js';
import { decrypt } from '../../../utils/encryption.js';

export class QloAppsChannelStrategy implements IChannelManagerStrategy {
  private client: QloAppsClient | null = null;
  private config: any = null;
  private pullSyncService: QloAppsPullSyncService | null = null;
  private pushSyncService: QloAppsPushSyncService | null = null;

  getName(): string {
    return 'qloapps';
  }

  getDisplayName(): string {
    return 'QloApps';
  }

  async initialize(): Promise<void> {
    console.log('[QloAppsStrategy] Initializing...');
    await this.loadConfig();
  }

  async cleanup(): Promise<void> {
    console.log('[QloAppsStrategy] Cleaning up...');
    this.client = null;
    this.config = null;
    this.pullSyncService = null;
    this.pushSyncService = null;
  }

  async isEnabled(): Promise<boolean> {
    await this.loadConfig();
    return this.config?.sync_enabled === true;
  }

  async getConfig(): Promise<ChannelManagerConfig> {
    await this.loadConfig();

    return {
      id: this.config?.id || '',
      name: 'qloapps',
      displayName: 'QloApps',
      enabled: this.config?.sync_enabled || false,
      syncEnabled: this.config?.sync_enabled || false,
      pushSyncEnabled: this.config?.push_sync_enabled || false,
      pullSyncEnabled: this.config?.pull_sync_enabled || false,
      lastSyncAt: this.config?.last_successful_sync,
      propertyId: this.config?.property_id,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureClient();
      
      const startTime = Date.now();
      const result = await this.client!.testConnection();
      const latency = Date.now() - startTime;

      return {
        success: result.success,
        message: result.message,
        latency,
        apiVersion: result.apiVersion,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async syncReservation(input: SyncReservationInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Delegate to QloApps hooks
      const { queueQloAppsReservationSyncHook } = await import(
        '../../qloapps/hooks/sync_hooks.js'
      );

      await queueQloAppsReservationSyncHook(input.reservationId, input.action);

      return {
        success: true,
        operationType: 'reservation',
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'reservation',
        itemsProcessed: 1,
        itemsSucceeded: 0,
        itemsFailed: 1,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncAvailability(input: SyncAvailabilityInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      const { queueQloAppsAvailabilitySyncHook } = await import(
        '../../qloapps/hooks/sync_hooks.js'
      );

      await queueQloAppsAvailabilitySyncHook(
        input.roomTypeId,
        input.dateFrom,
        input.dateTo
      );

      return {
        success: true,
        operationType: 'availability',
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'availability',
        itemsProcessed: 1,
        itemsSucceeded: 0,
        itemsFailed: 1,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncRates(input: SyncRatesInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      const { queueQloAppsRateSyncHook } = await import(
        '../../qloapps/hooks/sync_hooks.js'
      );

      await queueQloAppsRateSyncHook(
        input.roomTypeId,
        input.dateFrom,
        input.dateTo
      );

      return {
        success: true,
        operationType: 'rates',
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'rates',
        itemsProcessed: 1,
        itemsSucceeded: 0,
        itemsFailed: 1,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async pullReservations(options?: PullReservationsOptions): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      await this.ensureServices();

      const result = await this.pullSyncService!.syncBookings(this.config.id, {
        syncType: options?.syncType || 'incremental',
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
      });

      return {
        success: result.success,
        operationType: 'pull',
        itemsProcessed: result.itemsProcessed,
        itemsSucceeded: result.itemsCreated + result.itemsUpdated,
        itemsFailed: result.itemsFailed,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'pull',
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelReservation(reservationId: string): Promise<SyncResult> {
    return this.syncReservation({
      reservationId,
      action: 'cancel',
    });
  }

  async getRoomTypeMappings(): Promise<RoomTypeMapping[]> {
    const mappings = await db('qloapps_room_type_mappings')
      .join('room_types', 'qloapps_room_type_mappings.pms_room_type_id', 'room_types.id')
      .whereNull('qloapps_room_type_mappings.deleted_at')
      .select(
        'qloapps_room_type_mappings.id',
        'qloapps_room_type_mappings.pms_room_type_id',
        'qloapps_room_type_mappings.qloapps_room_type_id',
        'qloapps_room_type_mappings.sync_direction',
        'room_types.name as pms_room_type_name'
      );

    return mappings.map((m) => ({
      id: m.id,
      pmsRoomTypeId: m.pms_room_type_id,
      externalRoomTypeId: String(m.qloapps_room_type_id),
      pmsRoomTypeName: m.pms_room_type_name,
      externalRoomTypeName: m.pms_room_type_name, // TODO: Fetch from QloApps
      syncDirection: m.sync_direction,
      isActive: true,
    }));
  }

  async mapRoomType(pmsRoomTypeId: string, externalRoomTypeId: string): Promise<void> {
    await db('qloapps_room_type_mappings').insert({
      id: crypto.randomUUID(),
      property_id: this.config.property_id,
      pms_room_type_id: pmsRoomTypeId,
      qloapps_room_type_id: parseInt(externalRoomTypeId, 10),
      qloapps_hotel_id: this.config.hotel_id,
      sync_direction: 'bidirectional',
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  async unmapRoomType(mappingId: string): Promise<void> {
    await db('qloapps_room_type_mappings')
      .where({ id: mappingId })
      .update({ deleted_at: new Date() });
  }

  async getSyncStats(): Promise<any> {
    const config = await this.getConfig();
    
    return {
      lastSyncAt: config.lastSyncAt,
      totalReservationsSynced: 0, // TODO: Query from qloapps_sync_logs
      failedSyncsLast24h: 0,
      averageSyncTime: 0,
    };
  }

  // Private helper methods

  private async loadConfig(): Promise<void> {
    if (this.config) return;

    const propertyId = '00000000-0000-0000-0000-000000000001';
    this.config = await db('qloapps_config')
      .where({ property_id: propertyId })
      .whereNull('deleted_at')
      .first();
  }

  private async ensureClient(): Promise<void> {
    if (this.client) return;

    await this.loadConfig();

    if (!this.config) {
      throw new Error('QloApps configuration not found');
    }

    const apiKey = decrypt(this.config.api_key_encrypted);

    this.client = new QloAppsClient({
      baseUrl: this.config.base_url,
      apiKey,
      hotelId: this.config.hotel_id,
    });
  }

  private async ensureServices(): Promise<void> {
    await this.ensureClient();

    if (!this.pullSyncService) {
      this.pullSyncService = new QloAppsPullSyncService(this.client!);
    }

    if (!this.pushSyncService) {
      this.pushSyncService = new QloAppsPushSyncService(this.client!);
    }
  }
}
```

---

## 4. Benefits

### 4.1 Easy Switching

```typescript
// Switch from Beds24 to QloApps
await channelManagerService.switchChannelManager('qloapps');

// Switch back to Beds24
await channelManagerService.switchChannelManager('beds24');
```

### 4.2 Consistent Interface

```typescript
// Same interface regardless of channel manager
const result = await channelManagerService.syncReservation({
  reservationId: '123',
  action: 'create',
});

// Works with both Beds24 and QloApps!
```

### 4.3 Multiple Managers Simultaneously

```typescript
// Sync to both Beds24 AND QloApps
const beds24Strategy = channelManagerService.getStrategy('beds24');
const qloAppsStrategy = channelManagerService.getStrategy('qloapps');

await Promise.all([
  beds24Strategy?.syncReservation(input),
  qloAppsStrategy?.syncReservation(input),
]);
```

### 4.4 Easy Testing & A/B Testing

```typescript
// Run parallel syncs for comparison
const reservation = { ... };

const beds24Result = await beds24Strategy.syncReservation(reservation);
const qloAppsResult = await qloAppsStrategy.syncReservation(reservation);

// Compare results
console.log('Beds24 latency:', beds24Result.duration);
console.log('QloApps latency:', qloAppsResult.duration);
```

### 4.5 Future-Proof

```typescript
// Adding a new channel manager (e.g., Cloudbeds)
export class CloudbedsChannelStrategy implements IChannelManagerStrategy {
  // Implement interface...
}

// Register in factory
case 'cloudbeds':
  return new CloudbedsChannelStrategy();

// Use immediately
await channelManagerService.switchChannelManager('cloudbeds');
```

---

## 5. Usage Examples

### 5.1 Reservation Controller Integration

```typescript
// src/services/reservations/reservations_controller.ts

import { channelManagerService } from '../../integrations/channel-manager/channel_manager_service.js';

export async function createReservationHandler(req, res, next) {
  try {
    // ... create reservation in database ...
    
    // Sync to active channel manager (Beds24 or QloApps)
    await channelManagerService.syncReservation({
      reservationId: reservation.id,
      action: 'create',
    });

    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
}
```

### 5.2 Settings Page - Switch Channel Manager

```typescript
// Frontend: src/pages/SettingsPage.jsx

const handleSwitchChannelManager = async (managerName) => {
  try {
    await api.channelManager.switch(managerName);
    toast.success(`Switched to ${managerName}`);
    fetchChannelManagerStatus();
  } catch (error) {
    toast.error(`Failed to switch: ${error.message}`);
  }
};

return (
  <div>
    <button onClick={() => handleSwitchChannelManager('beds24')}>
      Use Beds24
    </button>
    <button onClick={() => handleSwitchChannelManager('qloapps')}>
      Use QloApps
    </button>
  </div>
);
```

### 5.3 Admin Panel - Channel Manager Status

```typescript
// Backend: src/services/admin/channel_manager_controller.ts

export async function getChannelManagerStatus(req, res) {
  const allStrategies = channelManagerService.getAllStrategies();
  const current = channelManagerService.getCurrentStrategy();

  const statuses = await Promise.all(
    allStrategies.map(async (strategy) => ({
      name: strategy.getName(),
      displayName: strategy.getDisplayName(),
      isActive: current === strategy,
      isEnabled: await strategy.isEnabled(),
      config: await strategy.getConfig(),
      stats: await strategy.getSyncStats(),
    }))
  );

  res.json({ strategies: statuses });
}

export async function switchChannelManager(req, res) {
  const { name } = req.body;

  await channelManagerService.switchChannelManager(name);

  res.json({ message: `Switched to ${name}`, success: true });
}
```

---

## 6. Migration Strategy

### Step 1: Create Strategy Infrastructure (Week 1)

1. Create `src/integrations/channel-manager/` directory
2. Implement:
   - `types.ts` - Core interfaces
   - `channel_manager_service.ts` - Context/facade
   - `channel_manager_factory.ts` - Factory
3. Add database migration for `active_channel_manager` column in `hotel_settings`

### Step 2: Create Strategy Adapters (Week 1-2)

1. Implement `strategies/beds24_strategy.ts`
   - Wrap existing Beds24 code
   - Delegate to existing hooks/services
2. Implement `strategies/qloapps_strategy.ts`
   - Wrap QloApps code
   - Delegate to QloApps hooks/services

### Step 3: Update Application Code (Week 2)

1. Update `src/app.ts`:
   ```typescript
   import { channelManagerService } from './integrations/channel-manager/channel_manager_service.js';
   
   // Initialize on startup
   await channelManagerService.initialize();
   ```

2. Update reservation controller:
   ```typescript
   // Replace:
   import { queueReservationSyncHook } from '../../integrations/beds24/hooks/sync_hooks.js';
   
   // With:
   import { channelManagerService } from '../../integrations/channel-manager/channel_manager_service.js';
   
   // Replace hook calls with:
   await channelManagerService.syncReservation({ ... });
   ```

3. Update rooms controller (same pattern)

### Step 4: Add API Routes (Week 2)

1. Create `/api/v1/channel-manager` routes:
   - `GET /status` - Get all strategies and current active
   - `POST /switch` - Switch active strategy
   - `POST /test` - Test connection
   - `GET /mappings` - Get room type mappings

### Step 5: Update Frontend (Week 2-3)

1. Add Channel Manager switcher UI in Settings
2. Show status of all available managers
3. Allow testing connections
4. Unified room mapping interface

### Step 6: Testing & Validation (Week 3)

1. Test switching between Beds24 and QloApps
2. Verify reservations sync correctly
3. Test parallel sync to both managers
4. Performance testing

---

## 7. File Structure

```
src/
├── integrations/
│   ├── channel-manager/
│   │   ├── types.ts                    # Core interfaces
│   │   ├── channel_manager_service.ts  # Context/Facade
│   │   ├── channel_manager_factory.ts  # Factory
│   │   ├── strategies/
│   │   │   ├── beds24_strategy.ts      # Beds24 adapter
│   │   │   ├── qloapps_strategy.ts     # QloApps adapter
│   │   │   └── index.ts
│   │   ├── routes/
│   │   │   ├── channel_manager_routes.ts
│   │   │   └── channel_manager_controller.ts
│   │   └── index.ts
│   ├── beds24/                         # Existing Beds24 code (unchanged)
│   │   ├── beds24_client.ts
│   │   ├── hooks/
│   │   ├── services/
│   │   └── ...
│   └── qloapps/                        # Existing QloApps code (unchanged)
│       ├── qloapps_client.ts
│       ├── hooks/
│       ├── services/
│       └── ...
└── ...
```

---

## 8. Benefits Summary

### For Development
- ✅ Clean separation of concerns
- ✅ Easy to test individual strategies
- ✅ Can add new channel managers without touching existing code
- ✅ Reduces coupling between PMS and channel manager code

### For Operations
- ✅ Switch channel managers with a single API call
- ✅ Run multiple managers simultaneously for migration
- ✅ A/B test different managers
- ✅ Easy rollback if issues occur

### For Business
- ✅ Vendor flexibility - not locked into one provider
- ✅ Reduced migration risk
- ✅ Can negotiate better rates with multiple options
- ✅ Future-proof architecture

---

## 9. Database Schema Addition

### Migration: Add active_channel_manager to hotel_settings

```typescript
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('hotel_settings', (table) => {
    table
      .string('active_channel_manager')
      .nullable()
      .comment('Currently active channel manager: beds24, qloapps, etc.');
    
    table.index('active_channel_manager', 'idx_hotel_settings_active_channel_manager');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('hotel_settings', (table) => {
    table.dropColumn('active_channel_manager');
  });
}
```

---

## 10. Next Steps

1. **Review this design document**
2. **Decide on migration timeline**
3. **Implement strategy infrastructure first**
4. **Create adapters for both Beds24 and QloApps**
5. **Update application code to use strategy pattern**
6. **Test thoroughly before production deployment**

**Estimated Implementation Time:** 2-3 weeks

**Risk Level:** Low (existing code remains unchanged, just wrapped)

---

## Summary

The Strategy Pattern provides a **clean, flexible, and maintainable** architecture for managing multiple channel manager integrations. By wrapping the existing Beds24 and QloApps code in strategy adapters, you gain:

1. **Easy switching** between channel managers
2. **No modification** to existing integration code
3. **Ability to run multiple managers** simultaneously
4. **Simple addition** of new channel managers in the future
5. **Cleaner separation** of concerns

This approach makes the PMS truly **channel-manager agnostic** and provides maximum flexibility for future growth.
