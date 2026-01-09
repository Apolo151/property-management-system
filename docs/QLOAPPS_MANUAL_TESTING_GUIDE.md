# QloApps Channel Manager Manual Testing Guide

This guide provides step-by-step instructions for manually testing the QloApps channel manager integration.

## Prerequisites

1. **Backend Running**: Ensure the backend server is running on `http://localhost:3000`
2. **Frontend Running**: Ensure the frontend is running on `http://localhost:5173`
3. **RabbitMQ Running**: RabbitMQ should be running on `localhost:5672`
4. **QloApps Configured**: Environment variables set in `.env`:
   ```
   QLOAPPS_API_URL=https://your-qloapps-instance.com/api
   QLOAPPS_API_KEY=your-api-key
   ```

## Test Scenarios

### 1. Channel Manager Status Page

**Objective**: Verify the Channel Manager tab displays correctly in Settings.

**Steps**:
1. Navigate to Settings page (`/settings`)
2. Click on "Channel Manager" tab
3. Verify the page displays:
   - QloApps section with connection status
   - "Connected" or "Not Configured" badge
   - "Test Connection" button
   - Sync Features list

**Expected Results**:
- If QloApps is configured: Green "Connected" badge, enabled "Test Connection" button
- If not configured: Gray "Not Configured" badge, warning about missing env vars

---

### 2. Test Connection

**Objective**: Verify the test connection functionality works.

**Steps**:
1. Navigate to Settings > Channel Manager tab
2. Click "Test Connection" button
3. Wait for response

**Expected Results**:
- **Success**: Toast notification "QloApps connection successful!"
- **Failure**: Toast notification with error message

**API Endpoint**: `POST /api/settings/channel-managers/test`

---

### 3. Reservation Sync on Create

**Objective**: Verify new reservations are synced to QloApps.

**Steps**:
1. Navigate to Reservations page
2. Create a new reservation with:
   - Guest: Select or create a guest
   - Room Type: Select an existing room type
   - Check-in: Future date
   - Check-out: Day after check-in
   - Status: CONFIRMED
3. Save the reservation
4. Check RabbitMQ queues or logs for sync message

**Expected Results**:
- Reservation created in PMS
- Message queued to `qloapps.outbound` queue
- Log entry: `[QloApps] Syncing reservation: <reservation_id>`

**Verification**:
```bash
# Check RabbitMQ queue
curl -u guest:guest http://localhost:15672/api/queues/%2f/qloapps.outbound

# Check backend logs for sync activity
```

---

### 4. Reservation Sync on Update

**Objective**: Verify reservation updates are synced to QloApps.

**Steps**:
1. Edit an existing reservation
2. Change the check-out date or status
3. Save changes
4. Check logs for sync message

**Expected Results**:
- Reservation updated in PMS
- Message queued with `action: 'update'`
- Log entry: `[QloApps] Updating reservation: <reservation_id>`

---

### 5. Reservation Cancellation Sync

**Objective**: Verify cancelled reservations are synced to QloApps.

**Steps**:
1. Find an existing confirmed reservation
2. Change status to "CANCELLED"
3. Save changes
4. Check logs for cancellation sync

**Expected Results**:
- Reservation cancelled in PMS
- Cancellation message queued
- Log entry: `[QloApps] Cancelling reservation: <reservation_id>`

---

### 6. Room Availability Sync

**Objective**: Verify room availability updates are synced.

**Steps**:
1. Navigate to Rooms page
2. Update a room's housekeeping status (e.g., mark as "Under Maintenance")
3. Check logs for availability sync

**Expected Results**:
- Room status updated
- Availability sync message queued
- Log entry: `[QloApps] Syncing availability for room type: <room_type_id>`

---

### 7. Rate Sync (via Room Type Update)

**Objective**: Verify rate changes are synced to QloApps.

**Steps**:
1. Navigate to Room Types page
2. Edit a room type
3. Update the base price
4. Save changes
5. Check logs for rate sync

**Expected Results**:
- Room type updated in PMS
- Rate sync message queued
- Log entry: `[QloApps] Syncing rates for room type: <room_type_id>`

---

### 8. QloApps Worker Processing

**Objective**: Verify the outbound worker processes queued messages.

**Steps**:
1. Ensure RabbitMQ is running
2. Start the QloApps outbound worker:
   ```bash
   cd backend && npm run worker:qloapps-outbound
   ```
3. Create a test reservation
4. Monitor worker logs

**Expected Results**:
- Worker picks up messages from queue
- API calls made to QloApps
- Success/error logged

---

## Troubleshooting

### Connection Issues

**Problem**: "Not Configured" shown even with env vars set

**Solution**:
1. Verify `.env` file has correct values
2. Restart backend server
3. Check logs for initialization errors

### Queue Not Processing

**Problem**: Messages stuck in queue

**Solution**:
1. Verify RabbitMQ is running: `docker ps | grep rabbitmq`
2. Check worker is running
3. Check RabbitMQ management UI: `http://localhost:15672`

### API Errors

**Problem**: Sync fails with API errors

**Solution**:
1. Verify QloApps API URL is correct (include `/api` suffix)
2. Verify API key has correct permissions
3. Check QloApps webservice module is enabled

---

## API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings/channel-managers/status` | GET | Get channel manager status |
| `/api/settings/channel-managers/switch` | POST | Switch active channel manager |
| `/api/settings/channel-managers/test` | POST | Test channel manager connection |

---

## Log Locations

- **Backend logs**: Console output from `npm run dev`
- **Worker logs**: Console output from worker processes
- **RabbitMQ**: Management UI at `http://localhost:15672`

---

## Quick Verification Commands

```bash
# Check channel manager status
curl -s http://localhost:3000/api/settings/channel-managers/status | jq .

# Test QloApps connection
curl -X POST http://localhost:3000/api/settings/channel-managers/test \
  -H "Content-Type: application/json" \
  -d '{"manager": "qloapps"}' | jq .

# Check RabbitMQ queues
curl -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name, messages}'
```

---

## Success Criteria

The channel manager integration is working correctly when:

1. ✅ Channel Manager tab shows "Connected" status
2. ✅ Test Connection returns success
3. ✅ New reservations queue sync messages
4. ✅ Updated reservations queue sync messages  
5. ✅ Cancelled reservations queue cancellation messages
6. ✅ Room availability changes queue sync messages
7. ✅ Rate changes queue sync messages
8. ✅ Workers process queued messages successfully
