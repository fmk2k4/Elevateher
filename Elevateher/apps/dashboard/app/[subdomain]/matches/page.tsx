'use client';

import { useEffect, useState } from 'react';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import { apiFetch, DashboardApiError } from '@/src/lib/api-client';

interface MatchSummary {
  match_id: string;
  status: string;
  sdg_track: string;
  match_score: number;
  match_reason: string;
  mentee_name: string;
  mentor_name: string;
  mentor_job_title: string;
  sessions_completed: number;
  started_at: string;
}

export default function MatchesPage() {
  const { subdomain, error: institutionError } = useInstitution();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch(`/dashboard/${subdomain}/matches`)
      .then((data) => {
        if (!isMounted) return;
        setMatches(data.matches || []);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        if (err instanceof DashboardApiError) {
          setError(err.message);
          return;
        }
        setError(err.message || 'Unable to load matches');
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

  const statusColor = (s: string) => {
    switch (s) {
      case 'active':
        return { bg: 'rgba(34,197,94,0.12)', text: '#22C55E' };
      case 'completed':
        return { bg: 'rgba(59,130,246,0.12)', text: '#3B82F6' };
      case 'pending':
        return { bg: 'rgba(251,191,36,0.12)', text: '#FBBF24' };
      default:
        return { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)' };
    }
  };

  if (error && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#FCA5A5' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Unable to load matches</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{error}</p>
        {institutionError ? <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>Institution setup note: {institutionError}</p> : null}
        <button onClick={() => setReloadKey((value) => value + 1)} style={{ marginTop: 16, padding: '8px 20px', background: '#EC4899', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.5)' }}>Loading matches...</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Active Matches</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>Mentor-mentee pairings and progress</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Matches: {matches.length}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Institution: {subdomain}</span>
        </div>
      </div>

      {matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
          No active matches yet. Matches will appear here once mentees are paired with mentors.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {matches.map((m) => {
            const colors = statusColor(m.status);
            return (
              <div key={m.match_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: colors.bg, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.status}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Track: {m.sdg_track}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#A78BFA' }}>{Math.round(m.match_score * 100)}% match</span>
                </div>

                <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Mentee</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{m.mentee_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Mentor</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{m.mentor_name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{m.mentor_job_title}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: 6 }}>{m.match_reason}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{m.sessions_completed} sessions completed · Started {new Date(m.started_at).toLocaleDateString()}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
