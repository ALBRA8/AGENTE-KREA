import { db } from "@/lib/db";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: string;
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const user = await db.user.findUnique({ where: { id: token } });
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, credits: user.credits, plan: user.plan };
  } catch {
    return null;
  }
}

export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.credits < amount) return false;
  await db.user.update({ where: { id: userId }, data: { credits: user.credits - amount } });
  return true;
}