import { NextRequest, NextResponse } from "next/server";
import { kreaHarness, getAgent } from "@/lib/krea-harness";
import { adapterRegistry } from "@/lib/agent-adapter";
import { bridgeRegistry } from "@/lib/bridges/types";
import { skillRegistry } from "@/lib/harness/types";
import { knowledgeRegistry } from "@/lib/harness/knowledge-registry";
import { chargeForCapability, refundCharge, type Capability, type ChargeResult, type ChargeError } from "@/lib/credit-service";
import { requireSession } from "@/lib/require-session";

/**
 * Operaciones de skill que cobran créditos. Las operaciones puras en TS
 * (recommend-format, build-index) no cobran.
 */
const SKILL_COSTS: Record<string, Capability> = {
  "validate-demand": "infoproductos:validate-demand",
  "review-infoproduct": "infoproductos:review-infoproduct",
  "review-style": "infoproductos:review-style",
  "generate-cover": "infoproductos:generate-cover",
  "generate-sales-page": "infoproductos:generate-sales-page",
  "assemble-infoproduct": "infoproductos:assemble-infoproduct",
};

/**
 * GET /api/harness — Status del arnés KREA (REQUIERE sesión — hallazgo 1.1)
 * POST /api/harness — Operaciones: mount, swap, health, list-adapters, list-skills, list-bridges, list-knowledge
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  try {
    const status = kreaHarness.status();
    const health = await kreaHarness.healthCheck();

    return NextResponse.json({
      krea: "ARNÉS — Product Factory Harness",
      version: "2.1",
      ...status,
      health,
    });
  } catch (error) {
    return NextResponse.json({
      krea: "ARNÉS",
      status: "error",
      error: String(error),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Hallazgo 1.1: sesión real antes de CUALQUIER operación (mount/swap son
  // mutantes y list-* expone la configuración interna del arnés).
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await request.json();
    const { operation } = body;

    switch (operation) {
      case "health": {
        const health = await kreaHarness.healthCheck();
        return NextResponse.json({ health });
      }

      case "list-adapters": {
        const adapters = adapterRegistry.list();
        return NextResponse.json({ adapters });
      }

      case "swap": {
        const { agentName } = body;
        return NextResponse.json({
          message: `Swap to "${agentName}" requested. Use kreaHarness.swapAgent() programmatically.`,
          currentAgent: adapterRegistry.activeName,
          targetAgent: agentName,
        });
      }

      case "list-bridges": {
        const bridges = bridgeRegistry.list();
        return NextResponse.json({ bridges });
      }

      case "list-skills": {
        const skills = skillRegistry.list();
        return NextResponse.json({ skills });
      }

      case "list-knowledge": {
        const knowledge = knowledgeRegistry.list();
        const stats = knowledgeRegistry.stats();
        return NextResponse.json({ knowledge, stats });
      }

      case "knowledge-health": {
        const health = await knowledgeRegistry.healthCheckAll();
        return NextResponse.json({ knowledgeHealth: health });
      }

      case "execute-skill": {
        const { skillId, skillOperation, skillParams } = body;

        // Validación de sesión real + cobro por operación con costo
        const capability = SKILL_COSTS[skillOperation];
        if (capability) {
          charge = await chargeForCapability(
            request.headers.get("authorization")?.replace("Bearer ", "") ?? "",
            capability
          );
          if (!charge.ok) {
            return NextResponse.json({ error: charge.error }, { status: charge.status });
          }
        }

        try {
          const result = await kreaHarness.executeSkill(skillId, skillOperation, skillParams);
          return NextResponse.json({ result, credits: charge?.ok ? charge.creditsLeft : undefined });
        } catch (e: unknown) {
          if (charge?.ok && capability) await refundCharge(charge.userId, capability);
          throw e;
        }
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
