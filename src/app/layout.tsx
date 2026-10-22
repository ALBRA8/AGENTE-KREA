import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Krea | Tu fábrica de contenido con IA",
  description: "Crea contenido profesional con IA: videos, creativos, ebooks y más, en minutos. Sin experiencia necesaria.",
  keywords: ["IA", "inteligencia artificial", "creación de contenido", "videos", "creativos", "marketing digital", "Krea"],
  icons: {
    icon: "/krea-logo.png",
  },
  openGraph: {
    title: "Krea | Tu fábrica de contenido con IA",
    description: "Crea contenido profesional con IA: videos, creativos, ebooks y más, en minutos.",
    type: "website",
  },
};

/**
 * Bootstrap KREA harness on server-side render.
 * Pone el chaleco al agente al arrancar la app.
 * Es lazy — solo se ejecuta una vez.
 */
let _bootstrapPromise: Promise<void> | null = null;
function bootstrapOnServer() {
  if (!_bootstrapPromise) {
    _bootstrapPromise = import("@/lib/bootstrap").then(async ({ bootstrapKrea }) => {
      const result = await bootstrapKrea();
      if (result.status !== "READY") {
        console.warn(`[Layout] KREA bootstrapped in ${result.status} mode — knowledge: ${result.knowledge} modules`);
      }
    }).catch((err) => {
      console.warn("[Layout] KREA bootstrap failed (non-fatal):", err);
    });
  }
  return _bootstrapPromise;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inicializar KREA al renderizar el layout (server-side)
  if (typeof window === "undefined") {
    bootstrapOnServer();
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
