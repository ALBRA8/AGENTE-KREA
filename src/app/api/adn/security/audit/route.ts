import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { SecurityManager } from "@/lib/security";
import { db } from "@/lib/db";

const securityManager = new SecurityManager();

/**
 * GET /api/adn/security/audit
 * Get audit log (auth required).
 * Query params: userId, action, limit
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    const action = searchParams.get("action") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action };

    const auditEvents = await db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Also get security summary
    const permissionRules = securityManager.getPermissionRules();
    const toolAccessRules = securityManager.getToolAccessRules();

    return NextResponse.json({
      auditEvents,
      total: auditEvents.length,
      security: {
        permissionRulesCount: permissionRules.length,
        toolAccessRulesCount: toolAccessRules.length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error retrieving audit log";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
