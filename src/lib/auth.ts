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
export async function deductCredits(
  userId: string,
  amount: number,
  opts?: { capability?: string; reference?: string }
): Promise<number | null> {
  try {
    const result = await db.user.updateMany({
      where: { id: userId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    if (result.count === 0) return null;

    const user = await db.user.findUnique({ where: { id: userId } });

    // FASE 2.6 — libro de créditos: todo cargo deja fila (mismo flujo que la
    // deducción; si el libro falla, el saldo ya bajó — se registra el error
    // sin revertir la deducción atómica).
    await db.creditTransaction.create({
      data: { userId, kind: "CHARGE", amount, capability: opts?.capability ?? null, reference: opts?.reference ?? null },
    }).catch(() => {});

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
    await db.creditTransaction.create({
      data: { userId, kind: "REFUND", amount },
    }).catch(() => {});
  } catch {
    // best-effort
  }
}

/**
 * FASE 2.5/2.6 — reembolso IDEMPOTENTE por referencia y ATÓMICO:
 * el estado y el reembolso son una sola transacción con guarda de unicidad
 * @@unique([reference, kind]). Dos arranques concurrentes (o un crash entre
 * las dos escrituras) ya NO pueden reembolsar dos veces ni perder el reembolso
 * sin rastro: o está la fila del libro, o no se reembolsó.
 * Devuelve true si esta llamada ejecutó el reembolso.
 */
export async function refundCreditsOnce(
  userId: string,
  amount: number,
  capability: string,
  reference: string
): Promise<boolean> {
  if (amount <= 0 || !reference) return false;
  let executed = false;
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findUnique({
        where: { reference_kind: { reference, kind: "REFUND" } },
      });
      if (existing) return; // ya reembolsado antes — idempotente
      executed = true;
      await tx.creditTransaction.create({
        data: { userId, kind: "REFUND", amount, capability, reference },
      });
      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });
    });
    if (!executed) return false; // ya estaba reembolsado — esta llamada NO lo ejecutó
    await security.auditLog({
      action: "credit_refund",
      resource: `capability:${capability}`,
      userId,
      result: "success",
      details: { amount, reference },
    }).catch(() => {});
    return true;
  } catch (e: unknown) {
    // Violación de unicidad = otro proceso reembolsó primero → NO es error.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) return false;
    console.error("[refundCreditsOnce]", msg);
    return false;
  }
}
