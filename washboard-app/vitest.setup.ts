// vitest.setup.ts
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Set environment for testing
  process.env.USE_MOCK_DB = 'true';
  process.env.NODE_ENV = 'test';

  console.log('🧪 Test environment initialized');
  console.log('   Using pg-mem (mock database)');
});

afterAll(async () => {
  // Cleanup if needed
  console.log('✅ Test environment cleaned up');
});
