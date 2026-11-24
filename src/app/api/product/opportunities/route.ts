import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/opportunities
 * List all opportunities for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const opportunities = await db.productOpportunity.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ opportunities });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error loading opportunities";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/opportunities
 * Create a new product opportunity.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, productType, targetAudience, marketEvidence, problem, description } = body;

    if (!name || !productType) {
      return NextResponse.json({ error: "name and productType are required" }, { status: 400 });
    }

    // Hallazgo 4.1: sin `problem` y `audience`, product-fit rechaza toda
    // evaluación → TODA oportunidad creada por la API puntúa 0/SKIP y nunca
    // hay GO. Ahora son obligatorios (400 si faltan).
    const effectiveProblem = problem || marketEvidence || description;
    if (!effectiveProblem || typeof effectiveProblem !== "string" || effectiveProblem.trim().length < 10) {
      return NextResponse.json(
        { error: "problem es obligatorio (≥10 caracteres): describe el problema que el producto resuelve" },
        { status: 400 }
      );
    }
    if (!targetAudience || typeof targetAudience !== "string" || targetAudience.trim().length < 3) {
      return NextResponse.json(
        { error: "audience es obligatorio: define para quién es el producto" },
        { status: 400 }
      );
    }

    const opportunity = await db.productOpportunity.create({
      data: {
        userId: user.id,
        title: name,
        description: marketEvidence || description || effectiveProblem,
        domain: productType,
        audience: targetAudience.trim(),
        problem: effectiveProblem.trim(),
        status: "EVALUATING",
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creating opportunity";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
