export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
    </div>
  );
}
