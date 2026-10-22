"use client";
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
      <h2 className="text-xl font-semibold text-destructive">Error en Dashboard</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center">{error.message || "Algo salió mal"}</p>
      <button onClick={reset} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Reintentar</button>
    </div>
  );
}
