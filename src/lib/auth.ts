import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  verifyToken,
  type SessionPayload,
} from './session';

// Node-runtime auth helpers (password hashing + reading the current session).
// Keep bcrypt / next/headers out of session.ts so middleware stays Edge-safe.

const BCRYPT_ROUNDS = 12;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Read and verify the current session from the request cookies. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Throw 401 if not logged in. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError(401, 'Unauthorized');
  return session;
}

/** Throw 401 if not logged in, 403 if not a trainer (manager). */
export async function requireTrainer(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.userType !== 'trainer') throw new HttpError(403, 'Forbidden');
  return session;
}
