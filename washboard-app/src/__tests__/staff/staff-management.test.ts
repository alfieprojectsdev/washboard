import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import db from '@/lib/db';
import { createSession, getUserBySessionId, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { clearRateLimitStore } from '@/lib/auth/rate-limit';
import { hashToken } from '@/lib/auth/account-tokens';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as tokenCheck } from '@/app/api/auth/token-check/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import { POST as changePassword } from '@/app/api/auth/change-password/route';
import { GET as listStaff } from '@/app/api/staff/route';
import { POST as createInvite } from '@/app/api/staff/invites/route';
import { DELETE as revokeInvite } from '@/app/api/staff/invites/[id]/route';
import { PATCH as updateStaff } from '@/app/api/staff/[userId]/route';
import { POST as createResetLink } from '@/app/api/staff/[userId]/reset-link/route';

const PASSWORD = 'correct horse battery staple';
let ip = 0;

function req(url: string, body?: unknown, { method = 'POST', session }: { method?: string; session?: string } = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `192.0.2.${++ip % 250}`,
      ...(session ? { cookie: `${SESSION_COOKIE_NAME}=${session}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

async function makeUser(branch: string, username: string, role: 'admin' | 'receptionist') {
  const result = await db.query(
    `INSERT INTO users (branch_code, username, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
    [branch, username, await bcrypt.hash(PASSWORD, 4), username.toUpperCase(), role]
  );
  const userId = result.rows[0].user_id;
  const session = await createSession({ userId, branchCode: branch, username, name: username, email: null, role });
  return { userId, session };
}

const tokenFrom = (url: string, key: string) => new URLSearchParams(new URL(url).hash.slice(1)).get(key)!;

let owner: { userId: number; session: string };
let staffer: { userId: number; session: string };

beforeEach(async () => {
  await clearRateLimitStore();
  await db.query('DELETE FROM account_tokens');
  await db.query('DELETE FROM sessions');
  await db.query('DELETE FROM feedback');
  await db.query('DELETE FROM bookings');
  await db.query('DELETE FROM customer_magic_links');
  await db.query('UPDATE shop_status SET updated_by = NULL');
  await db.query('DELETE FROM users');
  await db.query(`INSERT INTO branches (branch_code, branch_name) VALUES ('OTHER', 'Other Branch') ON CONFLICT DO NOTHING`);
  owner = await makeUser('MAIN', 'owner', 'admin');
  staffer = await makeUser('MAIN', 'rico', 'receptionist');
});

describe('invite links', () => {
  it('let a new receptionist join the admin’s branch once, then stop working', async () => {
    const created = await createInvite(req('/api/staff/invites', { note: 'Jen, weekends' }, { session: owner.session }));
    expect(created.status).toBe(201);
    const { invite } = await created.json();
    expect(invite.url).toMatch(/\/signup#invite=[A-Za-z0-9_-]{43}$/);
    expect(invite.qrCode).toMatch(/^data:image\/png;base64,/);

    const token = tokenFrom(invite.url, 'invite');
    const stored = await db.query('SELECT token_hash FROM account_tokens');
    expect(stored.rows[0].token_hash).toBe(hashToken(token)); // only the hash is kept

    const check = await (await tokenCheck(req('/api/auth/token-check', { kind: 'invite', token }))).json();
    expect(check).toMatchObject({ valid: true, branchName: 'Main Branch', role: 'receptionist', note: 'Jen, weekends' });

    const joined = await signup(req('/api/auth/signup', { invite_token: token, username: 'jen', name: 'Jen', password: PASSWORD }));
    expect(joined.status).toBe(201);
    expect((await joined.json()).user).toMatchObject({ branchCode: 'MAIN', role: 'receptionist', username: 'jen' });
    expect(joined.headers.get('set-cookie')).toContain(SESSION_COOKIE_NAME);

    const again = await signup(req('/api/auth/signup', { invite_token: token, username: 'jen2', name: 'Jen', password: PASSWORD }));
    expect(again.status).toBe(403);
    expect((await (await tokenCheck(req('/api/auth/token-check', { kind: 'invite', token }))).json()).valid).toBe(false);
  });

  it('can make admins, and are ignored once revoked or expired', async () => {
    const { invite } = await (await createInvite(req('/api/staff/invites', { role: 'admin' }, { session: owner.session }))).json();
    const adminJoin = await signup(
      req('/api/auth/signup', { invite_token: tokenFrom(invite.url, 'invite'), username: 'coowner', name: 'Co', password: PASSWORD })
    );
    expect((await adminJoin.json()).user.role).toBe('admin');

    const revoked = await (await createInvite(req('/api/staff/invites', {}, { session: owner.session }))).json();
    expect((await revokeInvite(req('/x', undefined, { method: 'DELETE', session: owner.session }), params({ id: String(revoked.invite.id) }))).status).toBe(200);
    const afterRevoke = await signup(
      req('/api/auth/signup', { invite_token: tokenFrom(revoked.invite.url, 'invite'), username: 'late', name: 'L', password: PASSWORD })
    );
    expect(afterRevoke.status).toBe(403);

    const expiring = await (await createInvite(req('/api/staff/invites', {}, { session: owner.session }))).json();
    await db.query(`UPDATE account_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [expiring.invite.id]);
    const afterExpiry = await signup(
      req('/api/auth/signup', { invite_token: tokenFrom(expiring.invite.url, 'invite'), username: 'late2', name: 'L', password: PASSWORD })
    );
    expect(afterExpiry.status).toBe(403);
  });

  it('stay unused when the chosen username is taken, so the person can try another', async () => {
    const { invite } = await (await createInvite(req('/api/staff/invites', {}, { session: owner.session }))).json();
    const token = tokenFrom(invite.url, 'invite');
    const clash = await signup(req('/api/auth/signup', { invite_token: token, username: 'rico', name: 'R', password: PASSWORD }));
    expect(clash.status).toBe(409);
    const retry = await signup(req('/api/auth/signup', { invite_token: token, username: 'rico2', name: 'R', password: PASSWORD }));
    expect(retry.status).toBe(201);
  });
});

describe('who can manage staff', () => {
  it('refuses receptionists and anonymous visitors', async () => {
    expect((await listStaff(req('/api/staff', undefined, { method: 'GET' }))).status).toBe(401);
    expect((await listStaff(req('/api/staff', undefined, { method: 'GET', session: staffer.session }))).status).toBe(403);
    expect((await createInvite(req('/api/staff/invites', {}, { session: staffer.session }))).status).toBe(403);
    expect((await createResetLink(req('/x', undefined, { session: staffer.session }), params({ userId: String(owner.userId) }))).status).toBe(403);
    expect((await updateStaff(req('/x', { role: 'admin' }, { method: 'PATCH', session: staffer.session }), params({ userId: String(staffer.userId) }))).status).toBe(403);
  });

  it('keeps each admin to their own branch', async () => {
    const outsider = await makeUser('OTHER', 'outsider', 'receptionist');
    const list = await (await listStaff(req('/api/staff', undefined, { method: 'GET', session: owner.session }))).json();
    expect(list.staff.map((s: { username: string }) => s.username).sort()).toEqual(['owner', 'rico']);

    const target = params({ userId: String(outsider.userId) });
    expect((await createResetLink(req('/x', undefined, { session: owner.session }), target)).status).toBe(404);
    expect((await updateStaff(req('/x', { active: false }, { method: 'PATCH', session: owner.session }), target)).status).toBe(404);
  });
});

describe('reset links', () => {
  it('let the person choose a new password and sign out everywhere else', async () => {
    const created = await createResetLink(req('/x', undefined, { session: owner.session }), params({ userId: String(staffer.userId) }));
    const { resetLink } = await created.json();
    expect(resetLink.url).toMatch(/\/reset-password#token=/);
    const token = tokenFrom(resetLink.url, 'token');

    const check = await (await tokenCheck(req('/api/auth/token-check', { kind: 'reset', token }))).json();
    expect(check).toMatchObject({ valid: true, username: 'rico' });

    expect((await resetPassword(req('/api/auth/reset-password', { token, password: 'short' }))).status).toBe(400);
    const done = await resetPassword(req('/api/auth/reset-password', { token, password: 'a brand new password' }));
    expect(done.status).toBe(200);
    expect(await getUserBySessionId(staffer.session)).toBeNull(); // old session ended

    const oldLogin = await login(req('/api/auth/login', { branch_code: 'MAIN', username: 'rico', password: PASSWORD }));
    expect(oldLogin.status).toBe(401);
    const newLogin = await login(req('/api/auth/login', { branch_code: 'MAIN', username: 'rico', password: 'a brand new password' }));
    expect(newLogin.status).toBe(200);

    expect((await resetPassword(req('/api/auth/reset-password', { token, password: 'yet another password' }))).status).toBe(403);
  });

  it('replace any earlier link for the same person', async () => {
    const first = await (await createResetLink(req('/x', undefined, { session: owner.session }), params({ userId: String(staffer.userId) }))).json();
    await createResetLink(req('/x', undefined, { session: owner.session }), params({ userId: String(staffer.userId) }));
    const stale = await resetPassword(req('/api/auth/reset-password', { token: tokenFrom(first.resetLink.url, 'token'), password: 'a brand new password' }));
    expect(stale.status).toBe(403);
  });
});

describe('removing access', () => {
  it('signs the person out at once, blocks login, and can be undone', async () => {
    const removed = await updateStaff(
      req('/x', { active: false }, { method: 'PATCH', session: owner.session }),
      params({ userId: String(staffer.userId) })
    );
    expect(removed.status).toBe(200);
    expect(await getUserBySessionId(staffer.session)).toBeNull();
    const blocked = await login(req('/api/auth/login', { branch_code: 'MAIN', username: 'rico', password: PASSWORD }));
    expect(blocked.status).toBe(401);
    expect((await createResetLink(req('/x', undefined, { session: owner.session }), params({ userId: String(staffer.userId) }))).status).toBe(404);

    await updateStaff(req('/x', { active: true }, { method: 'PATCH', session: owner.session }), params({ userId: String(staffer.userId) }));
    const back = await login(req('/api/auth/login', { branch_code: 'MAIN', username: 'rico', password: PASSWORD }));
    expect(back.status).toBe(200);
  });

  it("won't let an admin change their own role or access", async () => {
    for (const change of [{ role: 'receptionist' }, { active: false }]) {
      const self = await updateStaff(req('/x', change, { method: 'PATCH', session: owner.session }), params({ userId: String(owner.userId) }));
      expect(self.status).toBe(400);
      expect((await self.json()).code).toBe('SELF_CHANGE');
    }
  });

  it('never leaves the branch without an active admin, even when two admins act at once', async () => {
    const second = await makeUser('MAIN', 'second', 'admin');
    const [a, b] = await Promise.all([
      updateStaff(req('/x', { active: false }, { method: 'PATCH', session: owner.session }), params({ userId: String(second.userId) })),
      updateStaff(req('/x', { active: false }, { method: 'PATCH', session: second.session }), params({ userId: String(owner.userId) })),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 403]);
    const admins = await db.query(`SELECT COUNT(*) AS n FROM users WHERE branch_code = 'MAIN' AND role = 'admin' AND disabled_at IS NULL`);
    expect(Number(admins.rows[0].n)).toBe(1);
  });

  it('lets an admin promote and demote other staff', async () => {
    const promote = await updateStaff(req('/x', { role: 'admin' }, { method: 'PATCH', session: owner.session }), params({ userId: String(staffer.userId) }));
    expect((await promote.json()).user.role).toBe('admin');
    const demote = await updateStaff(req('/x', { role: 'receptionist' }, { method: 'PATCH', session: owner.session }), params({ userId: String(staffer.userId) }));
    expect((await demote.json()).user.role).toBe('receptionist');
  });
});

describe('changing your own password', () => {
  it('needs the current password and signs out your other devices', async () => {
    const otherDevice = await createSession({ userId: staffer.userId, branchCode: 'MAIN', username: 'rico', name: 'R', email: null, role: 'receptionist' });

    const wrong = await changePassword(req('/api/auth/change-password', { currentPassword: 'nope', newPassword: 'a brand new password' }, { session: staffer.session }));
    expect(wrong.status).toBe(400);

    const ok = await changePassword(req('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'a brand new password' }, { session: staffer.session }));
    expect(ok.status).toBe(200);
    expect(await getUserBySessionId(staffer.session)).not.toBeNull();
    expect(await getUserBySessionId(otherDevice)).toBeNull();

    const relogin = await login(req('/api/auth/login', { branch_code: 'MAIN', username: 'rico', password: 'a brand new password' }));
    expect(relogin.status).toBe(200);
    expect((await changePassword(req('/api/auth/change-password', { currentPassword: 'x', newPassword: 'y' }))).status).toBe(401);
  });
});

describe('signup without a link', () => {
  it('is closed to everyone when OWNER_SETUP_CODE is unset', async () => {
    const saved = process.env.OWNER_SETUP_CODE;
    delete process.env.OWNER_SETUP_CODE;
    try {
      const response = await signup(req('/api/auth/signup', { branch_code: 'MAIN', username: 'walkin', name: 'W', password: PASSWORD }));
      expect(response.status).toBe(403);
    } finally {
      process.env.OWNER_SETUP_CODE = saved;
    }
  });
});
