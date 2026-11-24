import { NextRequest } from "next/server";

/**
 * Resolve the client IP for rate limiting / audit logs.
 *
 * SECURITY (hallazgo 1.4):
 *  - x-forwarded-for es falsificable por el cliente. Solo se confía cuando
 *    TRUST_PROXY=true (la app corre detrás de un proxy nuestro). En ese caso
 *    se toma el ÚLTIMO salto: el que AÑADIÓ nuestro proxy (los saltos previos
 *    los controla el cliente). Antes se tomaba el PRIMERO → un cliente podía
 *    inventar su IP y saltarse los límites.
 *  - Sin TRUST_PROXY, el header se ignora: todos los clientes directos
 *    comparten el bucket "direct" (global por endpoint — más estricto pero no
 *    eludible).
 *  - El mapa de buckets vive en SecurityManager.rateLimit con tope + limpieza.
 */
export function getClientIp(req: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (trustProxy) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      const hops = forwarded
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean);
      if (hops.length > 0) {
        return hops[hops.length - 1]; // último salto = añadido por NUESTRO proxy
      }
    }
    return req.headers.get("x-real-ip") ?? "unknown";
  }
  return "direct";
}
