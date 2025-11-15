# Booking Submission Fix - Critical PostgreSQL Error

**Date:** 2025-11-15
**Status:** ✅ RESOLVED
**Severity:** CRITICAL
**Impact:** All booking submissions were failing in production

---

## Executive Summary

A critical SQL error was preventing **ALL** booking submissions from working in production. The error was a PostgreSQL syntax violation: using `FOR UPDATE` with an aggregate function (`COUNT(*)`), which is not allowed.

**Resolution:** Split the query into two operations - lock rows first with `SELECT id ... FOR UPDATE`, then count with `SELECT COUNT(*)`.

**Result:** ✅ Booking submissions now working (confirmed with Playwright test - Booking ID 14 created)

---

## Timeline

| Date | Event |
|------|-------|
| 2025-11-13 | Issue first reported by user |
| 2025-11-14 | Attempted fix #1: Database setup script for shop_status table |
| 2025-11-14 | Attempted fix #2: Increased connection timeout from 2s to 15s |
| 2025-11-15 | Root cause identified: Invalid SQL query |
| 2025-11-15 | Fix deployed and verified ✅ |

---

## Root Cause Analysis

### The Problem

Location: `src/app/api/bookings/submit/route.ts:156-161`

**Invalid SQL:**
```sql
SELECT COUNT(*) as count FROM bookings
WHERE branch_code = $1 AND status IN ('queued', 'in_service')
FOR UPDATE  -- ❌ INVALID: FOR UPDATE cannot be used with aggregate functions
```

**PostgreSQL Error:**
- Error Code: `0A000` (Feature Not Supported)
- Message: `"FOR UPDATE is not allowed with aggregate functions"`

### Why It Failed Silently

The error was caught by the generic catch block at lines 227-239:

```typescript
catch (error: unknown) {
  console.error('Booking submission error:', error);  // Logged to Vercel

  return NextResponse.json(
    {
      error: 'An error occurred while submitting your booking',  // ❌ Generic message
      code: 'SERVER_ERROR',
    },
    { status: 500 }
  );
}
```

The user only saw **"An error occurred while submitting your booking"** - no indication of the actual SQL error.

### Previous Misdiagnoses

1. **Assumption:** Missing `shop_status` table entry
   - **Fix Attempted:** Created database setup script
   - **Result:** ❌ Didn't help (shop_status was fine)

2. **Assumption:** Database connection timeout
   - **Fix Attempted:** Increased timeout from 2s to 15s
   - **Result:** ❌ Didn't help (timeout wasn't the issue)

3. **Actual Cause:** Invalid SQL query (FOR UPDATE with COUNT)
   - **Discovery Method:** Created diagnostic script to simulate booking insertion
   - **Evidence:** Script failed with exact PostgreSQL error

---

## The Fix

### Solution

Split the operation into two queries:

**Before (Invalid):**
```sql
-- Single query - INVALID
SELECT COUNT(*) as count FROM bookings
WHERE branch_code = $1 AND status IN ('queued', 'in_service')
FOR UPDATE  -- ❌ ERROR: Cannot use with COUNT(*)
```

**After (Valid):**
```sql
-- Query 1: Lock the rows
SELECT id FROM bookings
WHERE branch_code = $1 AND status IN ('queued', 'in_service')
FOR UPDATE  -- ✅ Valid: Locks actual rows

-- Query 2: Count the locked rows
SELECT COUNT(*) as count FROM bookings
WHERE branch_code = $1 AND status IN ('queued', 'in_service')  -- ✅ Safe: Rows already locked
```

### Code Changes

Location: `src/app/api/bookings/submit/route.ts:153-170`

```typescript
// 6. Calculate queue position with lock
// Lock the bookings table first to prevent race conditions
// Note: We can't use FOR UPDATE with COUNT(*), so we lock by selecting rows first
await client.query(
  `SELECT id FROM bookings
   WHERE branch_code = $1 AND status IN ('queued', 'in_service')
   FOR UPDATE`,
  [branchCode]
);

// Now safely count the rows (already locked)
const positionResult = await client.query(
  `SELECT COUNT(*) as count FROM bookings
   WHERE branch_code = $1 AND status IN ('queued', 'in_service')`,
  [branchCode]
);

const position = parseInt(positionResult.rows[0].count) + 1;
```

### Why This Works

1. **First Query:** Locks all relevant rows using `FOR UPDATE`
   - Prevents race conditions
   - Other transactions wait until this one commits/rolls back

2. **Second Query:** Safely counts the locked rows
   - No `FOR UPDATE` needed (rows already locked by first query)
   - Within same transaction - lock persists
   - Result is guaranteed accurate

3. **Transaction Guarantee:** Both queries run in same transaction (BEGIN/COMMIT block)
   - Locks held until COMMIT
   - Atomic operation
   - No race conditions possible

---

## Verification

### Test Results

**Local Database Test:**
```bash
$ node scripts/test-booking-insertion.js

✅ Magic link found
✅ Shop status found: is_open=true
✅ Transaction started
✅ Rows locked
✅ Position calculated: 5
✅ Booking created: ID=13, Position=5
✅ Magic link marked as used
✅ Transaction committed

=== ✅✅✅ BOOKING SUBMISSION SUCCESSFUL! ===
```

