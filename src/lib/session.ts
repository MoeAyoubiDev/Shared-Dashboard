import { SignJWT, jwtVerify } from 'jose';

// Edge-safe session helpers (used by middleware AND route handlers).
// Only depends on `jose`, so it runs in the Edge runtime.

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export type UserType = 'trainer' | 'trainee';

export interface SessionPayload {
  userId: number;
  username: string;
  name: string;
  userType: UserType;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    name: payload.name,
    userType: payload.userType,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId !== 'number' ||
      typeof payload.username !== 'string' ||
      typeof payload.name !== 'string' ||
      (payload.userType !== 'trainer' && payload.userType !== 'trainee')
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      name: payload.name,
      userType: payload.userType,
    };
  } catch {
    return null;
  }
}
