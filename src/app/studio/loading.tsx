export default function StudioLoading() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-48 w-full max-w-2xl rounded-lg bg-muted mt-4" />
      </div>
    </div>
  );
}
