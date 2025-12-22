/**
 * Re-sync Meta data for account 889786217551799
 */
require('dotenv').config();
const metaSyncService = require('../services/meta-sync.service');

async function resyncMetaData() {
  const userId = 'e1c32dea-7001-70ec-4323-41d4e59e589a';
  
  console.log('🔄 Re-syncing Meta data (3 months)...\n');
  
  try {
    const result = await metaSyncService.fetch3MonthsData(userId);
    console.log('\n✅ Sync complete:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resyncMetaData();
