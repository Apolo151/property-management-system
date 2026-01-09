# Testing QloApps Configuration Setup

This guide shows how to test the newly implemented QloApps configuration setup feature.

## What Was Added

### Frontend (Settings Page)
- **New form** to input QloApps configuration
- **Setup Connection button** to show the form
- **Edit Connection button** to modify existing config
- **Form fields** for:
  - QloApps Base URL
  - Hotel ID
  - API Key (masked)
  - Sync Interval (dropdown)

### Backend (API Endpoint)
- **POST `/api/v1/settings/channel-manager/setup-qloapps`**
  - Accepts configuration data
  - Validates inputs
  - Encrypts API key
  - Saves to database
  - Returns success/error response

## Prerequisites

1. **Backend running** - `npm start` or `npm run dev`
2. **Frontend running** - `npm start`
3. **Authentication** - Logged in as ADMIN or SUPER_ADMIN user
4. **QloApps instance** - You have access to a QloApps installation with:
   - Base URL (e.g., `https://hotel.qloapps.com`)
   - Hotel ID (numeric value)
   - WebService API key

## Test Scenario 1: Initial Configuration (Not Configured)

### Steps

1. **Open Settings**
   - Navigate to `http://localhost:3000/settings`
   - Click on "Channel Manager" tab

2. **Verify "Not Configured" State**
   - Should see QloApps status as "Not Configured"
   - Should see gray status indicator
   - Should see "Setup Connection" button (blue)
   - Should see info box: "QloApps is not currently configured..."

3. **Click "Setup Connection" Button**
   - Form should appear with title "Setup QloApps Connection"
   - Fields should be empty

4. **Fill in Configuration Form**
   ```
   QloApps Base URL: https://your-qloapps.com
   QloApps Hotel ID: 1
   WebService API Key: your-api-key-here
   Sync Interval: 15 (default)
   ```

5. **Click "Save Configuration" Button**
   - Button should show "Saving..." state
   - After success:
     - Green toast: "QloApps configuration saved successfully"
     - Form should close
     - Status should update to "✓ Connected" (green)
     - Should see "Edit Connection" button now

6. **Verify Database**
   ```sql
   SELECT * FROM qloapps_config 
   WHERE property_id = '00000000-0000-0000-0000-000000000001';
   ```
   Should show:
   - `base_url` set to your URL
   - `api_key_encrypted` not matching the plain text (encrypted)
   - `qloapps_hotel_id` set to your ID
   - `sync_enabled` = true

## Test Scenario 2: Test Connection

### Steps

1. **After successful configuration, click "Test Connection" button**
   - Button should show loading spinner
   - Should say "Testing..."

2. **Wait for test to complete**
   - On success: Green toast "✓ QloApps connection successful!"
   - On failure: Red toast with error message
   
   **Note:** If you don't have a running QloApps instance, test will fail with connection error. This is expected.

## Test Scenario 3: Update Configuration

### Steps

1. **After configuration is saved, click "Edit Connection" button**
   - Form should appear with title "Edit QloApps Connection"
   - Fields should show current values (except API key)
   - API key field should be empty/masked

2. **Modify Configuration**
   - Change Sync Interval to 30
   - Enter new API key

3. **Click "Save Configuration" Button**
   - Green toast: "QloApps configuration saved successfully"
   - Changes should be persisted

4. **Verify Database Update**
   ```sql
   SELECT sync_interval_minutes, api_key_encrypted 
   FROM qloapps_config 
   WHERE property_id = '00000000-0000-0000-0000-000000000001';
   ```

## Test Scenario 4: Form Validation

### Test 4a: Missing Required Fields

1. **Open setup form**
2. **Try to save without filling any fields**
   - Click "Save Configuration"
   - Should show HTML5 validation messages
   - Fields should be highlighted

### Test 4b: Invalid URL Format

