// vitest.setup.ts
// The database is provided by src/__tests__/helpers/test-db.ts (see the alias in
// vitest.config.ts). Owner setup signup needs a known code in tests.
process.env.OWNER_SETUP_CODE = process.env.OWNER_SETUP_CODE || 'test-setup-code';
