import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as fs from "fs/promises";

/**
 * GET /api/product/assets/[assetId]/download
 * Descarga autenticada del binario de un asset (contrato FASE 4.4):
 * - 401 sin sesión válida.
 * - 404 si el asset no existe, es de OTRO usuario o el binario no está en disco.
 * - 200 con bytes idénticos, `Content-Disposition: attachment` y
 *   `x-checksum-sha256` con el checksum registrado.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { assetId } = await params;
    const asset = await db.productAsset.findFirst({
      where: { assetId, userId: user.id, status: "ACTIVE" },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset no encontrado" }, { status: 404 });
    }

    const bytes = await fs.readFile(asset.path);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asset.filename}"`,
        "x-checksum-sha256": asset.checksum,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "ENOENT") {
      // registro vivo pero binario ausente → 404 honesto
      return NextResponse.json({ error: "Archivo del asset no disponible" }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : "Error descargando asset";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
