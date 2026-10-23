'use client';

import { useEffect, useState } from 'react';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import { apiFetch } from '@/src/lib/api-client';

interface ImpactEvent {
  id: string;
  event_type: string;
  sdg_goal: string;
  sdg_track: string;
  recorded_at: string;
  // Phase 6 provenance
  source?: 'web' | 'ussd' | 'moderator' | 'auto-inferred' | 'mentor-confirmed';
  evidence_type?: string;
  confidence?: 'high' | 'medium' | 'low';
  reviewer_status?: 'pending' | 'verified' | 'flagged';
  connectivity_class?: 'online' | 'low_connectivity' | 'offline';
}

interface ImpactReport {
  sdg_impact?: Record<string, { events?: number }>;
}

interface RuntimeStatus {
  matching_mode: string;
  safety_mode: string;
  agent_mode: string;
}

const SDG_COLORS: Record<string, string> = {
  '4.4': '#3B82F6',
  '5.5': '#E11D48',
  '8.6': '#10B981',
};

const SDG_LABELS: Record<string, string> = {
  '4.4': 'Quality Education',
  '5.5': 'Gender Equality',
  '8.6': 'Decent Work',
};

const IMPACT_STREAM_PROXY = '/api/dashboard/impact/stream';

function sortEventsNewestFirst(events: ImpactEvent[]) {
  return [...events].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );
}

function mergeEvents(existing: ImpactEvent[], incoming: ImpactEvent[]) {
  const byId = new Map(existing.map((event) => [event.id, event]));
  for (const event of incoming) {
    byId.set(event.id, event);
  }
  return sortEventsNewestFirst(Array.from(byId.values())).slice(0, 20);
}

function mapReportCounts(report?: ImpactReport) {
  const counters = {
    '4.4': 0,
    '5.5': 0,
    '8.6': 0,
  } as Record<string, number>;

  if (!report?.sdg_impact) {
    return counters;
  }

  for (const [key, value] of Object.entries(report.sdg_impact)) {
    const goal = key.includes('SDG_4')
      ? '4.4'
      : key.includes('SDG_5')
        ? '5.5'
        : key.includes('SDG_8')
          ? '8.6'
          : null;
    if (goal) {
      counters[goal] = value?.events ?? 0;
    }
  }

  return counters;
}

export default function ImpactLedgerPage() {
  const { subdomain } = useInstitution();
  const [events, setEvents] = useState<ImpactEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    '4.4': 0,
    '5.5': 0,
    '8.6': 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    const loadReport = async () => {
      try {
        const data = await apiFetch<ImpactReport>(
          `/impact/report/${subdomain}?period_start=1970-01-01&period_end=2099-12-31`,
        );
        if (!cancelled) {
          setCounts(mapReportCounts(data));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const loadRuntimeStatus = async () => {
      try {
        const data = await apiFetch<{ runtime: RuntimeStatus }>('/status');
        if (!cancelled) {
          setRuntimeStatus(data.runtime);
        }
      } catch {
        if (!cancelled) {
          setRuntimeStatus(null);
        }
      }
    };

    const connectStream = () => {
      source = new EventSource(
        `${IMPACT_STREAM_PROXY}/${encodeURIComponent(subdomain)}`,
      );

      source.onopen = () => {
        if (!cancelled) {
          setStreamConnected(true);
          setError(null);
          setStreamError(null);
        }
      };

      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as ImpactEvent;
          if (!payload?.id) {
            return;
          }

          if (!cancelled) {
            setEvents((current) => mergeEvents(current, [payload]));
            setStreamError(null);
          }
        } catch {
          if (!cancelled) {
            setStreamError('Some impact events could not be parsed. Data may be incomplete.');
          }
        }
      };

      source.onerror = () => {
        if (!cancelled) {
          setStreamConnected(false);
        }
      };
    };

    void loadReport();
    void loadRuntimeStatus();
    connectStream();

    const id = setInterval(() => {
      void loadReport();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(id);
      source?.close();
    };
  }, [subdomain]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.5)' }}>
        Loading impact ledger...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#FCA5A5' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Unable to load impact ledger</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{error}</p>
      </div>
    );
  }

  return (

    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 4px',
          }}
        >
          Live Impact Ledger
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: streamConnected ? '#22C55E' : '#F59E0B',
              display: 'inline-block',
              animation: streamConnected ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 13, color: streamConnected ? '#22C55E' : '#F59E0B', fontWeight: 500 }}>
            {streamConnected ? 'Live stream connected' : 'Report mode — aggregate data, SSE reconnecting'}
          </span>
        </div>
        {streamError && (
          <div style={{
            marginTop: 12,
            padding: '8px 14px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 6,
            fontSize: 12,
            color: '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            ⚠️ {streamError}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 10,
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)' }}>
            Matching: {runtimeStatus?.matching_mode ?? 'unknown'}
          </span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)' }}>
            Safety: {runtimeStatus?.safety_mode ?? 'unknown'}
          </span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)' }}>
            Agent: {runtimeStatus?.agent_mode ?? 'unknown'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {['4.4', '5.5', '8.6'].map((goal) => (
            <div
              key={goal}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: '16px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: SDG_COLORS[goal] || '#fff',
                }}
              >
                {counts[goal] ?? 0}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.45)',
                  marginTop: 2,
                }}
              >
                {SDG_LABELS[goal]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          Recent Events
        </div>

        {events.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 14,
            }}
          >
            Waiting for impact events...
          </div>
        ) : (
          <div>
            {events.map((event, i) => (
              <div
                key={event.id || i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '12px 20px',
                  borderBottom: i < events.length - 1
                    ? '1px solid rgba(255,255,255,0.04)'
                    : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: `${SDG_COLORS[event.sdg_goal] || '#666'}20`,
                      color: SDG_COLORS[event.sdg_goal] || '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {event.sdg_goal}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                      {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.35)',
                        marginTop: 2,
                      }}
                    >
                      {event.sdg_track} track ·{' '}
                      {new Date(event.recorded_at).toLocaleString()}
                    </div>
                  </div>
                  {event.reviewer_status && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background:
                          event.reviewer_status === 'verified'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : event.reviewer_status === 'flagged'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                        color:
                          event.reviewer_status === 'verified'
                            ? '#10B981'
                            : event.reviewer_status === 'flagged'
                              ? '#EF4444'
                              : '#F59E0B',
                      }}
                    >
                      {event.reviewer_status}
                    </span>
                  )}
                </div>
                {/* Provenance row — Phase 6 event traceability */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {event.source && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {event.source}
                    </span>
                  )}
                  {event.connectivity_class && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background:
                          event.connectivity_class === 'offline'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : event.connectivity_class === 'low_connectivity'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(255,255,255,0.04)',
                        color:
                          event.connectivity_class === 'offline'
                            ? '#60A5FA'
                            : event.connectivity_class === 'low_connectivity'
                              ? '#F59E0B'
                              : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {event.connectivity_class === 'offline'
                        ? '📱 USSD/SMS'
                        : event.connectivity_class === 'low_connectivity'
                          ? '📡 low-connectivity'
                          : '💻 online'}
                    </span>
                  )}
                  {event.confidence && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.04)',
                        color:
                          event.confidence === 'high'
                            ? 'rgba(16, 185, 129, 0.7)'
                            : event.confidence === 'medium'
                              ? 'rgba(245, 158, 11, 0.7)'
                              : 'rgba(239, 68, 68, 0.7)',
                      }}
                    >
                      {event.confidence} confidence
                    </span>
                  )}
                  {event.evidence_type && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {event.evidence_type}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
