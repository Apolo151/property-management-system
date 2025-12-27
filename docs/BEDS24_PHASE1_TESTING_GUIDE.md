# Beds24 Integration - Phase 1 Manual Testing Guide

## Prerequisites

1. **Database Setup**
   ```bash
   # Ensure PostgreSQL is running
   # Check connection in .env file
   ```

2. **Environment Variables**
   Create/update `.env` file:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=hotel_pms_dev
   DB_USER=postgres
   DB_PASSWORD=your_password

   # Encryption Key (REQUIRED)
   # Generate with: openssl rand -hex 32
   ENCRYPTION_KEY=your-64-character-hex-key-here

   # Beds24 API (optional, has defaults)
   BEDS24_API_BASE_URL=https://api.beds24.com/v2
   ```

3. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

---

## Step 1: Run Database Migrations

```bash
cd backend
npm run db:migrate
```

**Verify:**
```bash
# Check migration status
npm run db:migrate:status

# Verify tables were created (using psql or any DB client)
psql -d hotel_pms_dev -c "\dt" | grep beds24
```

**Expected Tables:**
- `beds24_config`
- `sync_conflicts`
- `webhook_events`
- `rooms` should have `beds24_room_id` column

---

## Step 2: Test Encryption Utility

Create a test script: `backend/test-encryption.ts`

```typescript
import { encrypt, decrypt, hash } from './src/utils/encryption.js';

console.log('=== Testing Encryption Utility ===\n');

// Test 1: Encrypt/Decrypt
const originalText = 'my-secret-refresh-token-12345';
console.log('Original:', originalText);

const encrypted = encrypt(originalText);
console.log('Encrypted:', encrypted);

const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', originalText === decrypted ? '✅' : '❌');

// Test 2: Hash
const hashValue = hash('test-data');
console.log('\nHash:', hashValue);
console.log('Hash length:', hashValue.length, '(should be 64 for SHA-256)');

// Test 3: Different inputs produce different encrypted values
const encrypted1 = encrypt('same-text');
const encrypted2 = encrypt('same-text');
console.log('\nSame text encrypted twice:');
console.log('Encrypted 1:', encrypted1.substring(0, 50) + '...');
console.log('Encrypted 2:', encrypted2.substring(0, 50) + '...');
console.log('Different:', encrypted1 !== encrypted2 ? '✅' : '❌');
console.log('Both decrypt correctly:', 
  decrypt(encrypted1) === 'same-text' && decrypt(encrypted2) === 'same-text' ? '✅' : '❌');
```

**Run:**
```bash
cd backend
npx tsx test-encryption.ts
```

**Expected Output:**
- ✅ Encryption/decryption works
- ✅ Hash produces 64-character hex string
- ✅ Same text encrypted twice produces different ciphertext (due to random IV)
- ✅ Both encrypted values decrypt to same original text

---

## Step 3: Test Beds24Client (Mocked)

Create test script: `backend/test-beds24-client.ts`

```typescript
import { Beds24Client } from './src/integrations/beds24/index.js';
import { Beds24AuthenticationError, Beds24RateLimitError } from './src/integrations/beds24/index.js';

console.log('=== Testing Beds24Client ===\n');

// Mock fetch globally
const originalFetch = global.fetch;

