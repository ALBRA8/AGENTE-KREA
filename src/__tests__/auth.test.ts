/**
 * Auth Tests — KREA V2 Authentication System
 *
 * Tests the session-based authentication:
 *   - createSession creates a valid session token in DB
 *   - getSessionUser with valid token returns the user
 *   - getSessionUser with expired token returns null
 *   - getSessionUser with invalid token returns null
 *   - destroySession removes the session
 *   - Password hashing: hashPassword produces different hash each time; verifyPassword works
 *
 * These are documentation tests — syntactically valid TypeScript that
 * can be verified by reading. To run with a test runner, wrap in describe/it.
 */

import { createSession, getSessionUser, destroySession, deductCredits, refundCredits, cleanupExpiredSessions } from "@/lib/auth";
import { SecurityManager } from "@/lib/security";
import { db } from "@/lib/db";

// ─── Test Helpers ────────────────────────────────────────────────────────

const security = new SecurityManager();

/** Assert a condition throws if false — used as documentation of expectations */
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

// ─── Test: createSession creates a valid session token in DB ─────────────

async function test_createSession_createsValidToken(): Promise<void> {
  // Setup: create a test user in DB
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: `test-auth-${Date.now()}@example.com`,
      passwordHash: security.hashPassword("password123"),
      credits: 100,
      plan: "starter",
    },
  });

  // Act: create a session
  const token = await createSession(user.id);

  // Assert: token is a non-empty string
  assert(typeof token === "string", "Token must be a string");
  assert(token.length > 0, "Token must not be empty");
  assert(token.startsWith("krea_"), "Token must start with 'krea_' prefix");

  // Assert: session exists in DB
  const session = await db.session.findUnique({ where: { token } });
  assert(session !== null, "Session must exist in DB");
  assert(session!.userId === user.id, "Session must belong to the user");
  assert(session!.expiresAt > new Date(), "Session must not be expired");

  // Cleanup
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
}

// ─── Test: getSessionUser with valid token returns the user ──────────────

async function test_getSessionUser_validToken_returnsUser(): Promise<void> {
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: `test-valid-${Date.now()}@example.com`,
      passwordHash: security.hashPassword("password123"),
      credits: 100,
      plan: "pro",
    },
  });

  const token = await createSession(user.id);
  const sessionUser = await getSessionUser(token);

  assert(sessionUser !== null, "Must return user for valid token");
  assert(sessionUser!.id === user.id, "User ID must match");
  assert(sessionUser!.name === user.name, "User name must match");
  assert(sessionUser!.email === user.email, "User email must match");
  assert(sessionUser!.credits === user.credits, "User credits must match");
  assert(sessionUser!.plan === user.plan, "User plan must match");

  // Cleanup
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
}

// ─── Test: getSessionUser with expired token returns null ────────────────

async function test_getSessionUser_expiredToken_returnsNull(): Promise<void> {
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: `test-expired-${Date.now()}@example.com`,
      passwordHash: security.hashPassword("password123"),
      credits: 100,
      plan: "starter",
    },
  });

  // Create session with 0 days expiry (already expired)
  const token = await createSession(user.id, 0);
  const sessionUser = await getSessionUser(token);

  assert(sessionUser === null, "Must return null for expired token");

  // Cleanup
  await db.user.delete({ where: { id: user.id } });
}

// ─── Test: getSessionUser with invalid token returns null ────────────────

async function test_getSessionUser_invalidToken_returnsNull(): Promise<void> {
  const sessionUser = await getSessionUser("krea_invalid_nonexistent_token_12345");

  assert(sessionUser === null, "Must return null for invalid/nonexistent token");
}

// ─── Test: destroySession removes the session ────────────────────────────

async function test_destroySession_removesSession(): Promise<void> {
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: `test-destroy-${Date.now()}@example.com`,
      passwordHash: security.hashPassword("password123"),
      credits: 100,
      plan: "starter",
    },
  });

  const token = await createSession(user.id);

  // Verify session exists
  const beforeDestroy = await getSessionUser(token);
  assert(beforeDestroy !== null, "Session must exist before destruction");

  // Destroy the session
  await destroySession(token);

  // Verify session no longer works
  const afterDestroy = await getSessionUser(token);
  assert(afterDestroy === null, "Session must return null after destruction");

  // Cleanup
  await db.user.delete({ where: { id: user.id } });
}

