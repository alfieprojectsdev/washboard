// Account field rules shared by signup, password reset and password change.
// They mirror the CHECK constraints on the users table.

export const USERNAME_RULE = /^[a-zA-Z0-9_-]{3,50}$/;
const EMAIL_RULE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters long';
  }
  // bcrypt only uses the first 72 bytes; anything past 200 characters is a mistake.
  if (password.length > 200) return 'Password must be at most 200 characters';
  return null;
}

export function usernameProblem(username: unknown): string | null {
  return typeof username === 'string' && USERNAME_RULE.test(username)
    ? null
    : 'Username must be 3-50 characters (letters, numbers, underscore, hyphen only)';
}

export function emailProblem(email: unknown): string | null {
  if (email === undefined || email === null || email === '') return null;
  return typeof email === 'string' && email.length <= 255 && EMAIL_RULE.test(email) ? null : 'Invalid email format';
}

export function nameProblem(name: unknown): string | null {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100
    ? null
    : 'Name is required (at most 100 characters)';
}
