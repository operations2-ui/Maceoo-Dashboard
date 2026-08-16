// Next.js shows this immediately on navigation, before the target page's
// data has finished loading — without it there's no feedback at all while
// a report page's DB queries are in flight, which reads as the click
// having done nothing.
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[60vh]">
      <div className="h-10 w-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-500 animate-spin" />
      <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Loading…</p>
    </div>
  );
}
