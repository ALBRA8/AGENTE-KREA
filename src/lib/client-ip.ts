import { NextRequest } from "next/server";

/**
 * Resolve the client IP for rate limiting / audit logs.
 *
 * SECURITY: x-forwarded-for is spoofable by clients. It is only trusted when
 * TRUST_PROXY=true — i.e. the app runs behind a proxy we control that overwrites
 * (not appends to) the header. In that case we take the FIRST entry, which is
 * the client as seen by OUR trusted proxy.
 *
 * Without TRUST_PROXY, the header is ignored: all direct clients share the
 * "direct" bucket (a global per-endpoint limit — stricter but not bypassable).
 * Pair TRUST_PROXY=true with the account id for user-scoped limits where
 * applicable.
 */
export function getClientIp(req: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (trustProxy) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return req.headers.get("x-real-ip") ?? "unknown";
  }
  return "direct";
}
