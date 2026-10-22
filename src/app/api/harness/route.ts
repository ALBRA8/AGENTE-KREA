import { NextResponse } from "next/server";
import { kreaHarness, getAgent } from "@/lib/krea-harness";
import { adapterRegistry } from "@/lib/agent-adapter";
import { bridgeRegistry } from "@/lib/bridges/types";
import { skillRegistry } from "@/lib/harness/types";
import { knowledgeRegistry } from "@/lib/harness/knowledge-registry";

/**
 * GET /api/harness — Status del arnés KREA
 * POST /api/harness — Operaciones: mount, swap, health, list-adapters, list-skills, list-bridges, list-knowledge
 */
export async function GET() {
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

export async function POST(request: Request) {
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
        const result = await kreaHarness.executeSkill(skillId, skillOperation, skillParams);
        return NextResponse.json({ result });
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
