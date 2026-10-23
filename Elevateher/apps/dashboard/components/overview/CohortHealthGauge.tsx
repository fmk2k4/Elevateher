export function CohortHealthGauge({ value, label, description }: { value: number; label: string; description: string }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex items-center gap-4">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
        <circle className="text-slate-200" cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="12" fill="none" />
        <circle className="text-violet-600" cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}%</p>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  );
}
