import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-xl font-semibold">Página no encontrada</h2>
      <p className="text-muted-foreground text-sm">La página que buscas no existe o fue movida.</p>
      <Link href="/" className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 mt-2">Volver al inicio</Link>
    </div>
  );
}
