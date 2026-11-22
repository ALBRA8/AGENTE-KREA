/**
 * Image format detection from REAL bytes (magic numbers).
 *
 * Why bytes and not the file extension: AI image providers may return JPEG
 * bytes even when the caller saves them with a `.png` name (observed with
 * flux-krea-v2 during the FASE D E2E run — see INFORME-ESTADO.md §3 / P1).
 * Detecting by extension made pdf-factory call embedPng on JPEG bytes and
 * silently drop the cover ("The input is not a PNG file!").
 */

export type ImageFormat = "jpg" | "png";

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const; // JPEG/JFIF/EXIF SOI + marker
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47] as const; // \x89 P N G

/**
 * Detect the real image format by inspecting magic bytes.
 * Returns null for unknown/unsupported formats.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (
    bytes.length >= JPEG_MAGIC.length &&
    JPEG_MAGIC.every((b, i) => bytes[i] === b)
  ) {
    return "jpg";
  }
  if (
    bytes.length >= PNG_MAGIC.length &&
    PNG_MAGIC.every((b, i) => bytes[i] === b)
  ) {
    return "png";
  }
  return null;
}

/**
 * Preferred file extension for a buffer of image bytes, so saved files are
 * named after their real format. Defaults to ".png" when unknown.
 */
export function imageExtensionFor(bytes: Uint8Array): string {
  const fmt = detectImageFormat(bytes);
  return fmt === "jpg" ? ".jpg" : ".png";
}
