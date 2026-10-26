export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="h-24 w-full rounded-lg bg-muted" />
          <div className="h-24 w-full rounded-lg bg-muted" />
          <div className="h-24 w-full rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
