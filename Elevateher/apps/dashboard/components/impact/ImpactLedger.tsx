"use client";

import { useEffect, useState } from "react";

interface ImpactEvent {
  time: string;
  mentee: string;
  event: string;
  sdg: string;
  track: string;
}

export function ImpactLedger() {
  const [events, setEvents] = useState<ImpactEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    // Use relative URL to proxy through Next.js API route
    // This ensures Docker networking works correctly
    const institutionId = "demo";
    let eventSource: EventSource | null = null;

    try {
      // Use the dashboard's proxy route which handles Docker networking
      eventSource = new EventSource(`/api/dashboard/impact/stream/${institutionId}`);
      setIsStreaming(true);

      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setEvents((current) => [data, ...current.slice(0, 9)]);
      };

      eventSource.onerror = () => {
        setIsStreaming(false);
        eventSource?.close();
      };
    } catch {
      setIsStreaming(false);
    }

    return () => {
      eventSource?.close();
    };
  }, []);

  const displayEvents = events.length > 0 ? events : [
    { time: "—", mentee: "No active sessions", event: "Demo mode", sdg: "—", track: "—" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Live Impact Ledger</h2>
        <span className={`text-xs px-2 py-1 rounded-full ${isStreaming ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {isStreaming ? "Streaming" : "Demo Mode"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-3">Time</th>
              <th className="pb-3">Mentee</th>
              <th className="pb-3">Event</th>
              <th className="pb-3">SDG</th>
              <th className="pb-3">Track</th>
            </tr>
          </thead>
          <tbody>
            {displayEvents.map((event, index) => (
              <tr key={`${event.time}-${index}`} className="border-t border-slate-100">
                <td className="py-3 text-slate-500">{event.time}</td>
                <td className="py-3 font-medium text-slate-900">{event.mentee}</td>
                <td className="py-3 text-slate-700">{event.event}</td>
                <td className="py-3"><span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 text-xs">{event.sdg}</span></td>
                <td className="py-3 text-slate-700">{event.track}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