**Production Test (Playwright):**
```bash
$ npx playwright test e2e/simple-booking-test.spec.ts

✅✅✅ BOOKING SUBMISSION SUCCESSFUL!
No SERVER_ERROR detected
Current URL: https://washboard.ithinkandicode.space/book/success?booking=14&position=6

  1 passed (12.2s)
```

**Database Verification:**
```sql
SELECT id, position, plate, created_at FROM bookings WHERE id = 14;

id | position | plate     | created_at
14 | 6        | TEST9999  | 2025-11-15 16:35:42+00
```

---

## Prevention Measures

### 1. Add SQL Validation Tests

Create unit tests for all database queries to catch SQL errors before production.

**Recommendation:**
```typescript
// __tests__/database/booking-queries.test.ts
describe('Booking SQL Queries', () => {
  it('should lock rows and count without error', async () => {
    await client.query('BEGIN');

    // Should not throw
    await client.query(
      'SELECT id FROM bookings WHERE branch_code = $1 FOR UPDATE',
      ['MAIN']
    );

    const result = await client.query(
      'SELECT COUNT(*) FROM bookings WHERE branch_code = $1',
      ['MAIN']
    );

    expect(result.rows[0].count).toBeGreaterThanOrEqual(0);

    await client.query('ROLLBACK');
  });
});
```

### 2. Improve Error Logging

Add more specific error details in production logs:

**Current:**
```typescript
catch (error: unknown) {
  console.error('Booking submission error:', error);  // Generic
  return NextResponse.json({ error: 'An error occurred...' }, { status: 500 });
}
```

**Recommended:**
```typescript
catch (error: unknown) {
  const errorDetails = {
    message: error instanceof Error ? error.message : 'Unknown error',
    name: error instanceof Error ? error.name : 'Unknown',
    code: (error as any)?.code,
    detail: (error as any)?.detail,
    hint: (error as any)?.hint,
    stack: error instanceof Error ? error.stack : undefined,
  };

  console.error('Booking submission error:', JSON.stringify(errorDetails, null, 2));

  // Still return generic message to user (security), but log details for debugging
  return NextResponse.json({ error: 'An error occurred...' }, { status: 500 });
}
```

### 3. Add Database Integration Tests

Run full end-to-end database tests in CI/CD:

```bash
# In GitHub Actions or similar
- name: Test Database Queries
  run: npm run test:db
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### 4. PostgreSQL Syntax Linting

Use a SQL linter to catch syntax errors:

```bash
npm install --save-dev sql-lint
```

### 5. Add Monitoring

Set up error tracking with specific alerts:

- Sentry or similar error tracking
- Alert on any 500 errors from `/api/bookings/submit`
- Track error codes and messages

---

## Lessons Learned

1. **Generic error messages hide root causes**
   - Solution: Log detailed errors server-side, show generic messages client-side

2. **Always test SQL queries with actual database**
   - Can't catch syntax errors without running against real PostgreSQL

3. **FOR UPDATE has limitations**
   - Cannot be used with aggregate functions
   - Must lock rows first, then aggregate

4. **Previous "fixes" didn't address root cause**
   - Database setup and timeout increases were red herrings
   - Actual issue was invalid SQL syntax

5. **Diagnostic scripts are invaluable**
   - `test-booking-insertion.js` immediately revealed the exact error
   - Much faster than debugging through production logs

---

## Related Files

### Modified Files
- `src/app/api/bookings/submit/route.ts` - Fixed SQL query

### Diagnostic Scripts (Preserved for Future Use)
- `scripts/check-magic-link.js` - Verify magic link status
- `scripts/check-tables.js` - Verify database schema
- `scripts/test-booking-insertion.js` - Simulate booking submission
- `scripts/create-test-magic-link.js` - Generate test magic links

### Test Files
- `e2e/simple-booking-test.spec.ts` - End-to-end booking test

---

## Rollback Plan

If issues arise, revert with:

```bash
git revert 0821256  # Revert "fix(api): Fix critical SQL error in booking submission"
git push origin main
```

**Note:** Rollback will **break** booking submissions again. Only use if fix causes new issues.

---

## Commit Reference

**Commit:** `0821256`
**Message:** "fix(api): Fix critical SQL error in booking submission"
**Date:** 2025-11-15
**Branch:** main

**Full Diff:**
```diff
-      const positionResult = await client.query(
-        `SELECT COUNT(*) as count FROM bookings
-         WHERE branch_code = $1 AND status IN ('queued', 'in_service')
-         FOR UPDATE`,
-        [branchCode]
-      );
+      await client.query(
+        `SELECT id FROM bookings
+         WHERE branch_code = $1 AND status IN ('queued', 'in_service')
+         FOR UPDATE`,
+        [branchCode]
+      );
+
+      const positionResult = await client.query(
+        `SELECT COUNT(*) as count FROM bookings
+         WHERE branch_code = $1 AND status IN ('queued', 'in_service')`,
+        [branchCode]
+      );
```

---

**Document Created:** 2025-11-15
**Last Updated:** 2025-11-15
**Status:** ✅ RESOLVED AND VERIFIED
**Author:** Claude Code (AI Assistant)
