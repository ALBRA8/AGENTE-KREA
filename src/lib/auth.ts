import { db } from "@/lib/db";
import { SecurityManager } from "@/lib/security";

// Singleton SecurityManager instance for use across all auth routes
export const security = new SecurityManager();

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: string;
}

/**
 * Validate a session token and return the associated user.
 * Uses SecurityManager.validateToken() to look up the Session record,
 * check expiry, and resolve the userId — then fetches the user.
 */
export async function getSessionUser(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { valid, userId } = await security.validateToken(token);
    if (!valid || !userId) return null;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    return { id: user.id, name: user.name, email: user.email, credits: user.credits, plan: user.plan };
  } catch {
    return null;
  }
}

/**
 * Atomically deduct credits.
 *
 * Implementation: a SINGLE conditional UPDATE (`updateMany` with
 * `credits: { gte: amount }` in the WHERE). SQLite serializes writes, so two
 * concurrent calls can never both pass the balance check — the classic
 * read-then-write race is impossible by construction. Returns the new balance,
 * or null if the user doesn't exist or has insufficient credits.
 */
export async function deductCredits(userId: string, amount: number): Promise<number | null> {
  try {
    const result = await db.user.updateMany({
      where: { id: userId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    if (result.count === 0) return null;

    const user = await db.user.findUnique({ where: { id: userId } });
    return user?.credits ?? null;
  } catch {
    return null;
  }
}

/**
 * Refund credits after a failed generation.
 * Uses atomic increment to prevent race conditions.
 */
export async function refundCredits(userId: string, amount: number): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });
  } catch {
    // Silent fail — credit refund is best-effort
  }
}
