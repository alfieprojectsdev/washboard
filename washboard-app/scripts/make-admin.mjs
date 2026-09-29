#!/usr/bin/env node
// Recovery tool: make an existing account an active admin, e.g. to promote
// the owner's pre-2026 receptionist account, or when the only admin has been
// removed or locked out. Day-to-day staff changes belong on the Staff page.
//
//   DATABASE_URL=postgres://... node scripts/make-admin.mjs MAIN owner_username
//
// If the owner has forgotten their password too, a no-developer alternative
// is to set OWNER_SETUP_CODE in Vercel, create a new admin at /signup, and
// delete the variable again.
import pg from 'pg';

const [branch, username] = process.argv.slice(2);
if (!branch || !username || !process.env.DATABASE_URL) {
  console.error('usage: DATABASE_URL=... node scripts/make-admin.mjs <BRANCH_CODE> <username>');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(
    `UPDATE users SET role = 'admin', disabled_at = NULL
     WHERE branch_code = $1 AND username = $2
     RETURNING name`,
    [branch.toUpperCase(), username.toLowerCase()]
  );
  if (result.rows.length === 0) {
    console.error(`No account @${username} in branch ${branch.toUpperCase()}.`);
    process.exitCode = 1;
  } else {
    console.log(`${result.rows[0].name} (@${username}) is now an active admin of ${branch.toUpperCase()}.`);
  }
} finally {
  await client.end();
}
