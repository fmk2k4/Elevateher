'use client';

import { useState } from 'react';
import { useInstitution } from '@/components/layout/InstitutionProvider';
import { apiFetch } from '@/src/lib/api-client';

export default function ReportsPage() {
  const { subdomain, institution } = useInstitution();
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  const generateReport = async () => {
    // Only generate once we have the resolved institution UUID
    if (!institution?.id) {
      alert('Institution context not yet loaded. Please try again.');
      return;
    }
    setGenerating(true);
    setReportUrl(null);
    try {
      const data = await apiFetch<unknown>(`/impact/report/${institution.id}?period_start=${periodStart}&period_end=${periodEnd}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      setReportUrl(url);
      setReportData(data);
    } catch {
      alert('Failed to generate report. Ensure the backend is running.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadJson = () => {
    if (!reportUrl) return;
    const a = document.createElement('a');
    a.href = reportUrl;
    a.download = `elevateher-impact-${subdomain}-${periodStart}-${periodEnd}.json`;
    a.click();
  };

  const downloadCsv = () => {
    if (!reportData?.sdg_impact) return;
    
    const rows = [["SDG Target", "Recorded Events", "Description"]];
    Object.values(reportData.sdg_impact).forEach((impact: any) => {
      rows.push([
        `"${impact.target.replace(/"/g, '""')}"`,
        impact.events,
        `"${impact.description.replace(/"/g, '""')}"`
      ]);
    });
    
    const csvContent = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `elevateher-impact-${subdomain}-${periodStart}-${periodEnd}.csv`;
    a.click();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>SDG Impact Reports</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>Export impact data for grant submissions and institutional reporting</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Subdomain: {subdomain}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Range: {periodStart} → {periodEnd}</span>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>Report Period</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Start Date</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>End Date</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none' }} />
          </div>
        </div>

        <button onClick={generateReport} disabled={generating} style={{ width: '100%', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #7C3AED, #EC4899)', border: 'none', color: '#fff', cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}>
          {generating ? 'Generating Report...' : 'Generate SDG Impact Report'}
        </button>
      </div>

      {reportData && (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E' }}>✅ Report generated successfully</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>Preview of your institution&apos;s SDG impact data</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={downloadCsv} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#A78BFA', cursor: 'pointer' }}>
                Download CSV
              </button>
              <button onClick={downloadJson} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', cursor: 'pointer' }}>
                Download JSON
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Total Mentees</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{reportData.headline.total_mentees}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>SEA Region</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{reportData.headline.sea_mentees}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Completed Matches</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{reportData.headline.completed_programmes}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Match Quality</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{reportData.headline.avg_match_quality}/5.0</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px 0', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>SDG Target</th>
                <th style={{ padding: '12px 0', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Recorded Events</th>
                <th style={{ padding: '12px 0', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(reportData.sdg_impact).map((impact: any, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px 0', color: '#fff', fontWeight: 600 }}>{impact.target}</td>
                  <td style={{ padding: '16px 0', color: '#A78BFA', fontWeight: 700 }}>{impact.events}</td>
                  <td style={{ padding: '16px 0', color: 'rgba(255,255,255,0.7)' }}>{impact.description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 20, padding: 16, background: 'rgba(124,58,237,0.1)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.2)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#A78BFA', marginBottom: 4 }}>Digital Inclusion</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{reportData.digital_inclusion.narrative}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.65)', margin: '0 0 12px' }}>What gets measured</h3>
        <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
          <li>SDG 4.4 — Skills gained (milestones, courses, certifications)</li>
          <li>SDG 5.5 — Gender equity steps (networking, negotiation, leadership)</li>
          <li>SDG 8.6 — Career entries (job offers, internships, first salary)</li>
          <li>Digital inclusion — % of sessions via SMS/USSD (offline reach)</li>
          <li>Cohort completion rates and average match quality scores</li>
        </ul>
      </div>
    </div>
  );
}