async function testClient() {
  // Test 1: Authentication with invite code
  console.log('Test 1: Authentication...');
  global.fetch = async (url: string | URL, options?: RequestInit) => {
    if (url.toString().includes('/authentication/setup')) {
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: {
            refreshToken: 'mock-refresh-token-123',
            expiresIn: 2592000,
          },
        }),
      } as Response;
    }
    throw new Error('Unexpected request');
  };

  const client = new Beds24Client();
  const authResult = await client.authenticate('test-invite-code');
  console.log('✅ Auth successful:', authResult.refreshToken ? 'Yes' : 'No');
  console.log('   Refresh token:', authResult.refreshToken);

  // Test 2: Token refresh
  console.log('\nTest 2: Token Refresh...');
  global.fetch = async (url: string | URL, options?: RequestInit) => {
    if (url.toString().includes('/authentication/token')) {
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: {
            token: 'mock-access-token-456',
            expiresIn: 900, // 15 minutes
          },
        }),
      } as Response;
    }
    throw new Error('Unexpected request');
  };

  const tokenResult = await client.refreshAccessToken('mock-refresh-token-123');
  console.log('✅ Token refresh successful:', tokenResult.token ? 'Yes' : 'No');
  console.log('   Access token:', tokenResult.token);
  console.log('   Expires in:', tokenResult.expiresIn, 'seconds');

  // Test 3: API Request
  console.log('\nTest 3: API Request...');
  global.fetch = async (url: string | URL, options?: RequestInit) => {
    if (url.toString().includes('/authentication/token')) {
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: {
            token: 'mock-access-token-456',
            expiresIn: 900,
          },
        }),
      } as Response;
    }
    if (url.toString().includes('/bookings')) {
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({
          success: true,
          type: 'bookings',
          data: [
            { id: 1, propertyId: 123, status: 'confirmed' },
            { id: 2, propertyId: 123, status: 'confirmed' },
          ],
        }),
      } as Response;
    }
    throw new Error('Unexpected request');
  };

  const client2 = new Beds24Client('mock-refresh-token-123');
  const bookings = await client2.makeRequest('/bookings', {
    method: 'GET',
    query: { filter: 'new' },
  });
  console.log('✅ API request successful');
  console.log('   Bookings count:', Array.isArray(bookings) ? bookings.length : 'N/A');

  // Test 4: Error Handling - Authentication Error
  console.log('\nTest 4: Error Handling (401)...');
  global.fetch = async () => {
    return {
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid refresh token',
        },
      }),
    } as Response;
  };

  try {
    await client2.refreshAccessToken('invalid-token');
    console.log('❌ Should have thrown error');
  } catch (error) {
    if (error instanceof Beds24AuthenticationError) {
      console.log('✅ Authentication error caught correctly');
      console.log('   Error message:', error.message);
    } else {
      console.log('❌ Wrong error type:', error);
    }
  }

  // Test 5: Rate Limiting
  console.log('\nTest 5: Rate Limiting...');
  const client3 = new Beds24Client('mock-refresh-token');
  const rateLimiter = (client3 as any).rateLimiter;
  
  // Exhaust rate limit
  for (let i = 0; i < 101; i++) {
    rateLimiter.tryConsume();
  }

  try {
    await client3.getTokenDetails();
    console.log('❌ Should have thrown rate limit error');
  } catch (error) {
    if (error instanceof Beds24RateLimitError) {
      console.log('✅ Rate limit error caught correctly');
    } else {
      console.log('❌ Wrong error type:', error);
    }
  }

  // Restore original fetch
  global.fetch = originalFetch;
  console.log('\n✅ All tests completed!');
}

