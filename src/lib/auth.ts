import { db } from "@/lib/db";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: string;
}

/**
 * Get authenticated user from session token.
 *
 * AUTH STRATEGY:
 * - On login/register, a Session record is created in DB with a unique token (cuid)
 * - The token is sent as Bearer <token> in Authorization header
 * - This function looks up the Session by token, verifies it hasn't expired,
 *   then returns the associated User
 * - Tokens are opaque — clients cannot derive userId from token
 * - Sessions expire after 30 days by default
 */
export async function getSessionUser(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session) return null;
    if (new Date() > session.expiresAt) {
      // Session expired — clean up
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    const user = session.user;
    return { id: user.id, name: user.name, email: user.email, credits: user.credits, plan: user.plan };
  } catch {
    return null;
  }
}

/**
 * Create a new session for a user. Returns the session token.
 */
export async function createSession(userId: string, expiresInDays: number = 30): Promise<string> {
  const token = `krea_${userId.slice(0,4)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await db.session.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

/**
 * Destroy a session (logout).
 */
export async function destroySession(token: string): Promise<void> {
  try {
    await db.session.delete({ where: { token } });
  } catch {}
}

/**
 * Clean up expired sessions (can be called periodically).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Atomically deduct credits.
 */
export async function deductCredits(userId: string, amount: number): Promise<number | null> {
  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.credits < amount) return null;
      const updated = await tx.user.update({
        where: { id: userId },
        data: { credits: user.credits - amount },
      });
      return updated.credits;
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Refund credits after a failed generation.
 */
export async function refundCredits(userId: string, amount: number): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });
  } catch {}
}
