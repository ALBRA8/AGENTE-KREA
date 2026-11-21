import { describe, it, expect, afterAll } from "vitest";
import { security, getSessionUser, deductCredits, refundCredits } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Auth unit tests — current API of src/lib/auth.ts:
 *   security (SecurityManager singleton), getSessionUser,
 *   deductCredits, refundCredits.
 *
 * Uses ephemeral test users (unique emails, deleted afterwards).
 * Never touches existing user rows.
 */

const TEST_EMAIL = `test-auth-${Date.now()}@krea-test.local`;
const TEST_EMAIL_2 = `test-auth2-${Date.now()}@krea-test.local`;
let testUserId: string | null = null;
let testUser2Id: string | null = null;

afterAll(async () => {
  // Cleanup ephemeral test users (cascade deletes sessions/generations)
  if (testUserId) await db.user.deleteMany({ where: { id: testUserId } });
  if (testUser2Id) await db.user.deleteMany({ where: { id: testUser2Id } });
});

describe("SecurityManager password hashing", () => {
  it("hash + verify roundtrip works", () => {
    const hash = security.hashPassword("s3cret-pass-123");
    expect(hash).not.toBe("s3cret-pass-123");
    expect(security.verifyPassword("s3cret-pass-123", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = security.hashPassword("s3cret-pass-123");
    expect(security.verifyPassword("wrong-pass", hash)).toBe(false);
  });

  it("accepts legacy plaintext hashes (migration path)", () => {
    expect(security.verifyPassword("demo123", "demo123")).toBe(true);
  });
});

describe("getSessionUser", () => {
  it("returns null for empty token", async () => {
    expect(await getSessionUser("")).toBeNull();
  });

  it("returns null for a garbage token", async () => {
    expect(await getSessionUser("no-such-token-12345")).toBeNull();
  });

  it("returns the user for a valid session token", async () => {
    const user = await db.user.create({
      data: {
        name: "Auth Test",
        email: TEST_EMAIL,
        password: security.hashPassword("test-pass"),
        credits: 50,
      },
    });
    testUserId = user.id;

    const token = await security.generateToken(user.id);
    const sessionUser = await getSessionUser(token);

    expect(sessionUser).not.toBeNull();
    expect(sessionUser!.id).toBe(user.id);
    expect(sessionUser!.email).toBe(TEST_EMAIL);
    expect(sessionUser!.credits).toBe(50);
  });
});

describe("deductCredits", () => {
  it("deducts when balance is sufficient", async () => {
    const user = await db.user.create({
      data: {
        name: "Credits Test",
        email: TEST_EMAIL_2,
        password: security.hashPassword("test-pass"),
        credits: 10,
      },
    });
    testUser2Id = user.id;

    const balance = await deductCredits(user.id, 4);
    expect(balance).toBe(6);

    const after = await db.user.findUnique({ where: { id: user.id } });
    expect(after!.credits).toBe(6);
  });

  it("returns null (and does not deduct) when balance is insufficient", async () => {
    const user = await db.user.findUnique({ where: { id: testUser2Id! } });
    const before = user!.credits;

    const result = await deductCredits(testUser2Id!, before + 100);
    expect(result).toBeNull();

    const after = await db.user.findUnique({ where: { id: testUser2Id! } });
    expect(after!.credits).toBe(before);
  });

  it("returns null for a non-existent user", async () => {
    expect(await deductCredits("no-such-user-id", 1)).toBeNull();
  });
});

describe("refundCredits", () => {
  it("increments the balance back", async () => {
    const user = await db.user.findUnique({ where: { id: testUser2Id! } });
    const before = user!.credits;

    await refundCredits(testUser2Id!, 3);

    const after = await db.user.findUnique({ where: { id: testUser2Id! } });
    expect(after!.credits).toBe(before + 3);
  });
});
