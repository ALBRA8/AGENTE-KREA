import { describe, it, expect, afterAll } from "vitest";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Data isolation tests — user A's data must be invisible to user B.
 *
 * Tests the DB-level access pattern used by API routes:
 * every read/write filters by BOTH the record id AND the owner userId,
 * so user B cannot read, modify or delete user A's records.
 *
 * Uses ephemeral test users (unique emails, deleted afterwards).
 * Never touches existing user rows.
 */

const EMAIL_A = `test-iso-a-${Date.now()}@krea-test.local`;
const EMAIL_B = `test-iso-b-${Date.now()}@krea-test.local`;
let userAId: string | null = null;
let userBId: string | null = null;

afterAll(async () => {
  if (userAId) await db.user.deleteMany({ where: { id: userAId } });
  if (userBId) await db.user.deleteMany({ where: { id: userBId } });
});

async function createTestUser(email: string) {
  return db.user.create({
    data: {
      name: `Isolation ${email.slice(0, 12)}`,
      email,
      password: security.hashPassword("test-pass"),
      credits: 20,
    },
  });
}

describe("Generation isolation", () => {
  it("user B cannot read user A's generation via owner-filtered query", async () => {
    const userA = await createTestUser(EMAIL_A);
    const userB = await createTestUser(EMAIL_B);
    userAId = userA.id;
    userBId = userB.id;

    const gen = await db.generation.create({
      data: {
        userId: userA.id,
        type: "text",
        title: "Gen de A",
        prompt: "test prompt",
        result: "test result",
        credits: 1,
      },
    });

    // Owner sees it
    const own = await db.generation.findFirst({ where: { id: gen.id, userId: userA.id } });
    expect(own).not.toBeNull();

    // Other user does NOT see it (route pattern: findFirst({ id, userId }))
    const intruder = await db.generation.findFirst({ where: { id: gen.id, userId: userB.id } });
    expect(intruder).toBeNull();
  });
});

describe("Session isolation", () => {
  it("user B's token does not resolve to user A", async () => {
    const userA = await db.user.findUnique({ where: { id: userAId! } });
    const userB = await db.user.findUnique({ where: { id: userBId! } });

    const tokenA = await security.generateToken(userA!.id);

    const resolved = await security.validateToken(tokenA);
    expect(resolved.valid).toBe(true);
    expect(resolved.userId).toBe(userA!.id);
    expect(resolved.userId).not.toBe(userB!.id);
  });

  it("a fabricated token resolves to nobody", async () => {
    const resolved = await security.validateToken("fabricated-token-xyz");
    expect(resolved.valid).toBe(false);
    expect(resolved.userId).toBeUndefined();
  });
});

describe("Cross-user list scoping", () => {
  it("list filtered by userId only returns own records", async () => {
    const userA = await db.user.findUnique({ where: { id: userAId! } });
    const userB = await db.user.findUnique({ where: { id: userBId! } });

    await db.generation.create({
      data: { userId: userB!.id, type: "text", title: "Gen de B", prompt: "p", result: "r", credits: 1 },
    });

    const aList = await db.generation.findMany({ where: { userId: userA!.id } });
    const bList = await db.generation.findMany({ where: { userId: userB!.id } });

    expect(aList.every((g) => g.userId === userA!.id)).toBe(true);
    expect(bList.every((g) => g.userId === userB!.id)).toBe(true);
    expect(aList.some((g) => g.title === "Gen de B")).toBe(false);
  });
});
