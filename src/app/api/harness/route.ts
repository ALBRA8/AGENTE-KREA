import { NextResponse } from "next/server";
import { kreaHarness, getAgent } from "@/lib/krea-harness";
import { adapterRegistry } from "@/lib/agent-adapter";

/**
 * GET /api/harness — Status del arnés KREA
 * POST /api/harness — Operaciones: mount, swap, health
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
      philosophy: "El agente es intercambiable. El conocimiento queda en KREA.",
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
        // In production, this would load the adapter dynamically
        return NextResponse.json({
          message: `Swap to "${agentName}" requested. Use kreaHarness.swapAgent() programmatically.`,
          currentAgent: adapterRegistry.activeName,
          targetAgent: agentName,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
