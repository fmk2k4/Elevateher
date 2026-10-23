'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import { apiFetch, DashboardApiError } from '@/src/lib/api-client';

interface WeeklyData {
  week: string;
  sdg4: number;
  sdg5: number;
  sdg8: number;
}

interface TrackData {
  name: string;
  value: number;
}

interface WeeklyResponse {
  weekly?: WeeklyData[];
}

interface TracksResponse {
  tracks?: TrackData[];
}

interface StatsResponse {
  offline_sessions?: number;
  web_sessions?: number;
}

interface ProgressionData {
  funnel: {
    registered: number;
    pending_match: number;
    in_active_match: number;
    with_completed_sessions: number;
    completed_programs: number;
  };
  completion_rate: number;
  by_track: Record<string, { active: number; completed: number }>;
}

interface MentorUtilizationData {
  total_mentors: number;
  active_mentors: number;
  unused_mentors: number;
  mentors_with_capacity: number;
  active_mentor_rate: number;
  total_active_mentees: number;
  avg_sessions_per_mentor: number;
}

interface SafetyInterventionData {
  total_reports: number;
  by_status: { open: number; under_review: number; resolved: number };
  intervention_rate: number;
  resolution_rate: number;
  top_reasons: { reason: string; count: number }[];
}

interface OutcomeVelocityData {
  overall: {
    total_matches: number;
    completion_rate: number;
    avg_days_to_first_session: number;
  };
}

const TRACK_COLORS = ['#7C3AED', '#EC4899', '#3B82F6', '#F59E0B', '#10B981'];

