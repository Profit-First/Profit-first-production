# Shopify Sync Service Improvements

## Overview
The improved Shopify sync service adds robust error handling, checkpoint/resume capability, and automatic retry mechanisms to ensure reliable data synchronization even with network issues or API failures.

## Key Features

### 1. **Checkpoint System**
- Saves progress after each page fetch to DynamoDB
- Automatically resumes from last checkpoint if sync is interrupted
- Checkpoints expire after 7 days (TTL)
- Stores:
  - Current page number
  - Next URL to fetch
  - All fetched orders so far
  - Failed pages list

### 2. **Retry Logic with Exponential Backoff**
- Automatically retries failed requests up to 3 times
- Uses exponential backoff (1s → 2s → 4s → max 60s)
- Handles rate limits (429 errors) with proper wait times
- Respects `Retry-After` header from Shopify

### 3. **Failed Batch Recovery**
- Tracks batches that fail to write to DynamoDB
- Stores failed batches separately for later retry
- Provides manual retry function: `retryFailedBatches()`
- Prevents data loss even if database writes fail

### 4. **Better Error Reporting**
- Detailed error messages for each failure type
- Tracks which specific pages failed
- Reports failed batch ranges
- Progress updates include error information

## Setup

### 1. Create Checkpoints Table
```bash
cd Auth-service
node scripts/create-checkpoints-table.js
```

This creates a `sync_checkpoints` table with:
- Partition key: `userId`
- Sort key: `syncType`
- TTL enabled on `ttl` field (7 days)

### 2. Update Environment Variables
Add to `.env`:
```
SYNC_CHECKPOINTS_TABLE=sync_checkpoints
```

### 3. Switch to Improved Service
Replace the old service import:
```javascript
// Old
const shopifySyncService = require('./services/shopify-sync.service');

// New
const shopifySyncService = require('./services/shopify-sync-improved.service');
```

## Usage

### Manual Sync (with resume capability)
```javascript
const result = await shopifySyncService.manualSync(userId);

// Result includes:
// {
//   success: true,
//   data: {
//     orders: 1250,
//     failedPages: 0,
//     failedBatches: 0
//   }
// }
```

### Retry Failed Batches
```javascript
const result = await shopifySyncService.retryFailedBatches(
  userId,
  'manual', // syncType: 'manual', 'initial', or 'daily'
  'orders'  // dataType: 'orders', 'products', or 'customers'
);

// Result:
// {
//   success: true,
//   retriedCount: 5,
//   stillFailedCount: 0
// }
```

### Check Sync Status
```javascript
const status = shopifySyncService.getSyncStatus(userId);

// Returns:
// {
//   status: 'in_progress',
//   stage: 'fetching',
//   ordersCount: 750,
//   page: 3,
//   message: 'Fetching page 3... (750 orders so far)',
//   updatedAt: '2025-12-23T10:30:00.000Z'
// }
```

## How It Works

### Sync Flow with Checkpoints

1. **Start Sync**
   - Check for existing checkpoint
   - If found, resume from last page
   - If not, start from beginning

2. **Fetch Each Page**
   - Retry up to 3 times on failure
   - Handle rate limits automatically
   - Save checkpoint after each successful page

3. **Save to Database**
   - Write in batches of 25 items
   - Retry failed batches automatically
   - Track any batches that still fail

4. **Complete Sync**
   - Clear checkpoint on success
   - Save failed batches for manual retry
   - Update connection timestamps

### Error Scenarios

#### Scenario 1: Network Timeout During Fetch
```
Page 5 fetch → Timeout
  ↓
Retry 1 (after 1s) → Timeout
  ↓
Retry 2 (after 2s) → Timeout
  ↓
Retry 3 (after 4s) → Success
  ↓
Save checkpoint → Continue to page 6
```

#### Scenario 2: Rate Limit Hit
```
Page 10 fetch → 429 Rate Limit (Retry-After: 300s)
  ↓
Wait 300 seconds
  ↓
Retry → Success
  ↓
Save checkpoint → Continue to page 11
```

#### Scenario 3: Database Write Failure
```
Fetch 250 orders → Success
  ↓
Write batch 1-25 → Success
Write batch 26-50 → Failed (network issue)
Write batch 51-75 → Success
  ↓
Save failed batch (26-50) to checkpoints table
  ↓
Continue sync
  ↓
Later: Manual retry of failed batch → Success
```

#### Scenario 4: Sync Interrupted (Server Restart)
```
Syncing... Page 15 of 50
  ↓
Server crashes/restarts
  ↓
User clicks "Sync Now" again
  ↓
Load checkpoint → Resume from page 15
  ↓
Continue sync from where it stopped
```

## Monitoring

### Check for Failed Batches
Query the `sync_checkpoints` table for items with `syncType` ending in `_failed_orders`:
```javascript
// Example: manual_failed_orders, initial_failed_orders
```

### View Checkpoint Status
```javascript
const checkpoint = await shopifySyncService.loadCheckpoint(userId, 'manual');
console.log('Current progress:', checkpoint);
```

## Performance

### Rate Limiting
- **Initial/Manual Sync**: 2 minutes between pages (safe for large syncs)
- **Daily Sync**: 30 seconds between pages (faster for small updates)

### Batch Sizes
- **Fetch**: 250 orders per page (Shopify max)
- **Write**: 25 items per batch (DynamoDB max)

### Timeouts
- **API Request**: 30 seconds
- **Retry Delays**: 1s → 2s → 4s → max 60s

## Migration from Old Service

### Step 1: Create Table
```bash
node scripts/create-checkpoints-table.js
```

### Step 2: Update Imports
Replace in all files:
```javascript
// controllers/onboarding.controller.js
// controllers/dashboard.controller.js
// services/sync-scheduler.service.js

const shopifySyncService = require('../services/shopify-sync-improved.service');
```

### Step 3: Test
1. Start a manual sync
2. Stop the server mid-sync
3. Restart and sync again
4. Verify it resumes from checkpoint

## Troubleshooting

### Sync Stuck in "in_progress"
```javascript
// Clear sync status
shopifySyncService.clearSyncStatus(userId);

// Clear checkpoint
await shopifySyncService.clearCheckpoint(userId, 'manual');
```

### Too Many Failed Batches
```javascript
// Retry all failed batches
await shopifySyncService.retryFailedBatches(userId, 'manual', 'orders');
```

### Checkpoint Not Resuming
- Check if `sync_checkpoints` table exists
- Verify TTL hasn't expired (7 days)
- Check DynamoDB permissions

## Future Enhancements

1. **Parallel Fetching**: Fetch multiple pages concurrently
2. **Smart Rate Limiting**: Adjust delays based on API response times
3. **Webhook Integration**: Real-time updates instead of polling
4. **Compression**: Store checkpoint data compressed
5. **Analytics**: Track sync performance metrics

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Query `sync_checkpoints` table for checkpoint data
3. Use `retryFailedBatches()` to recover failed writes
4. Clear checkpoints if sync is stuck
