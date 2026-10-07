import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { KreaMCPServer } from "@/lib/mcp-server";
import { KreaMCPClient } from "@/lib/mcp-client";

const mcpServer = new KreaMCPServer();
const mcpClient = new KreaMCPClient();

/**
 * GET /api/adn/mcp
 * List MCP tools — what KREA offers (server) and what it consumes (client).
 * No auth required for discovery.
 */
export async function GET() {
  try {
    const serverTools = mcpServer.listTools();
    const serverStatus = mcpServer.getStatus();
    const serverHealth = mcpServer.healthCheck();
    const clientAgents = mcpClient.listAvailableAgents();
    const ecosystemSummary = mcpClient.getEcosystemSummary();

    return NextResponse.json({
      server: {
        status: serverStatus,
        health: serverHealth,
        tools: serverTools,
        toolsCount: serverTools.length,
      },
      client: {
        ecosystemSummary,
        agents: clientAgents,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing MCP tools";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/adn/mcp
 * Execute an MCP tool (auth required + credits).
 * Body: tool, params
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { tool, params } = body;

    if (!tool) {
      return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
    }

    // Check if this is a server tool (KREA offers) or a client tool (KREA consumes)
    const serverTool = mcpServer.getTool(tool);

    if (serverTool) {
      // Execute via MCP server (KREA's own tool)
      if (serverTool.creditCost > 0) {
        const ok = await deductCredits(user.id, serverTool.creditCost);
        if (!ok) {
          return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
        }
      }

      const result = await mcpServer.handleToolCall(tool, params || {});
      return NextResponse.json(result);
    }

    // Try as a client tool (calling another agent)
    // Parse agent ID and tool name from format "agentId:toolName" or just "toolName"
    const result = await mcpClient.requestTool(
      params?.agentId || "unknown",
      tool,
      params || {}
    );

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error executing MCP tool";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
