'use client';

import { useEffect, useState } from 'react';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import { apiFetch, DashboardApiError } from '@/src/lib/api-client';

interface MentorRow {
  id: string;
  user_id: string;
  full_name: string;
  job_title: string;
  industry: string;
  years_exp: number;
  languages: string;
  bio_safety_score: number;
  is_approved: boolean;
  verification_status: string;
  current_mentees: number;
  max_mentees: number;
  total_mentees_served: number;
}

export default function MentorsPage() {
  const { subdomain, error: institutionError } = useInstitution();
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPending, setShowPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (userId: string, action: 'approve' | 'reject') => {
    setActionLoading(userId);
    try {
      const endpoint = `/dashboard/admin/mentors/${userId}/${action}`;
      const payload = action === 'reject' ? { reason: 'Does not meet requirements' } : {};
      
      await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setReloadKey(k => k + 1);
    } catch (err: any) {
      alert(`Failed to ${action} mentor: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch(`/dashboard/institutions/${subdomain}/mentors?status=${showPending ? 'pending_admin_review' : 'approved'}`)
      .then((data) => {
        if (!isMounted) return;
        setMentors(data.mentors || []);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        if (err instanceof DashboardApiError) {
          setError(err.message);
          return;
        }
        setError(err.message || 'Unable to load mentors');
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [subdomain, showPending, reloadKey]);

  if (error && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#FCA5A5' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Unable to load mentors</p>
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
        Loading mentors...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
            Mentor Management
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>
            Verify profiles and track mentor performance
          </p>
        </div>
        <button
          onClick={() => setShowPending(!showPending)}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: showPending
              ? 'rgba(251,191,36,0.15)'
              : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: showPending ? '#FBBF24' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
          }}
        >
          {showPending ? 'Show Approved' : 'Show Pending'}
        </button>
      </div>

      {mentors.length === 0 ? (
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
          {showPending ? 'No pending mentors.' : 'No approved mentors yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mentors.map((m) => (
            <div
              key={m.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    {m.full_name}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {m.job_title} · {m.industry} · {m.years_exp} yrs
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: m.is_approved
                      ? 'rgba(34,197,94,0.12)'
                      : 'rgba(251,191,36,0.12)',
                    color: m.is_approved ? '#22C55E' : '#FBBF24',
                    textTransform: 'capitalize',
                  }}
                >
                  {m.verification_status.replace(/_/g, ' ')}
                </span>
              </div>

              {showPending && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <button
                    onClick={() => handleAction(m.user_id, 'approve')}
                    disabled={actionLoading === m.user_id}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(34,197,94,0.2)',
                      border: '1px solid rgba(34,197,94,0.4)',
                      color: '#4ADE80',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: actionLoading === m.user_id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading === m.user_id ? '...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleAction(m.user_id, 'reject')}
                    disabled={actionLoading === m.user_id}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#F87171',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: actionLoading === m.user_id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.4)',
                }}
              >
                <span>Languages: {m.languages || '—'}</span>
                <span>Safety score: {Math.round(m.bio_safety_score * 100)}%</span>
                <span>
                  Mentees: {m.current_mentees}/{m.max_mentees || m.total_mentees_served}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