// ─── Test: hashPassword produces different hash each time ────────────────

function test_hashPassword_differentHashEachTime(): void {
  const password = "mySecretPassword123";
  const hash1 = security.hashPassword(password);
  const hash2 = security.hashPassword(password);

  assert(hash1 !== hash2, "Same password must produce different hashes (different salts)");
  assert(hash1.startsWith("$pbkdf2$"), "Hash must use pbkdf2 format");
  assert(hash2.startsWith("$pbkdf2$"), "Hash must use pbkdf2 format");
}

// ─── Test: verifyPassword works correctly ────────────────────────────────

function test_verifyPassword_correctAndIncorrect(): void {
  const password = "correctPassword!";
  const wrongPassword = "wrongPassword!";
  const hash = security.hashPassword(password);

  // Correct password must verify
  assert(security.verifyPassword(password, hash) === true, "Correct password must verify");

  // Wrong password must not verify
  assert(security.verifyPassword(wrongPassword, hash) === false, "Wrong password must not verify");

  // Empty password must not verify against non-empty hash
  assert(security.verifyPassword("", hash) === false, "Empty password must not verify");
}

// ─── Test: deductCredits atomically reduces credits ──────────────────────

async function test_deductCredits_reducesCredits(): Promise<void> {
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: `test-deduct-${Date.now()}@example.com`,
      passwordHash: security.hashPassword("password123"),
      credits: 100,
      plan: "starter",
    },
  });

  const remaining = await deductCredits(user.id, 30);
  assert(remaining === 70, `Remaining credits must be 70, got ${remaining}`);

  // Cannot deduct more than available
  const overDeduct = await deductCredits(user.id, 200);
  assert(overDeduct === null, "Must return null when deducting more than available");

  // Cleanup
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
}

// ─── Test: refundCredits adds credits back ───────────────────────────────

async function test_refundCredits_addsCreditsBack(): Promise<void> {
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: `test-refund-${Date.now()}@example.com`,
      passwordHash: security.hashPassword("password123"),
      credits: 50,
      plan: "starter",
    },
  });

  await refundCredits(user.id, 25);

  const updated = await db.user.findUnique({ where: { id: user.id } });
  assert(updated!.credits === 75, `Credits must be 75 after refund, got ${updated!.credits}`);

  // Cleanup
  await db.user.delete({ where: { id: user.id } });
}

// ─── Test: cleanupExpiredSessions removes stale sessions ─────────────────

async function test_cleanupExpiredSessions_removesStale(): Promise<void> {
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: `test-cleanup-${Date.now()}@example.com`,
      passwordHash: security.hashPassword("password123"),
      credits: 100,
      plan: "starter",
    },
  });

  // Create an already-expired session
  await createSession(user.id, 0);

  const removed = await cleanupExpiredSessions();
  assert(removed >= 1, "Must remove at least 1 expired session");

  // Cleanup
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
}

// ─── Export all tests for documentation ──────────────────────────────────

export const authTests = {
  test_createSession_createsValidToken,
  test_getSessionUser_validToken_returnsUser,
  test_getSessionUser_expiredToken_returnsNull,
  test_getSessionUser_invalidToken_returnsNull,
  test_destroySession_removesSession,
  test_hashPassword_differentHashEachTime,
  test_verifyPassword_correctAndIncorrect,
  test_deductCredits_reducesCredits,
  test_refundCredits_addsCreditsBack,
  test_cleanupExpiredSessions_removesStale,
};

/**
 * Summary of auth test coverage:
 *
 * ✅ createSession creates a valid session token in DB
 * ✅ getSessionUser with valid token returns the user
 * ✅ getSessionUser with expired token returns null
 * ✅ getSessionUser with invalid token returns null
 * ✅ destroySession removes the session
 * ✅ hashPassword produces different hash each time (unique salt)
 * ✅ verifyPassword works correctly (accepts correct, rejects wrong)
 * ✅ deductCredits atomically reduces credits
 * ✅ refundCredits adds credits back
 * ✅ cleanupExpiredSessions removes stale sessions
 */
