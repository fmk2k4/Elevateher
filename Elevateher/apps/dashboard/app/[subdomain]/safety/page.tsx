'use client';

import { useEffect, useState } from 'react';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import { apiFetch } from '@/src/lib/api-client';

interface SafetyStats {
  open_reports: number;
  critical_open: number;
  auto_suspensions: number;
  total_reports: number;
}

interface SafetyReport {
  id: string;
  reporter_email: string;
  reported_email: string;
  reported_name: string;
  reported_role: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed' | 'escalated_to_authorities';
  reason: string;
  description: string | null;
  created_at: string;
  auto_suspended: boolean;
}

interface SuspendedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_suspended: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
}

interface RiskMentor {
  id: string;
  mentor_id: string;
  match_id: string | null;
  risk_score: number;
  flags: string[];
  message_count: number;
  off_platform_attempts: number;
  intimacy_flags: number;
  snapshot_at: string;
  full_name: string;
  job_title: string;
  employer: string;
  email: string;
}

interface SafetyData {
  reports: SafetyReport[];
  suspended: SuspendedUser[];
  risk_mentors: RiskMentor[];
  stats: SafetyStats;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  reviewing: 'In Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  escalated_to_authorities: 'Escalated',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#F59E0B',
  reviewing: '#3B82F6',
  resolved: '#10B981',
  dismissed: '#6B7280',
  escalated_to_authorities: '#EF4444',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SafetyPage() {
  const { subdomain, institution } = useInstitution();
  const [data, setData] = useState<SafetyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reports' | 'risk' | 'suspended' | 'scanner'>('reports');
  const [scanText, setScanText] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!scanText.trim()) return;
    setIsScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      const res = await apiFetch<any>(`/safety/text`, {
        method: 'POST',
        body: JSON.stringify({ text: scanText, institution_id: subdomain })
      });
      setScanResult(res);
    } catch (err: any) {
      setScanError(err?.message || 'Failed to scan bio');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Only fetch once we have the resolved institution UUID
    if (!institution?.id) {
      setLoading(false);
      return;
    }

    apiFetch<SafetyData>(`/admin/safety?institution_id=${institution.id}`)
      .then((payload) => {
        if (isMounted) {
          setData(payload);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message || 'Unable to load safety data');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [subdomain, institution?.id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.5)' }}>
        Loading safety overview...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#FCA5A5' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Unable to load safety data</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const stats = data.stats;
  const reports = data.reports || [];
  const suspended = data.suspended || (data as any).suspended_users || [];
  const risk_mentors = data.risk_mentors || (data as any).high_risk_mentors || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 4px',
          }}
        >
          Safety & Trust
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
          Monitor safety reports, trust scores, and mentor risk profiles
        </p>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F59E0B' }}>
            {stats.open_reports}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Open Reports
          </div>
        </div>
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, color: '#EF4444' }}>
            {stats.critical_open}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Critical Open
          </div>
        </div>
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, color: '#EF4444' }}>
            {stats.auto_suspensions}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Auto Suspensions
          </div>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>
            {stats.total_reports}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Total Reports
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 0,
        }}
      >
        {[
          { key: 'reports', label: 'Safety Reports', count: reports.length },
          { key: 'risk', label: 'Risk Mentors', count: risk_mentors.length },
          { key: 'suspended', label: 'Suspended Users', count: suspended.length },
          { key: 'scanner', label: 'Live Scanner', count: 0 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key
                ? '2px solid #EC4899'
                : '2px solid transparent',
              color: activeTab === tab.key ? '#EC4899' : 'rgba(255,255,255,0.5)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {tab.label}
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 10,
                background: activeTab === tab.key
                  ? 'rgba(236,72,153,0.2)'
                  : 'rgba(255,255,255,0.08)',
                color: activeTab === tab.key ? '#EC4899' : 'rgba(255,255,255,0.4)',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {reports.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.35)',
                fontSize: 14,
              }}
            >
              No safety reports filed
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {['Reported User', 'Severity', 'Status', 'Reason', 'Date'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.45)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((report, i) => (
                  <tr
                    key={report.id}
                    style={{
                      borderBottom: i < reports.length - 1
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                        {report.reported_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {report.reported_email} · {report.reported_role}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: `${SEVERITY_COLORS[report.severity]}20`,
                          color: SEVERITY_COLORS[report.severity],
                          textTransform: 'uppercase',
                        }}
                      >
                        {report.severity}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: `${STATUS_COLORS[report.status]}20`,
                          color: STATUS_COLORS[report.status],
                        }}
                      >
                        {STATUS_LABELS[report.status]}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.65)',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={report.reason}
                    >
                      {report.reason}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {formatDate(report.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Risk Mentors Tab */}
      {activeTab === 'risk' && (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {risk_mentors.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.35)',
                fontSize: 14,
              }}
            >
              No mentors with elevated risk scores
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {['Mentor', 'Risk Score', 'Flags', 'Off-Platform', 'Last Snapshot'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.45)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risk_mentors.map((mentor, i) => (
                  <tr
                    key={mentor.id || i}
                    style={{
                      borderBottom: i < risk_mentors.length - 1
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                        {mentor.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {mentor.job_title} · {mentor.employer}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: mentor.risk_score >= 0.8
                            ? '#EF4444'
                            : mentor.risk_score >= 0.5
                              ? '#F59E0B'
                              : '#10B981',
                        }}
                      >
                        {(mentor.risk_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {mentor.flags.slice(0, 3).map((flag) => (
                          <span
                            key={flag}
                            style={{
                              fontSize: 9,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: 'rgba(245,158,11,0.15)',
                              color: '#F59E0B',
                            }}
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                      {mentor.off_platform_attempts}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {formatDate(mentor.snapshot_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Suspended Users Tab */}
      {activeTab === 'suspended' && (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {suspended.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.35)',
                fontSize: 14,
              }}
            >
              No suspended users
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {['User', 'Role', 'Reason', 'Suspended At'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.45)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suspended.map((user, i) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: i < suspended.length - 1
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {user.email}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: 'rgba(239,68,68,0.15)',
                          color: '#EF4444',
                          textTransform: 'capitalize',
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.65)',
                        maxWidth: 200,
                      }}
                    >
                      {user.suspended_reason || 'Safety concern'}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {formatDate(user.suspended_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Live Scanner Tab */}
      {activeTab === 'scanner' && (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Header */}
          <div>
            <h2 style={{ fontSize: 20, color: '#fff', margin: '0 0 4px', fontWeight: 800 }}>
              🔬 Live Bio Safety Scanner
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              Powered by{' '}
              <strong style={{ color: '#A78BFA' }}>SEA-Guard</strong>{' '}
              — multilingual grooming detection for SE Asian mentorship platforms.
              Paste a mentor bio or choose a demo sample to see real-time scanning.
            </p>
          </div>

          {/* Quick sample buttons */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', marginBottom: 8 }}>
              DEMO SAMPLES
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                {
                  label: '✅ Safe Bio',
                  color: '#10B981',
                  text: 'I am a senior data scientist at Grab with 9 years of experience. I mentor girls interested in Python, data analysis, and ethical AI careers through structured weekly sessions on ElevateHer.',
                },
                {
                  label: '⚠️ WhatsApp Solicitation',
                  color: '#EF4444',
                  text: 'I can help you privately. Add me on WhatsApp and do not tell anyone, this will be only between us.',
                },
                {
                  label: '🚨 Secret Language (Malay)',
                  color: '#EF4444',
                  text: 'Bagi nomor pribadi kamu, jangan beritahu sesiapa. Rahsia kita sahaja.',
                },
                {
                  label: '🔴 Intimacy Escalation',
                  color: '#F59E0B',
                  text: 'You are very different from my other students. Our little secret — trust me on this. No one else will understand.',
                },
                {
                  label: '📏 Too Short',
                  color: '#6B7280',
                  text: 'I help girls.',
                },
              ].map((sample) => (
                <button
                  key={sample.label}
                  onClick={() => { setScanText(sample.text); setScanResult(null); setScanError(null); }}
                  style={{
                    padding: '7px 14px',
                    background: `${sample.color}18`,
                    border: `1px solid ${sample.color}50`,
                    borderRadius: 8,
                    color: sample.color,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={scanText}
              onChange={(e) => setScanText(e.target.value)}
              placeholder="Paste mentor bio here, or click a demo sample above…"
              style={{
                width: '100%',
                height: 130,
                background: 'rgba(0,0,0,0.25)',
                border: `1px solid ${scanText ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10,
                padding: '12px 14px',
                color: '#fff',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical' as const,
                outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
            {scanText && (
              <span style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                {scanText.length} chars
              </span>
            )}
          </div>

          {/* Scan button */}
          <button
            id="bio-scan-btn"
            onClick={handleScan}
            disabled={isScanning || !scanText.trim()}
            style={{
              padding: '12px 28px',
              background: isScanning ? 'rgba(236,72,153,0.4)' : 'linear-gradient(135deg, #7C3AED, #EC4899)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: isScanning || !scanText.trim() ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
              opacity: isScanning || !scanText.trim() ? 0.7 : 1,
            }}
          >
            {isScanning ? '⏳ Scanning…' : '🔍 Scan Bio'}
          </button>

          {/* Scan error */}
          {scanError && (
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)' }}>
              <div style={{ fontWeight: 700, color: '#EF4444', marginBottom: 4 }}>❌ Scan Error</div>
              <p style={{ fontSize: 13, color: 'rgba(239,68,68,0.8)', margin: 0 }}>{scanError}</p>
            </div>
          )}

          {/* Result card */}
          {scanResult && !scanResult.error && (
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                border: `1px solid ${scanResult.approved ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                background: scanResult.approved ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              }}
            >
              {/* Status row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: scanResult.approved ? '#10B981' : '#EF4444' }}>
                  {scanResult.approved ? '✅' : '❌'}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                    {scanResult.approved ? 'Bio Approved — Safe to Publish' : 'Bio Blocked — Safety Concern Detected'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                    Scanned by SEA-Guard multilingual pattern classifier
                  </div>
                </div>
                {scanResult.requires_human_review && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'rgba(245,158,11,0.2)',
                    color: '#F59E0B',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1px solid rgba(245,158,11,0.35)',
                  }}>
                    ⚠️ Requires Human Review
                  </span>
                )}
              </div>

              {/* Score bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>SAFETY SCORE</span>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: scanResult.safe_score >= 0.75 ? '#10B981' : scanResult.safe_score >= 0.5 ? '#F59E0B' : '#EF4444',
                  }}>
                    {(scanResult.safe_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${scanResult.safe_score * 100}%`,
                    background: scanResult.safe_score >= 0.75
                      ? 'linear-gradient(90deg, #10B981, #34D399)'
                      : scanResult.safe_score >= 0.5
                        ? 'linear-gradient(90deg, #F59E0B, #FCD34D)'
                        : 'linear-gradient(90deg, #EF4444, #F87171)',
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>Unsafe (0%)</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>▲ 75% threshold</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>Safe (100%)</span>
                </div>
              </div>

              {/* Flags */}
              {scanResult.flags && scanResult.flags.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', marginBottom: 8 }}>
                    FLAGS DETECTED
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {scanResult.flags.map((flag: string) => {
                      const FLAG_EXPLAIN: Record<string, string> = {
                        off_platform_solicitation: 'Mentor is attempting to move communication off the ElevateHer platform (e.g., WhatsApp, Telegram, private number).',
                        intimacy_escalation: 'Language suggests building an inappropriate personal relationship (secrets, isolation, trust manipulation).',
                        bio_too_short: 'Bio is too short to assess credibility or intent. Minimum 30 characters required.',
                        suspicious_format: 'Excessive emojis or informal formatting may indicate an attempt to obscure intent.',
                        safety_model_unavailable: 'Neural model offline — pattern-based scan used. Result requires human confirmation.',
                        grooming_language: 'Content matches known grooming language patterns used against minors.',
                        gender_coded_bias: 'Bio contains language that stereotypes or devalues the mentee based on gender.',
                        inappropriate_contact: 'Direct request for private or personal contact outside the platform.',
                        boundary_violation: 'Language that tests or violates professional mentoring boundaries.',
                        isolation_language: 'Encourages the mentee to keep interactions secret or away from guardians.',
                      };
                      return (
                        <div
                          key={flag}
                          style={{
                            display: 'flex',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                          }}
                        >
                          <span style={{ fontSize: 14, flexShrink: 0 }}>🚩</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#FCA5A5', fontFamily: 'monospace' }}>
                              {flag}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                              {FLAG_EXPLAIN[flag] || 'Safety concern detected by classifier.'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {scanResult.approved && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 12, color: '#6EE7B7' }}>
                  ✓ This bio meets all ElevateHer safety requirements. The mentor profile can be published.
                </div>
              )}
            </div>
          )}

          {scanResult?.error && (
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)' }}>
              <div style={{ fontWeight: 700, color: '#EF4444', marginBottom: 4 }}>❌ Scan Failed</div>
              <p style={{ fontSize: 13, color: 'rgba(239,68,68,0.8)', margin: 0 }}>{scanResult.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}