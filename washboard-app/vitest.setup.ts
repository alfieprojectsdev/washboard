// vitest.setup.ts
// The database is provided by src/__tests__/helpers/test-db.ts (see the alias in
// vitest.config.ts). Signup is invite-only; give tests a known invite code.
process.env.SIGNUP_INVITE_CODE = process.env.SIGNUP_INVITE_CODE || 'test-invite-code';
