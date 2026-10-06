"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{
          minHeight: "100vh",
          background: "#080c16",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
        }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Error en Krea</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1rem", maxWidth: "400px", textAlign: "center", fontSize: "0.875rem" }}>
            {error.message || "Ha ocurrido un error inesperado"}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "0.75rem",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.875rem",
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
