# QloApps Test Connection Button Implementation

## Summary

Updated the frontend Channel Manager settings to include a **Test Connection** button that sends a request to the QloApps basic API endpoint to verify connectivity.

## Changes Made

### 1. Frontend API Client (`frontend/src/utils/api.js`)

Updated the `channelManagers` object endpoints:

```javascript
// Channel Managers endpoints
channelManagers: {
  getStatus: () => request('/v1/settings/channel-manager'),
  
  testConnection: () =>
    request('/v1/settings/channel-manager/test-qloapps', {
      method: 'POST',
    }),
  
  switch: (manager) =>
    request('/v1/settings/channel-manager/switch', {
      method: 'POST',
      body: { channelManager: manager },
    }),
}
```

**Changes:**
- `testConnection()` now takes **no parameters** (removed `manager` parameter)
- Points to `/v1/settings/channel-manager/test-qloapps` endpoint
- Uses `POST` method (as required by backend)

### 2. SettingsPage Component (`frontend/src/pages/SettingsPage.jsx`)

#### Handler Function Update

```javascript
const handleTestChannelManager = async () => {
  try {
    setTestingChannelManager('qloapps')
    const result = await api.channelManagers.testConnection()
    if (result.success || result.connected) {
      toast.success('✓ QloApps connection successful!')
    } else {
      toast.error(`✗ QloApps connection failed: ${result.error || 'Unknown error'}`)
    }
    // Refresh status to show updated connection info
    const data = await api.channelManagers.getStatus()
    setChannelManagerStatus(data)
  } catch (err) {
    console.error('Error testing channel manager:', err)
    toast.error(`✗ Failed to test connection: ${err.message || 'Unknown error'}`)
  } finally {
    setTestingChannelManager(null)
  }
}
```

**Changes:**
- Removed `manager` parameter
- Calls `api.channelManagers.testConnection()` without arguments
- Enhanced error messages with symbols (✓, ✗)
- Handles both `result.success` and `result.connected` response properties

#### Button UI Enhancement

```jsx
<button
  onClick={() => handleTestChannelManager()}
  disabled={testingChannelManager === 'qloapps' || !channelManagerStatus?.managers?.qloapps?.configured}
  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
>
  {testingChannelManager === 'qloapps' ? (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Testing...
    </span>
  ) : (
    'Test Connection'
  )}
</button>
```

**Improvements:**
- **Loading State**: Shows animated spinner icon while testing
- **Better UX**: Changed text from "Testing..." to include spinner animation
- **Enhanced Styling**: Added `font-medium` and `transition-colors` for better appearance
- **Disabled State**: Button is disabled if already testing or QloApps not configured
- **Visual Feedback**: Spinner provides clear indication of ongoing operation

## How It Works

### Flow Diagram

```
User clicks "Test Connection" button
    ↓
handleTestChannelManager() executes
    ↓
1. Set testing state: setTestingChannelManager('qloapps')
2. Button shows animated spinner
    ↓
3. Call: api.channelManagers.testConnection()
    ↓
4. Frontend sends: POST /v1/settings/channel-manager/test-qloapps
    ↓
5. Backend receives request
    ├─ Creates QloAppsClient with stored credentials
    ├─ Calls client.testConnection()
    │  └─ Hits QloApps root API endpoint
    ├─ Returns: { success: true/false, connected: true/false, error?: string }
    ↓
6. Frontend receives response
    ├─ If success: toast.success('✓ QloApps connection successful!')
    └─ If failed: toast.error('✗ QloApps connection failed: ...')
    ↓
7. Refresh channel manager status
    ├─ Calls: api.channelManagers.getStatus()
    └─ Updates channelManagerStatus state
    ↓
8. Clear loading state: setTestingChannelManager(null)
    └─ Button returns to normal state
```

## Backend Endpoint

**Endpoint:** `POST /api/v1/settings/channel-manager/test-qloapps`

**Handler:** `testQloAppsConnectionHandler` (in `channel_manager_controller.ts`)

**What it does:**
1. Gets QloApps configuration from database
2. Creates QloAppsClient with stored API credentials
3. Tests basic connectivity by hitting QloApps root endpoint
4. Returns connection status

**Response Format:**
```json
{
  "success": true,
  "connected": true,
  "message": "QloApps connection successful"
}
```

or

```json
{
  "success": false,
  "connected": false,
  "error": "Failed to connect to QloApps API"
}
```

## Testing the Feature

### Prerequisites

Ensure backend is running:
```bash
npm run dev
```

Ensure QloApps is running (or configure the endpoint):
```bash
# QloApps should be accessible at configured URL
http://localhost:8080/api/?io_format=JSON
```

### Manual Test

1. Navigate to **Settings** page
2. Click **Channel Manager** tab
3. You'll see the QloApps card with status
4. Click **Test Connection** button
5. Watch for:
   - Loading spinner animation
   - Success/error toast notification
   - Connection status update

### Expected Outcomes

**Success Scenario:**
- Button shows spinner
- After ~1-2 seconds: "✓ QloApps connection successful!" toast
- Status card updates to show "✓ Connected"

**Failure Scenario:**
- Button shows spinner
- After ~1-2 seconds: "✗ QloApps connection failed: [reason]" toast
- Status remains unchanged

## Files Modified

1. **`frontend/src/utils/api.js`**
   - Updated `channelManagers.testConnection()` signature
   - Removed `manager` parameter
   - Points to correct backend endpoint

2. **`frontend/src/pages/SettingsPage.jsx`**
   - Updated `handleTestChannelManager()` function
   - Enhanced button UI with spinner animation
   - Improved error handling and user feedback

## Browser Compatibility

The animated spinner uses SVG with CSS `animate-spin` class, which is supported in:
- ✅ Chrome/Edge 26+
- ✅ Firefox 5+
- ✅ Safari 9+
- ✅ All modern browsers

## Related Code References

- Backend Controller: `/backend/src/services/settings/channel_manager_controller.ts`
- Backend Routes: `/backend/src/services/settings/settings_routes.ts`
- Channel Manager Service: `/backend/src/integrations/channel-manager/channel_manager_service.ts`
- QloApps Client: `/backend/src/integrations/qloapps/qloapps_client.ts`

## Notes

- The test connection doesn't require QloApps to be fully configured
- It just verifies that the QloApps API is reachable at the configured URL
- The API key authentication happens during the test
- Button is disabled if QloApps is not marked as configured in the status
- Toast notifications provide immediate feedback to the user
