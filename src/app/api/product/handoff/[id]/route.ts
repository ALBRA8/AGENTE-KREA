import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  CREATED: { ready: "READY" },
  READY: { send: "SENT" },
  SENT: { acknowledge: "ACKNOWLEDGED" },
  ACKNOWLEDGED: { complete: "COMPLETED" },
};

/**
 * POST /api/product/handoff/[id]
 * Perform an action on a handoff (ready, send, acknowledge, complete).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const handoff = await db.handoff.findUnique({
      where: { id },
      include: { dossier: { select: { userId: true } } },
    });

    if (!handoff || handoff.dossier.userId !== user.id) {
      return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const transitions = VALID_TRANSITIONS[handoff.status];
    if (!transitions || !transitions[action]) {
      return NextResponse.json(
        { error: `Invalid action "${action}" for status "${handoff.status}"` },
        { status: 400 }
      );
    }

    // Hallazgo 3.1: `send` sin proveedor real NO llega a SENT. Sin proveedor
    // registrado para targetProvider: la fila queda READY con error + evidencia
    // NOT_VERIFIED y la respuesta es 409 (R4: nunca simular "enviado").
    if (action === "send") {
      const { getHandoffProvider } = await import("@/lib/product-handoff");
      const provider = getHandoffProvider(handoff.targetProvider);
      if (!provider) {
        const evidence = JSON.parse(handoff.evidence || "{}");
        evidence.externalSend = "NOT_VERIFIED";
        evidence.providerAvailability = "NOT_VERIFIED";
        evidence.sendError = `Proveedor '${handoff.targetProvider}' no registrado — el handoff queda READY`;
        evidence.sendAttemptedAt = new Date().toISOString();
        const kept = await db.handoff.update({
          where: { id },
          data: { status: "READY", evidence: JSON.stringify(evidence) },
        });
        return NextResponse.json(
          { error: `Sin proveedor de envío para '${handoff.targetProvider}' — queda READY, NO se simula envío`, refunded: undefined, handoff: kept },
          { status: 409 }
        );
      }
      // Proveedor registrado → envío real con evidencia persistida.
      const available = await provider.isAvailable();
      if (!available) {
        const evidence = JSON.parse(handoff.evidence || "{}");
        evidence.externalSend = "FAILED";
        evidence.providerAvailability = "NOT_VERIFIED";
        evidence.sendError = `Proveedor '${handoff.targetProvider}' no disponible`;
        evidence.sendAttemptedAt = new Date().toISOString();
        const kept = await db.handoff.update({
          where: { id },
          data: { status: "READY", evidence: JSON.stringify(evidence) },
        });
        return NextResponse.json(
          { error: `Proveedor '${handoff.targetProvider}' no disponible — queda READY`, handoff: kept },
          { status: 502 }
        );
      }
      const sendResult = await provider.send({
        id: handoff.id,
        status: "READY",
        targetProvider: handoff.targetProvider,
        objective: handoff.objective,
        productId: handoff.productId,
        productVersion: handoff.productVersion,
        specification: handoff.specification ? JSON.parse(handoff.specification) : undefined,
        constraints: handoff.constraints ? JSON.parse(handoff.constraints) : undefined,
        acceptanceCriteria: handoff.acceptanceCriteria ? JSON.parse(handoff.acceptanceCriteria) : undefined,
        evidence: {},
        autonomy: handoff.autonomy as "SUPERVISED",
        approvals: [],
        dependencies: handoff.dependencies ? JSON.parse(handoff.dependencies) : [],
        risk: handoff.risk ? JSON.parse(handoff.risk) : [],
        createdAt: handoff.createdAt,
        updatedAt: handoff.updatedAt,
      } as never);
      if (!sendResult.success) {
        const evidence = JSON.parse(handoff.evidence || "{}");
        evidence.externalSend = "FAILED";
        evidence.sendError = sendResult.error || "envío falló en el proveedor";
        evidence.sendAttemptedAt = new Date().toISOString();
        const kept = await db.handoff.update({
          where: { id },
          data: { status: "READY", evidence: JSON.stringify(evidence) },
        });
        return NextResponse.json(
          { error: sendResult.error || "El proveedor rechazó el envío — queda READY", handoff: kept },
          { status: 502 }
        );
      }
      const evidence = JSON.parse(handoff.evidence || "{}");
      evidence.externalSend = "SENT_OK";
      evidence.providerRef = sendResult.providerRef ?? null;
      evidence.sentAt = new Date().toISOString();
      const updated = await db.handoff.update({
        where: { id },
        data: { status: "SENT", evidence: JSON.stringify(evidence) },
      });
      return NextResponse.json(updated);
    }

    const updated = await db.handoff.update({
      where: { id },
      data: { status: transitions[action] },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error updating handoff";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
