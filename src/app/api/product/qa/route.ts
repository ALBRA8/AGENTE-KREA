import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runVisualQA } from "@/lib/visual-qa";
import path from "node:path";

// POST /api/product/qa — Run Visual QA on a PDF
//
// Hallazgo 1.2: el cliente enviaba un `artifactPath` del filesystem y el
// servidor hacía `stat`/lectura ANTES de comprobar propiedad — sonda de rutas
// del servidor (se podían leer metadatos QA de cualquier archivo legible).
// AHORA: el artefacto se resuelve SOLO dentro del directorio de almacenamiento
// del servidor (ProductAsset id+userId si existe; nunca una ruta arbitraria).
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, assetId, artifactPath } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: productId (y assetId o artifactPath)" },
        { status: 400 }
      );
    }

    // Propiedad REAL: el dossier del producto debe ser del usuario (404, no 403).
    const dossier = await db.productDossier.findFirst({
      where: { id: productId, userId: user.id },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Resolución del artefacto — NUNCA una ruta libre del cliente.
    const storageRoot = process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR)
      : path.resolve(process.cwd(), "public", "generated");

    let resolvedPath: string | null = null;

    if (assetId) {
      // Canónico: ProductAsset por id + dueño (aislamiento por usuario).
      const asset = await db.productAsset.findFirst({
        where: { OR: [{ id: assetId }, { assetId }], productId, userId: user.id },
      });
      if (!asset) {
        return NextResponse.json({ error: "Asset no encontrado" }, { status: 404 });
      }
      resolvedPath = path.resolve(asset.path);
    } else if (artifactPath) {
      // Compatibilidad controlada: la ruta debe estar DENTRO del storage root.
      const candidate = path.resolve(artifactPath);
      const inside =
        candidate === storageRoot || candidate.startsWith(storageRoot + path.sep);
      if (!inside) {
        return NextResponse.json(
          { error: "artifactPath fuera del directorio de almacenamiento permitido" },
          { status: 400 }
        );
      }
      resolvedPath = candidate;
    } else {
      return NextResponse.json(
        { error: "Se requiere assetId o artifactPath dentro del storage" },
        { status: 400 }
      );
    }

    // Run Visual QA
    const report = await runVisualQA(productId, resolvedPath);

    // El QA NO publica (hallazgo 3.4): publicar es una transición explícita con
    // puertas (readiness + integridad + versión). Aquí solo se marca revisión
    // si el QA falla.
    if (!report.passed) {
      await db.productDossier.update({
        where: { id: dossier.id },
        data: { status: "REVISION" },
      });
    }

    return NextResponse.json({ data: report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error en Visual QA";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
