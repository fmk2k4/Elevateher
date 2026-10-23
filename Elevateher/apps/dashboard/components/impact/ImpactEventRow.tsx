export function ImpactEventRow({ event }: { event: { time: string; mentee: string; action: string; sdg: string } }) {
  return (
    <div className="grid grid-cols-4 gap-4 py-3 border-b border-slate-100 text-sm">
      <span className="text-slate-500">{event.time}</span>
      <span className="font-medium text-slate-900">{event.mentee}</span>
      <span className="text-slate-700">{event.action}</span>
      <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 text-xs w-fit">{event.sdg}</span>
    </div>
  );
}