testClient().catch(console.error);
```

**Run:**
```bash
cd backend
npx tsx test-beds24-client.ts
```

---

## Step 4: Test with Real Beds24 API (Optional)

**⚠️ Requires:**
- Beds24 account
- Invite code from Beds24 settings

Create test script: `backend/test-beds24-real.ts`

```typescript
import { Beds24Client } from './src/integrations/beds24/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testRealAPI() {
  console.log('=== Testing with Real Beds24 API ===\n');
  console.log('⚠️  This will make real API calls!\n');

  // Get invite code from environment or prompt
  const inviteCode = process.env.BEDS24_INVITE_CODE;
  if (!inviteCode) {
    console.error('❌ BEDS24_INVITE_CODE not set in .env');
    console.log('Get invite code from: https://beds24.com/control3.php?pagetype=apiv2');
    process.exit(1);
  }

  try {
    // Step 1: Authenticate
    console.log('Step 1: Authenticating with invite code...');
    const client = new Beds24Client();
    const authResult = await client.authenticate(inviteCode, 'PMS-Test-Device');
    console.log('✅ Authentication successful!');
    console.log('   Refresh token:', authResult.refreshToken.substring(0, 20) + '...');
    
    // Save refresh token for future use
    console.log('\n💡 Save this refresh token in your database:');
    console.log('   ', authResult.refreshToken);

    // Step 2: Get token details
    console.log('\nStep 2: Getting token details...');
    client.setRefreshToken(authResult.refreshToken);
    const tokenDetails = await client.getTokenDetails();
    console.log('✅ Token details retrieved!');
    console.log('   Scopes:', tokenDetails.scopes?.join(', ') || 'N/A');
    console.log('   Expires in:', tokenDetails.expiresIn, 'seconds');

    // Step 3: Get properties
    console.log('\nStep 3: Fetching properties...');
    const properties = await client.makeRequest('/properties', {
      method: 'GET',
    });
    console.log('✅ Properties retrieved!');
    console.log('   Properties:', Array.isArray(properties) ? properties.length : 'N/A');

    // Step 4: Get bookings (if scope allows)
    if (tokenDetails.scopes?.includes('bookings')) {
      console.log('\nStep 4: Fetching bookings...');
      const bookings = await client.makeRequest('/bookings', {
        method: 'GET',
        query: {
          filter: 'new',
        },
      });
      console.log('✅ Bookings retrieved!');
      console.log('   Bookings:', Array.isArray(bookings) ? bookings.length : 'N/A');
    } else {
      console.log('\nStep 4: Skipped (bookings scope not available)');
    }

    console.log('\n✅ All real API tests passed!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testRealAPI();
```

**Setup:**
1. Get invite code from Beds24:
   - Go to: https://beds24.com/control3.php?pagetype=apiv2
   - Generate invite code
   - Add to `.env`: `BEDS24_INVITE_CODE=your-invite-code-here`

2. Run:
```bash
cd backend
npx tsx test-beds24-real.ts
```

---

## Step 5: Test Database Operations

Create test script: `backend/test-db-operations.ts`

```typescript
import db from './src/config/database.js';
import { encrypt, decrypt } from './src/utils/encryption.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testDatabaseOperations() {
  console.log('=== Testing Database Operations ===\n');

  try {
    // Test 1: Insert beds24_config
    console.log('Test 1: Inserting beds24_config...');
    const propertyId = '00000000-0000-0000-0000-000000000001'; // Default hotel_settings ID
    const refreshToken = 'test-refresh-token-12345';
    const encryptedRefreshToken = encrypt(refreshToken);

    const [configId] = await db('beds24_config')
      .insert({
        property_id: propertyId,
        refresh_token: encryptedRefreshToken,
        beds24_property_id: '12345',
        sync_enabled: true,
        push_sync_enabled: true,
        pull_sync_enabled: true,
        webhook_enabled: true,
      })
      .returning('id');

    console.log('✅ Config inserted:', configId);

    // Test 2: Read and decrypt
    console.log('\nTest 2: Reading and decrypting config...');
    const config = await db('beds24_config')
      .where({ id: configId })
      .first();

    if (config) {
      const decryptedToken = decrypt(config.refresh_token);
      console.log('✅ Config retrieved');
      console.log('   Original token:', refreshToken);
      console.log('   Decrypted token:', decryptedToken);
      console.log('   Match:', refreshToken === decryptedToken ? '✅' : '❌');
    }

    // Test 3: Insert sync conflict
    console.log('\nTest 3: Inserting sync conflict...');
    const [conflictId] = await db('sync_conflicts')
      .insert({
        beds24_booking_id: 'BEDS24-123',
        conflict_type: 'TIMESTAMP_CONFLICT',
        pms_data: { updated_at: '2024-01-01T10:00:00Z' },
        beds24_data: { lastModified: '2024-01-01T11:00:00Z' },
        resolution_strategy: 'MANUAL',
      })
      .returning('id');

    console.log('✅ Conflict inserted:', conflictId);

    // Test 4: Query conflicts
    console.log('\nTest 4: Querying unresolved conflicts...');
    const unresolvedConflicts = await db('sync_conflicts')
      .where({ resolution_strategy: 'MANUAL' })
      .select('*');

    console.log('✅ Unresolved conflicts:', unresolvedConflicts.length);

    // Test 5: Insert webhook event
    console.log('\nTest 5: Inserting webhook event...');
    const [webhookId] = await db('webhook_events')
      .insert({
        event_id: 'webhook-event-123',
        event_type: 'booking.created',
        payload: { bookingId: 123, status: 'confirmed' },
        processed: false,
      })
      .returning('id');

    console.log('✅ Webhook event inserted:', webhookId);

    // Test 6: Check idempotency
    console.log('\nTest 6: Testing idempotency (duplicate event_id)...');
    try {
      await db('webhook_events')
        .insert({
          event_id: 'webhook-event-123', // Same event_id
          event_type: 'booking.modified',
          payload: { bookingId: 123, status: 'modified' },
          processed: false,
        });
      console.log('❌ Should have failed (unique constraint)');
    } catch (error: any) {
      if (error.code === '23505') { // PostgreSQL unique violation
        console.log('✅ Idempotency enforced (duplicate rejected)');
      } else {
        throw error;
      }
    }

    // Cleanup
    console.log('\nCleaning up test data...');
    await db('webhook_events').where({ id: webhookId }).delete();
    await db('sync_conflicts').where({ id: conflictId }).delete();
    await db('beds24_config').where({ id: configId }).delete();
    console.log('✅ Cleanup complete');

    console.log('\n✅ All database tests passed!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

testDatabaseOperations();
```

**Run:**
```bash
cd backend
npx tsx test-db-operations.ts
```

---

## Step 6: Integration Test (Full Flow)

Create test script: `backend/test-integration.ts`

```typescript
import { Beds24Client } from './src/integrations/beds24/index.js';
import db from './src/config/database.js';
import { encrypt, decrypt } from './src/utils/encryption.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testIntegration() {
  console.log('=== Integration Test: Full Flow ===\n');

  const propertyId = '00000000-0000-0000-0000-000000000001';

  try {
    // Step 1: Authenticate and save config
    console.log('Step 1: Authenticating...');
    const inviteCode = process.env.BEDS24_INVITE_CODE;
    if (!inviteCode) {
      console.log('⚠️  Skipping real auth (no BEDS24_INVITE_CODE)');
      console.log('   Using mock refresh token for testing...');
      
      // Mock config
      const mockRefreshToken = 'mock-refresh-token-for-testing';
      const encryptedToken = encrypt(mockRefreshToken);

      await db('beds24_config')
        .insert({
          property_id: propertyId,
          refresh_token: encryptedToken,
          beds24_property_id: '12345',
          sync_enabled: true,
        })
        .onConflict('property_id')
        .merge();

      console.log('✅ Mock config saved');
    } else {
      const client = new Beds24Client();
      const authResult = await client.authenticate(inviteCode);
      
      const encryptedToken = encrypt(authResult.refreshToken);
      await db('beds24_config')
        .insert({
          property_id: propertyId,
          refresh_token: encryptedToken,
          beds24_property_id: '12345',
          sync_enabled: true,
        })
        .onConflict('property_id')
        .merge();

      console.log('✅ Real authentication and config saved');
    }

    // Step 2: Load config and initialize client
    console.log('\nStep 2: Loading config...');
    const config = await db('beds24_config')
      .where({ property_id: propertyId })
      .first();

    if (!config) {
      throw new Error('Config not found');
    }

    const decryptedToken = decrypt(config.refresh_token);
    const client = new Beds24Client(decryptedToken);
    console.log('✅ Client initialized with stored token');

    // Step 3: Test client operations
    console.log('\nStep 3: Testing client operations...');
    // Note: This will fail if using mock token, but shows the flow
    try {
      const tokenDetails = await client.getTokenDetails();
      console.log('✅ Token details retrieved');
      console.log('   Scopes:', tokenDetails.scopes?.join(', ') || 'N/A');
    } catch (error) {
      console.log('⚠️  Token details failed (expected with mock token)');
      console.log('   Error:', (error as Error).message);
    }

    // Step 4: Update last sync time
    console.log('\nStep 4: Updating sync status...');
    await db('beds24_config')
      .where({ property_id: propertyId })
      .update({
        last_successful_sync: new Date(),
        updated_at: new Date(),
      });

    const updatedConfig = await db('beds24_config')
      .where({ property_id: propertyId })
      .first();

    console.log('✅ Sync status updated');
    console.log('   Last sync:', updatedConfig?.last_successful_sync);

    console.log('\n✅ Integration test completed!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

testIntegration();
```

**Run:**
```bash
cd backend
npx tsx test-integration.ts
```

---

## Quick Test Checklist

- [ ] Migrations run successfully
- [ ] Encryption utility works (encrypt/decrypt)
- [ ] Beds24Client initializes
- [ ] Authentication flow works (mocked)
- [ ] Token refresh works (mocked)
- [ ] API requests work (mocked)
- [ ] Error handling works
- [ ] Rate limiting works
- [ ] Database operations work
- [ ] Integration flow works

---

## Troubleshooting

### Migration Errors
```bash
# Check migration status
npm run db:migrate:status

# Rollback if needed
npm run db:migrate:rollback

# Check database connection
psql -d hotel_pms_dev -c "SELECT 1;"
```

### Encryption Errors
- Ensure `ENCRYPTION_KEY` is set in `.env`
- Key should be 64 hex characters (32 bytes)
- Generate new key: `openssl rand -hex 32`

### API Errors
- Check network connectivity
- Verify Beds24 API is accessible
- Check rate limits (100 requests/5min)
- Verify invite code is valid

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Phase 1 is validated
2. Ready for Phase 2: Push Sync Implementation
3. Consider setting up CI/CD for automated testing

