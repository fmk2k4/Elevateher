export function QuickActions() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-900 mb-4">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {["Invite mentees", "Approve mentors", "Export SDG report", "Review safety alerts"].map((action) => (
          <button key={action} className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-700">
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
