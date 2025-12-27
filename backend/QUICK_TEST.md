# Quick Test Guide - Phase 1

## 🚀 Quick Start (5 minutes)

### 1. Setup Environment

```bash
cd backend

# Generate encryption key
openssl rand -hex 32

# Add to .env file:
# ENCRYPTION_KEY=<generated-key>
```

### 2. Run Migrations

```bash
npm run db:migrate
```

### 3. Run Quick Test

```bash
npx tsx scripts/test-phase1.ts
```

**Expected Output:**
```
🧪 Beds24 Phase 1 - Quick Test
==================================================

📦 Test 1: Encryption Utility
   ✅ Encrypt/Decrypt works
   ✅ Hash works (SHA-256)

🗄️  Test 2: Database Tables
   ✅ Table 'beds24_config' exists
   ✅ Table 'sync_conflicts' exists
   ✅ Table 'webhook_events' exists
   ✅ rooms.beds24_room_id column exists

🔌 Test 3: Beds24Client
   ✅ Circuit breaker initialized (CLOSED)
   ✅ Rate limiter works

💾 Test 4: Database Operations
   ✅ Config insert/update works
   ✅ Config read/decrypt works
   ✅ Cleanup successful

==================================================

📊 Test Summary:
   ✅ Passed: 10
   ❌ Failed: 0
   📈 Total:  10

🎉 All tests passed! Phase 1 is ready!
```

---

## 📋 Manual Testing Steps

### Step 1: Test Encryption

```bash
npx tsx -e "
import { encrypt, decrypt } from './src/utils/encryption.js';
const text = 'my-secret-token';
const encrypted = encrypt(text);
const decrypted = decrypt(encrypted);
console.log('Original:', text);
console.log('Encrypted:', encrypted.substring(0, 50) + '...');
console.log('Decrypted:', decrypted);
console.log('Match:', text === decrypted ? '✅' : '❌');
"
```

### Step 2: Test Database

```bash
# Check tables exist
psql -d hotel_pms_dev -c "\dt" | grep beds24

# Or using Node
npx tsx -e "
import db from './src/config/database.js';
const tables = await db.raw(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%beds24%'\");
console.log('Tables:', tables.rows.map(r => r.tablename));
await db.destroy();
"
```

### Step 3: Test Beds24Client (Mocked)

```bash
npx tsx -e "
import { Beds24Client } from './src/integrations/beds24/index.js';
const client = new Beds24Client('test-token');
console.log('Client created:', client ? '✅' : '❌');
console.log('Circuit breaker:', client.getCircuitBreakerState());
"
```

---

## 🔍 Detailed Testing

For comprehensive testing, see: `docs/BEDS24_PHASE1_TESTING_GUIDE.md`

---

## ⚠️ Troubleshooting

### "ENCRYPTION_KEY not set"
```bash
# Generate and add to .env
openssl rand -hex 32
```

### "Table does not exist"
```bash
# Run migrations
npm run db:migrate
```

### "Database connection failed"
```bash
# Check .env file has correct DB credentials
# Test connection:
psql -d hotel_pms_dev -c "SELECT 1;"
```

