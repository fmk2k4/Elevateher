'use client';

import { useEffect, useState } from 'react';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import Link from 'next/link';
import { apiFetch, DashboardApiError } from '@/src/lib/api-client';

interface Stats {
  total_mentees: number;
  total_mentors: number;
  active_matches: number;
  pending_matches: number;
  completed_programmes: number;
  sdg4_events: number;
  sdg5_events: number;
  sdg8_events: number;
  offline_sessions: number;
  web_sessions: number;
  avg_mentee_satisfaction: number;
  last_activity: string;
  mentees?: unknown[];
}

interface RuntimeStatus {
  matching_mode: string;
  safety_mode: string;
  agent_mode: string;
}
const STATS_CONFIG = [
  { key: 'total_mentees', label: 'Active Mentees', icon: '👩‍🎓', color: '#A78BFA' },
  { key: 'total_mentors', label: 'Verified Mentors', icon: '👩‍💼', color: '#EC4899' },
  { key: 'active_matches', label: 'Active Matches', icon: '🤝', color: '#22C55E' },
  { key: 'pending_matches', label: 'Pending Matches', icon: '⏳', color: '#FBBF24' },
  { key: 'completed_programmes', label: 'Programmes Completed', icon: '🏆', color: '#F59E0B' },
  { key: 'sdg4_events', label: 'SDG 4.4 Events', icon: '📚', color: '#3B82F6' },
  { key: 'sdg5_events', label: 'SDG 5.5 Events', icon: '⚖️', color: '#E11D48' },
  { key: 'sdg8_events', label: 'SDG 8.6 Events', icon: '💼', color: '#10B981' },
  { key: 'offline_sessions', label: 'Offline Sessions', icon: '📱', color: '#8B5CF6' },
];

export default function OverviewPage() {
  const { subdomain, error: institutionError } = useInstitution();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  useEffect(() => {
    if (!subdomain) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch(`/dashboard/${subdomain}/stats`),
      apiFetch<{ runtime: RuntimeStatus }>(`/status`),
    ])
      .then(([payload, status]) => {
        if (!isMounted) return;
        setStats(payload);
        setRuntimeStatus(status.runtime);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        if (err instanceof DashboardApiError) {
          setError(err.message);
          return;
        }
        setError(err.message || 'Unable to load dashboard data');
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [subdomain, reloadKey]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.5)' }}>
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#FCA5A5' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Unable to load dashboard</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{error}</p>
        {institutionError ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
            Institution setup note: {institutionError}
          </p>
        ) : null}
        <button
          onClick={() => { setStats(null); setReloadKey((value) => value + 1); }}
          style={{
             marginTop: 16, padding: '8px 20px', background: '#EC4899',
             color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const totalSessions = (stats?.offline_sessions || 0) + (stats?.web_sessions || 0);
  const offlinePct = totalSessions
    ? Math.round(((stats?.offline_sessions ?? 0) / totalSessions) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 4px',
          }}
        >
          Cohort Overview
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>
            Matching: {runtimeStatus?.matching_mode ?? 'unknown'}
          </span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>
            Safety: {runtimeStatus?.safety_mode ?? 'unknown'}
          </span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>
            Agent: {runtimeStatus?.agent_mode ?? 'unknown'}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {STATS_CONFIG.map(({ key, label, icon, color }) => (
          <div
            key={key}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '20px',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {stats?.[key as keyof Stats]?.toLocaleString() ?? '—'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              margin: '0 0 12px',
            }}
          >
            Digital Inclusion
          </h3>
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            {offlinePct}%
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 12,
            }}
          >
            of sessions delivered via SMS/USSD
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${offlinePct}%`,
                borderRadius: 4,
                background: 'linear-gradient(90deg, #7C3AED, #EC4899)',
                transition: 'width 0.5s',
              }}
            />
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.35)',
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {stats?.offline_sessions || 0} offline sessions via SMS/USSD — reaching girls
            with zero smartphone or internet access.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              margin: '0 0 12px',
            }}
          >
            SDG Impact Summary
          </h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#3B82F6' }}>
                {stats?.sdg4_events || 0}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                SDG 4.4 — Skills
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#E11D48' }}>
                {stats?.sdg5_events || 0}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                SDG 5.5 — Gender Equity
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>
                {stats?.sdg8_events || 0}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                SDG 8.6 — Career Entry
              </div>
            </div>
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.35)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Impact events recorded across all three SDG goals. Export detailed reports
            for grant submission.
          </p>
        </div>
      </div>

      <QuickActions subdomain={subdomain} />
    </div>
  );
}

function QuickActions({ subdomain }: { subdomain: string }) {
  const actions = [
    {
      href: `/${subdomain}/reports`,
      icon: '📄',
      label: 'Export SDG Report',
      desc: 'Generate PDF impact report for grant submission',
    },
    {
      href: `/${subdomain}/analytics`,
      icon: '📊',
      label: 'View Analytics',
      desc: 'Session frequency, track completion, trends',
    },
    {
      href: `/${subdomain}/mentees`,
      icon: '👩‍🎓',
      label: 'Manage Mentees',
      desc: 'Cohort overview, progress tracking',
    },
  ];

  return (
    <div>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Quick Actions
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            style={{
              display: 'block',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10,
              padding: '16px',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 8 }}>{a.icon}</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 4,
              }}
            >
              {a.label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.5,
              }}
            >
              {a.desc}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