export default function AnalyticsPage() {
  const { subdomain, error: institutionError } = useInstitution();
  const [weekly, setWeekly] = useState<WeeklyData[]>([]);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [offlinePct, setOfflinePct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [progression, setProgression] = useState<ProgressionData | null>(null);
  const [mentorUtil, setMentorUtil] = useState<MentorUtilizationData | null>(null);
  const [safety, setSafety] = useState<SafetyInterventionData | null>(null);
  const [velocity, setVelocity] = useState<OutcomeVelocityData | null>(null);

  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [progressionError, setProgressionError] = useState<string | null>(null);
  const [mentorUtilError, setMentorUtilError] = useState<string | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [velocityError, setVelocityError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setWeeklyError(null);
    setTracksError(null);
    setStatsError(null);
    setProgressionError(null);
    setMentorUtilError(null);
    setSafetyError(null);
    setVelocityError(null);

    let completed = 0;
    const total = 7;
    const checkDone = () => {
      completed += 1;
      if (completed >= total && isMounted) {
        setLoading(false);
      }
    };

    const handleApiError = (msg: string) => {
      if (msg.includes('APIError ') || msg.includes('NetworkError ')) return msg;
      return msg;
    };

    apiFetch<WeeklyResponse>(`/dashboard/${subdomain}/analytics/weekly`)
      .then((w) => { if (isMounted) setWeekly(w.weekly || []); })
      .catch((err: Error) => { if (isMounted) setWeeklyError(handleApiError(err.message || 'Weekly data unavailable')); })
      .finally(() => { if (isMounted) checkDone(); });

    apiFetch<TracksResponse>(`/dashboard/${subdomain}/analytics/tracks`)
      .then((t) => { if (isMounted) setTracks(t.tracks || []); })
      .catch((err: Error) => { if (isMounted) setTracksError(handleApiError(err.message || 'Tracks data unavailable')); })
      .finally(() => { if (isMounted) checkDone(); });

    apiFetch<StatsResponse>(`/dashboard/${subdomain}/stats`)
      .then((s) => {
        if (!isMounted) return;
        const offlineSessions = s.offline_sessions || 0;
        const webSessions = s.web_sessions || 0;
        const total = offlineSessions + webSessions;
        setOfflinePct(total ? Math.round((offlineSessions / total) * 100) : 0);
      })
      .catch((err: Error) => { if (isMounted) setStatsError(handleApiError(err.message || 'Stats data unavailable')); })
      .finally(() => { if (isMounted) checkDone(); });

    apiFetch<ProgressionData>(`/impact/institution/${subdomain}/progression`)
      .then((prog) => { if (isMounted) setProgression(prog); })
      .catch((err: Error) => { if (isMounted) setProgressionError(handleApiError(err.message || 'Progression data unavailable')); })
      .finally(() => { if (isMounted) checkDone(); });

    apiFetch<MentorUtilizationData>(`/impact/institution/${subdomain}/mentor-utilization`)
      .then((mu) => { if (isMounted) setMentorUtil(mu); })
      .catch((err: Error) => { if (isMounted) setMentorUtilError(handleApiError(err.message || 'Mentor utilization data unavailable')); })
      .finally(() => { if (isMounted) checkDone(); });

    apiFetch<SafetyInterventionData>(`/impact/institution/${subdomain}/safety-interventions`)
      .then((saf) => { if (isMounted) setSafety(saf); })
      .catch((err: Error) => { if (isMounted) setSafetyError(handleApiError(err.message || 'Safety interventions data unavailable')); })
      .finally(() => { if (isMounted) checkDone(); });

    apiFetch<OutcomeVelocityData>(`/impact/institution/${subdomain}/outcome-velocity`)
      .then((vel) => { if (isMounted) setVelocity(vel); })
      .catch((err: Error) => { if (isMounted) setVelocityError(handleApiError(err.message || 'Outcome velocity data unavailable')); })
      .finally(() => { if (isMounted) checkDone(); });

    return () => {
      isMounted = false;
    };
  }, [subdomain, reloadKey]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.5)' }}>Loading analytics...</div>;
  }

  const failedEndpoints: string[] = [];
  if (weeklyError) failedEndpoints.push(`Weekly trends: ${weeklyError}`);
  if (tracksError) failedEndpoints.push(`Track distribution: ${tracksError}`);
  if (statsError) failedEndpoints.push(`Digital inclusion stats: ${statsError}`);
  if (progressionError) failedEndpoints.push(`Progression: ${progressionError}`);
  if (mentorUtilError) failedEndpoints.push(`Mentor utilization: ${mentorUtilError}`);
  if (safetyError) failedEndpoints.push(`Safety interventions: ${safetyError}`);
  if (velocityError) failedEndpoints.push(`Outcome velocity: ${velocityError}`);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {failedEndpoints.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', marginBottom: 6 }}>
            Some analytics endpoints failed to load ({failedEndpoints.length}/7)
          </div>
          {failedEndpoints.map((msg, i) => (
            <div key={i} style={{ fontSize: 12, color: 'rgba(245,158,11,0.8)', lineHeight: 1.6 }}>
              {msg}
            </div>
          ))}
          {institutionError ? <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>Institution setup note: {institutionError}</p> : null}
          <button
            onClick={() => setReloadKey((value) => value + 1)}
            style={{ marginTop: 10, padding: '6px 16px', background: '#EC4899', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            Retry All
          </button>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Analytics</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>Programme trends, track distribution, and digital inclusion metrics</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Weekly data: {weekly.length}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Tracks: {tracks.length}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Offline access: {offlinePct}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>SDG Impact Timeline</h3>
          {weekly.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No data yet. Events will appear after the first sessions.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="sdg4" stroke="#3B82F6" strokeWidth={2} name="SDG 4.4" />
                <Line type="monotone" dataKey="sdg5" stroke="#E11D48" strokeWidth={2} name="SDG 5.5" />
                <Line type="monotone" dataKey="sdg8" stroke="#10B981" strokeWidth={2} name="SDG 8.6" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>Track Distribution</h3>
          {tracks.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No track data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={tracks} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}>
                  {tracks.map((entry) => (
                    <Cell key={entry.name} fill={TRACK_COLORS[tracks.indexOf(entry) % TRACK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>Digital Inclusion: Offline vs Online Sessions</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[{ name: 'Sessions', offline: offlinePct, online: 100 - offlinePct }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="offline" fill="#7C3AED" name={`Offline (${offlinePct}%)`} radius={[4, 4, 0, 0]} />
                <Bar dataKey="online" fill="#374151" name={`Online (${100 - offlinePct}%)`} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ maxWidth: 240 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8 }}>{offlinePct}% Offline Access</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>Sessions delivered via SMS/USSD — reaching girls with zero smartphone or internet access. This is a core differentiator for ElevateHer.</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>Programme Quality</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Proof-of-impact metrics for institutional reporting</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>PROGRAMME PROGRESSION</div>
            {progression ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#3B82F6', lineHeight: 1 }}>{progression.completion_rate}%</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>completion rate</div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No data yet</div>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>MENTOR UTILIZATION</div>
            {mentorUtil ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#8B5CF6', lineHeight: 1 }}>{mentorUtil.active_mentor_rate}%</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>mentors active</div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No data yet</div>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>SAFETY INTERVENTIONS</div>
            {safety ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#EF4444', lineHeight: 1 }}>{safety.resolution_rate}%</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>resolved</div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No data yet</div>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>OUTCOME VELOCITY</div>
            {velocity ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981', lineHeight: 1 }}>{velocity.overall.completion_rate}%</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>completion rate</div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}