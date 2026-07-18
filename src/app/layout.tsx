import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Productor 360 | Tu fábrica de contenido con IA",
  description: "Crea contenido profesional con IA: videos, creativos, ebooks y más, en minutos. Sin experiencia necesaria.",
  keywords: ["IA", "inteligencia artificial", "creación de contenido", "videos", "creativos", "marketing digital"],
  icons: {
    icon: "/productor360-logo.png",
  },
  openGraph: {
    title: "Productor 360 | Tu fábrica de contenido con IA",
    description: "Crea contenido profesional con IA: videos, creativos, ebooks y más, en minutos.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}