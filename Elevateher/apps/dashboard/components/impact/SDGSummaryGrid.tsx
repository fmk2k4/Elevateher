export function SDGSummaryGrid({ stats }: { stats: { sdg4_events: number; sdg5_events: number; sdg8_events: number } }) {
  const cards = [
    { goal: "4.4", label: "Quality Education", count: stats.sdg4_events, color: "bg-blue-50 text-blue-700" },
    { goal: "5.5", label: "Gender Equality", count: stats.sdg5_events, color: "bg-pink-50 text-pink-700" },
    { goal: "8.6", label: "Decent Work", count: stats.sdg8_events, color: "bg-emerald-50 text-emerald-700" },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.goal} className="rounded-2xl border border-slate-200 p-5 bg-white">
          <p className={`inline-block text-xs font-bold px-2 py-1 rounded-full ${card.color}`}>SDG {card.goal}</p>
          <p className="text-3xl font-bold text-slate-900 mt-4">{card.count}</p>
          <p className="text-sm text-slate-500 mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