1. **Open setup form**
2. **Enter invalid URL**
   - Try: `hotel.qloapps.com` (missing https://)
   - Try: `invalid url here`
3. **Click "Save Configuration"**
   - Should show HTML5 URL validation error
   - Should not be able to submit

### Test 4c: Invalid Hotel ID

1. **Open setup form**
2. **Enter invalid hotel ID**
   - Try: `0`
   - Try: `-5`
   - Try: `abc`
3. **Click "Save Configuration"**
   - Error should appear: "qloAppsHotelId must be a positive number"
   - Form should stay open

### Test 4d: Missing API Key

1. **Open setup form**
2. **Fill all fields except API Key**
3. **Click "Save Configuration"**
   - Error should appear: "baseUrl, apiKey, and qloAppsHotelId are required"
   - Form should stay open

## Test Scenario 5: Error Handling

### Test 5a: Network Error

1. **Stop backend server**
2. **Try to submit form**
   - Should show network error in form
   - Should show error toast

### Test 5b: Permission Error

1. **Login as non-admin user (VIEWER role)**
2. **Try to access Settings Channel Manager tab**
   - Should show permission error or form should not be visible

### Test 5c: Server Error

1. **With valid form data, simulate server error** (manual testing)
2. **Should show error message in form**
3. **Should not close form**
4. **User can correct and retry**

## Test Scenario 6: API Testing (Using cURL)

### Save Configuration
```bash
curl -X POST http://localhost:5000/api/v1/settings/channel-manager/setup-qloapps \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://hotel.qloapps.com",
    "apiKey": "test-api-key-123",
    "qloAppsHotelId": 1,
    "syncInterval": 15
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "QloApps configuration saved successfully"
}
```

### Get Configuration Status
```bash
curl http://localhost:5000/api/v1/settings/channel-manager \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "active": "beds24",
  "available": ["beds24", "qloapps"],
  "beds24": { "configured": true, "syncEnabled": false },
  "qloapps": { "configured": true, "syncEnabled": true }
}
```

### Test Connection
```bash
curl -X POST http://localhost:5000/api/v1/settings/channel-manager/test-qloapps \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response (if QloApps not accessible):
```json
{
  "success": false,
  "message": "Connection refused or network error"
}
```

## Test Scenario 7: Security Testing

### Test 7a: API Key Encryption

1. **Save configuration with known API key**
   - Base URL: `https://test.com`
   - Hotel ID: `1`
   - API Key: `plaintext-secret-123`

2. **Query database directly**
   ```sql
   SELECT api_key_encrypted FROM qloapps_config LIMIT 1;
   ```
   - Should NOT show `plaintext-secret-123`
   - Should show encrypted gibberish

3. **Try to use decrypted key**
   - Backend uses decrypted key for API calls
   - But database stores encrypted version
   - ✓ Verified

### Test 7b: Access Control

1. **Login as VIEWER user**
2. **Try to access configuration form**
   - Should not see "Setup Connection" button
   - Or should get 403 Forbidden error

3. **Try direct API call with VIEWER token**
   ```bash
   curl -X POST http://localhost:5000/api/v1/settings/channel-manager/setup-qloapps \
     -H "Authorization: Bearer VIEWER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"baseUrl": "...", "apiKey": "...", "qloAppsHotelId": 1}'
   ```
   - Should get 403 Forbidden response

## Expected Test Results

| Test | Expected Result | Status |
|------|-----------------|--------|
| Form appears when clicked | Shows form with empty fields | ✓ |
| Required fields validated | Cannot submit without filling | ✓ |
| URL format validated | Invalid URLs rejected | ✓ |
| Hotel ID validated | Must be positive number | ✓ |
| Successful save | Form closes, status updates | ✓ |
| API key encrypted | Database shows encrypted value | ✓ |
| Test connection works | Calls QloApps API | ✓ |
| Can edit configuration | Shows form with current values | ✓ |
| Error handling | Shows friendly error messages | ✓ |
| Access control | Only ADMIN/SUPER_ADMIN can use | ✓ |

## Debugging Tips

### Check Backend Logs
```bash
# Terminal where backend is running
# Should see:
# [ChannelManager] Initializing...
# [ChannelManager] Active: beds24
```

### Check Network Requests
```
Browser DevTools → Network Tab
Filter for: setup-qloapps
Should see:
- Request: POST /api/v1/settings/channel-manager/setup-qloapps
- Status: 200 (success) or error code
- Response: JSON with success/error
```

### Check Database
```sql
-- See configuration
SELECT * FROM qloapps_config;

-- See last update
SELECT updated_at FROM qloapps_config ORDER BY updated_at DESC LIMIT 1;

-- See channel manager status
SELECT active_channel_manager FROM hotel_settings WHERE id = '00000000-0000-0000-0000-000000000001';
```

### Check Frontend Console
```
Browser DevTools → Console
Should see:
- API responses
- Error messages
- Form validation messages
```

## What to Do After Testing

1. **Verify Configuration is Saved**
   - Check database: `SELECT * FROM qloapps_config;`
   - Should have exactly 1 record

2. **Test Connection Button**
   - If QloApps is accessible, test should pass
   - If not, that's expected for development

3. **Proceed to Next Phase**
   - Room type mapping
   - Reservation synchronization
   - Availability sync
   - Rate sync

## Troubleshooting Common Issues

### "Setup Connection button doesn't appear"
- **Cause:** Component not updating
- **Solution:** Refresh page, check browser console for errors

### "Form won't submit"
- **Cause:** Validation error
- **Solution:** Check browser console for validation messages, fill in all required fields

### "Error: QloApps is not configured"
- **Cause:** Configuration not saved successfully
- **Solution:** Check database, try again with valid configuration

### "API key not being encrypted"
- **Cause:** Missing encryption utility
- **Solution:** Check `backend/src/utils/encryption.ts` exists

### "Access Denied error"
- **Cause:** Not logged in as admin
- **Solution:** Login with ADMIN or SUPER_ADMIN account

---

## Success Criteria

✓ Configuration form appears and is user-friendly
✓ All fields are validated (both client and server)
✓ Configuration is saved to database
✓ API key is properly encrypted
✓ Test connection button works
✓ Configuration can be edited
✓ Error messages are clear and helpful
✓ Only admins can configure
✓ After save, "✓ Connected" status shows
