import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/handoff
 * Generate a Handoff Contract for a constructor agent.
 * Body: dossierId, targetAgent
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { dossierId, targetAgent } = body;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }
    if (dossier.userId && dossier.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!dossier.specification) {
      return NextResponse.json(
        { error: "Dossier must be specified before handoff" },
        { status: 400 }
      );
    }

    const target = targetAgent || (dossier.decision ? JSON.parse(dossier.decision!).constructor : "codex");

    // ─── Handoff Contract Generator ───────────────────────────────────────
    // Create an executable handoff contract for the target constructor.

    const specification = JSON.parse(dossier.specification);
    const architecture = dossier.architecture ? JSON.parse(dossier.architecture) : null;
    const decision = dossier.decision ? JSON.parse(dossier.decision) : null;

    const handoffContract = {
      // Contract identity
      contractId: `handoff-${dossier.id}-${Date.now()}`,
      contractVersion: "1.0.0",
      type: "product_handoff",

      // Parties
      from: {
        agentId: "KREA",
        role: "product_architect",
      },
      to: {
        agentId: target,
        role: "constructor",
      },

      // What is being handed off
      product: {
        id: dossier.id,
        title: dossier.title,
        description: dossier.description,
        domain: dossier.domain,
        format: dossier.format,
        priority: dossier.priority,
      },

      // Executable specification
      specification,

      // Architecture (for reference)
      architecture,

      // Decision context
      decision,

      // Success criteria
      successCriteria: {
        qualityGates: specification.acceptance?.qualityGates || [],
        requiredOutputs: [],
        maxRetries: 3,
      },

      // Communication
      protocol: "contract",
      callbackOn: ["completion", "error", "qa_result"],

      // Metadata
      createdAt: new Date().toISOString(),
      createdBy: "krea",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    // Update dossier with handoff contract
    const existingHandoffs = dossier.handoffs ? JSON.parse(dossier.handoffs) : [];
    const updatedHandoffs = [...existingHandoffs, handoffContract];

    await db.productDossier.update({
      where: { id: dossierId },
      data: {
        handoffs: JSON.stringify(updatedHandoffs),
        status: "BUILDING",
      },
    });

    return NextResponse.json({ handoffContract, dossierId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generating handoff";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
