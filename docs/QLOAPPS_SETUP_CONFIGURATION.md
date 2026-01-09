# QloApps Configuration Setup Guide

## Overview

This document describes the QloApps configuration setup workflow that was implemented. Users can now configure QloApps integration directly from the Settings page without manually inserting database records.

## What Was Added

### 1. Backend API Endpoint

**Endpoint:** `POST /api/v1/settings/channel-manager/setup-qloapps`

**Purpose:** Save QloApps configuration to the database

**Authentication:** Required (ADMIN or SUPER_ADMIN role)

**Request Body:**
```json
{
  "baseUrl": "https://hotel.qloapps.com",
  "apiKey": "your-webservice-api-key",
  "qloAppsHotelId": 123,
  "syncInterval": 15
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "QloApps configuration saved successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Validation:**
- `baseUrl` must be a valid URL (with protocol)
- `apiKey` must be provided (will be encrypted before storage)
- `qloAppsHotelId` must be a positive integer
- `syncInterval` must be an integer (defaults to 15 if not provided)

### 2. Frontend UI Components

#### Setup Connection Form

Located in the "Channel Manager" tab of Settings page:

**Features:**
- **QloApps Base URL field** - Input for the QloApps instance URL
- **QloApps Hotel ID field** - Number input for the hotel ID
- **WebService API Key field** - Password field (masked) for the API key
- **Sync Interval selector** - Dropdown with options (5, 10, 15, 30, 60 minutes)

**Buttons:**
- **Setup Connection** - Shows when QloApps is not configured (blue)
- **Edit Connection** - Shows when QloApps is already configured (gray)
- **Test Connection** - Tests the connection with current config (purple)

#### Form States

1. **Not Configured State**
   - Blue info box: "QloApps is not currently configured..."
   - "Setup Connection" button visible
   - Setup form hidden

2. **Setup Mode**
   - Form displayed with all fields
   - "Save Configuration" button (disabled while saving)
   - "Cancel" button to close form
   - Error messages displayed in red box if validation fails

3. **Configured State**
   - Green status indicator: "✓ Connected"
   - "Edit Connection" button available
   - "Test Connection" button available
   - Status updated after successful save

### 3. Form Validation & Error Handling

**Client-side validation:**
- Required fields: baseUrl, apiKey, qloAppsHotelId
- URL format validation using HTML5 URL input

**Server-side validation:**
- URL format validation using `new URL()`
- Hotel ID must be a positive integer
- All required fields must be provided

**Error Display:**
- Toast notification shows on success/error
- Error message displayed in red box within form
- User can correct and retry

## Workflow

### Initial Setup (When Not Configured)

1. User navigates to Settings → Channel Manager tab
2. Sees "Not Configured" status
3. Clicks "Setup Connection" button
4. Form appears with empty fields
5. User fills in:
   - QloApps Base URL (e.g., `https://hotel.qloapps.com`)
   - Hotel ID (e.g., `123`)
   - API Key
   - Sync Interval (defaults to 15 minutes)
6. Clicks "Save Configuration"
7. Backend validates and encrypts API key
8. Configuration saved to `qloapps_config` table
9. Status updated to "✓ Connected"
10. User can now click "Test Connection" to verify

### Updating Configuration (When Already Configured)

1. User navigates to Settings → Channel Manager tab
2. Sees "✓ Connected" status
3. Clicks "Edit Connection" button
4. Form appears with current settings (API key is masked)
5. User can modify any field
6. Clicks "Save Configuration"
7. Configuration updated in database
8. Changes take effect immediately

## Database Impact

### qloapps_config Table

When configuration is saved, this record is created/updated:

```sql
INSERT INTO qloapps_config (
  property_id,
  base_url,
  api_key_encrypted,
  qloapps_hotel_id,
  sync_interval_minutes,
  sync_enabled,
  sync_reservations_inbound,
  sync_reservations_outbound,
  sync_availability,
  sync_rates,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'https://hotel.qloapps.com',
  'encrypted-key-content',
  123,
  15,
  true,
  true,
  true,
  true,
  true,
  NOW(),
  NOW()
);
```

**Note:** API key is encrypted at the application level using the encryption utility before being stored.

## Testing the Configuration

### Using the Frontend Test Button

1. After saving configuration, click "Test Connection"
2. Button shows loading spinner
3. Backend makes a test request to QloApps
4. Success: Green toast notification "✓ QloApps connection successful!"
5. Failure: Red toast notification with error details

### Manual Testing

**Save Configuration:**
```bash
curl -X POST http://localhost:5000/api/v1/settings/channel-manager/setup-qloapps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "baseUrl": "https://hotel.qloapps.com",
    "apiKey": "your-api-key",
    "qloAppsHotelId": 123,
    "syncInterval": 15
  }'
```

**Test Connection:**
```bash
curl -X POST http://localhost:5000/api/v1/settings/channel-manager/test-qloapps \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get Status:**
```bash
curl http://localhost:5000/api/v1/settings/channel-manager \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Files Modified

### Backend
- `/backend/src/services/settings/channel_manager_controller.ts` - Added `setupQloAppsConnectionHandler`
- `/backend/src/services/settings/settings_routes.ts` - Added route for setup endpoint

### Frontend
- `/frontend/src/pages/SettingsPage.jsx` - Added configuration form UI and handlers

## Security Considerations

1. **API Key Encryption**
   - API keys are encrypted at the application level using `utils/encryption.ts`
   - Never stored or transmitted in plain text
   - Password-type input field masks the key in the UI

2. **Access Control**
   - Endpoint requires ADMIN or SUPER_ADMIN role
   - Cannot be accessed by regular users or VIEWER roles

3. **URL Validation**
   - Base URL must be a valid URL format
   - Prevents injection attacks

## Next Steps After Configuration

Once configuration is saved:

1. **Test Connection** - Verify the integration works
2. **Enable Sync** - Sync operations can begin
3. **Monitor Sync** - Check status in channel manager
4. **Update Settings** - Can be edited anytime from the form

## Troubleshooting

### "Invalid baseUrl format" error
- Ensure URL includes protocol: `https://` not just `hotel.qloapps.com`
- Check for trailing slashes and remove them

### "qloAppsHotelId must be a positive number" error
- Hotel ID must be a number greater than 0
- Should match the `id_hotel` from QloApps database

### "Failed to save configuration" error
- Check network connectivity
- Verify authentication token is valid
- Check server logs for detailed error

### Test connection fails after saving
- Verify all credentials are correct
- Check that QloApps instance is accessible
- Confirm API key has WebService permission
