'use client';

import { useEffect, useState } from 'react';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import { apiFetch, DashboardApiError } from '@/src/lib/api-client';

interface MenteeRow {
  id: string;
  display_name: string;
  sdg_track: string;
  career_goals: string;
  preferred_languages: string;
  onboarding_complete: boolean;
  created_at: string;
  match_status: string | null;
  sessions_completed: number;
}

export default function MenteesPage() {
  const { subdomain, error: institutionError } = useInstitution();
  const [mentees, setMentees] = useState<MenteeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch(`/dashboard/${subdomain}/mentees`)
      .then((data) => {
        if (!isMounted) return;
        setMentees(data.mentees || []);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        if (err instanceof DashboardApiError) {
          setError(err.message);
          return;
        }
        setError(err.message || 'Unable to load mentees');
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

  if (error && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#FCA5A5' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Unable to load mentees</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{error}</p>
        {institutionError ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
            Institution setup note: {institutionError}
          </p>
        ) : null}
        <button
          onClick={() => setReloadKey((value) => value + 1)}
          style={{
            marginTop: 16,
            padding: '8px 20px',
            background: '#EC4899',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.5)' }}>
        Loading mentees...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
          Mentee Cohort
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>
          All mentees in your institution
        </p>
      </div>

      {mentees.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            color: 'rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          No mentees yet. They will appear here once they register.
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {['Name', 'Track', 'Languages', 'Status', 'Sessions', 'Joined'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {mentees.map((m) => (
                <tr
                  key={m.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#fff' }}>
                    {m.display_name}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.7)' }}>
                    {m.sdg_track}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)' }}>
                    {m.preferred_languages || 'en'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: m.onboarding_complete
                          ? 'rgba(34,197,94,0.12)'
                          : 'rgba(251,191,36,0.12)',
                        color: m.onboarding_complete ? '#22C55E' : '#FBBF24',
                      }}
                    >
                      {m.onboarding_complete ? 'Active' : 'Incomplete'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.6)' }}>
                    {m.sessions_completed ?? 0}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: 12,
                    }}
                  >
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
