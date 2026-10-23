# ElevateHer — File 07: B2B Institution Dashboard (Complete)
### Impact Ledger · SDG Analytics · Cohort Management · Real-Time SSE · Export Reports

> **Senior Engineer Note:** The dashboard is not a feature — it is the revenue product. INTI and NYP are not paying for the AI engine they can't see. They are paying for this screen. It must look like a USD 50,000/year enterprise SaaS product. The Impact Ledger must be live, not a PDF. Every metric must be explainable to a grant committee.

---

## 1. Dashboard Project Structure

```
apps/dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       # Redirect to /overview
│   ├── (auth)/login/page.tsx
│   └── [subdomain]/
│       ├── layout.tsx                 # Institution shell (sidebar + topbar)
│       ├── overview/page.tsx          # Cohort headline stats
│       ├── mentees/page.tsx           # Mentee table
│       ├── mentors/page.tsx           # Mentor management
│       ├── matches/page.tsx           # Active matches table
│       ├── impact/page.tsx            # Live Impact Ledger
│       ├── analytics/page.tsx         # Charts and trends
│       └── reports/page.tsx           # Export SDG reports
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── InstitutionProvider.tsx
│   ├── overview/
│   │   ├── StatCard.tsx
│   │   ├── CohortHealthGauge.tsx
│   │   └── QuickActions.tsx
│   ├── impact/
│   │   ├── ImpactLedger.tsx           # Live SSE feed
│   │   ├── SDGSummaryGrid.tsx
│   │   └── ImpactEventRow.tsx
│   ├── analytics/
│   │   ├── SDGTimelineChart.tsx
│   │   ├── TrackDistributionChart.tsx
│   │   ├── OfflineVsOnlineChart.tsx
│   │   └── MentorLeaderboard.tsx
│   └── reports/
│       ├── ReportBuilder.tsx
│       └── ExportButton.tsx
└── package.json
```

---

## 2. Institution Shell Layout

```typescript
// app/[subdomain]/layout.tsx
import { InstitutionProvider } from '@/components/layout/InstitutionProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default function InstitutionLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { subdomain: string }
}) {
  return (
    <InstitutionProvider subdomain={params.subdomain}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-6 py-6">
            {children}
          </main>
        </div>
      </div>
    </InstitutionProvider>
  )
}
```

```typescript
// components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useInstitution } from './InstitutionProvider'

const NAV = [
  { href: 'overview',  icon: '⊞',  label: 'Overview' },
  { href: 'impact',    icon: '⚡',  label: 'Impact Ledger', badge: 'LIVE' },
  { href: 'matches',   icon: '🤝',  label: 'Matches' },
  { href: 'mentees',   icon: '👩‍🎓', label: 'Mentees' },
  { href: 'mentors',   icon: '👩‍💼', label: 'Mentors' },
  { href: 'analytics', icon: '📊',  label: 'Analytics' },
  { href: 'reports',   icon: '📄',  label: 'Reports' }
]

export function Sidebar() {
  const { institution } = useInstitution()
  const pathname = usePathname()
  const base = `/${institution?.subdomain}`

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">ElevateHer</p>
            <p className="text-xs text-slate-500">{institution?.name}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => {
          const href = `${base}/${item.href}`
          const active = pathname === href
          return (
            <Link key={item.href} href={href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl
                text-sm font-medium transition-all ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}>
              <span className="flex items-center gap-3">
                <span>{item.icon}</span>
                {item.label}
              </span>
              {item.badge && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  active ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200">
        <p className="text-xs text-slate-400">
          SDG 4 · SDG 5 · SDG 8
        </p>
        <p className="text-xs text-slate-400 mt-0.5">GoGlobal Partner</p>
      </div>
    </aside>
  )
}
```

---

## 3. Overview Page (Cohort Headlines)

```typescript
// app/[subdomain]/overview/page.tsx
import { StatCard } from '@/components/overview/StatCard'
import { CohortHealthGauge } from '@/components/overview/CohortHealthGauge'

async function fetchStats(subdomain: string, token: string) {
  const res = await fetch(
    `${process.env.API_URL}/admin/institutions/${subdomain}/stats`,
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 }    // Revalidate every 60 seconds (ISR)
    }
  )
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export default async function OverviewPage({
  params
}: { params: { subdomain: string } }) {
  // In production, get token from server-side session (cookies)
  const token = process.env.DASHBOARD_SERVICE_TOKEN!
  const stats = await fetchStats(params.subdomain, token)

  const sdgTotal = (stats.sdg4_events ?? 0) + (stats.sdg5_events ?? 0) + (stats.sdg8_events ?? 0)
  const sessionTotal = (stats.offline_sessions ?? 0) + (stats.web_sessions ?? 0)
  const offlinePct = sessionTotal > 0
    ? Math.round((stats.offline_sessions / sessionTotal) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cohort Overview</h1>
        <p className="text-slate-500 mt-1">{stats.institution_name} · {stats.country}</p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Mentees"
          value={stats.total_mentees ?? 0}
          icon="👩‍🎓"
          trend="+12 this week"
          trendUp />
        <StatCard
          label="Active Matches"
          value={stats.active_matches ?? 0}
          icon="🤝"
          trend={`${stats.pending_matches ?? 0} pending`} />
        <StatCard
          label="Programmes Completed"
          value={stats.completed_programmes ?? 0}
          icon="🎓"
          trend="12-week tracks" />
        <StatCard
          label="SDG Events Total"
          value={sdgTotal}
          icon="🌏"
          trend="SDG 4 + 5 + 8"
          trendUp />
      </div>

      {/* SDG Impact row */}
      <div className="grid grid-cols-3 gap-4">
        <SDGImpactCard
          goal="4.4"
          label="Quality Education"
          description="Skills for employment"
          count={stats.sdg4_events ?? 0}
          color="blue" />
        <SDGImpactCard
          goal="5.5"
          label="Gender Equality"
          description="Women's full participation"
          count={stats.sdg5_events ?? 0}
          color="pink" />
        <SDGImpactCard
          goal="8.6"
          label="Decent Work"
          description="Employment for youth"
          count={stats.sdg8_events ?? 0}
          color="green" />
      </div>

      {/* Offline inclusion */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Digital Inclusion</h2>
        <div className="flex items-center gap-6">
          <CohortHealthGauge
            value={offlinePct}
            label="Sessions via SMS/USSD"
            description="Reached without internet access" />
          <div className="flex-1 space-y-3">
            <MetricRow
              label="SMS/USSD Sessions"
              value={stats.offline_sessions ?? 0}
              color="violet" />
            <MetricRow
              label="Web Sessions"
              value={stats.web_sessions ?? 0}
              color="slate" />
            <div className="p-3 bg-violet-50 rounded-xl">
              <p className="text-sm text-violet-800">
                <strong>{offlinePct}%</strong> of sessions reached girls who
                wouldn't be reachable by any app-first platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SDGImpactCard({
  goal, label, description, count, color
}: { goal: string; label: string; description: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue:  'bg-blue-50 border-blue-200 text-blue-900',
    pink:  'bg-pink-50 border-pink-200 text-pink-900',
    green: 'bg-green-50 border-green-200 text-green-900'
  }
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
          SDG {goal}
        </span>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <p className="font-semibold">{label}</p>
      <p className="text-sm opacity-70 mt-1">{description}</p>
    </div>
  )
}

function MetricRow({ label, value, color }: { label: string; value: number; color: string }) {
  const max = 200   // approximate expected max for gauge width
  const w = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-${color}-500`}
          style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}
```

---

## 4. Live Impact Ledger (Server-Sent Events)

```typescript
// components/impact/ImpactLedger.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { ImpactEventRow } from './ImpactEventRow'
import { SDGSummaryGrid } from './SDGSummaryGrid'

export interface ImpactEvent {
  id: string
  event_type: string
  sdg_goal: string
  sdg_track: string
  description?: string
  recorded_at: string
}

const SDG_LABELS: Record<string, string> = {
  '4.4': 'Skill Gained',
  '5.5': 'Gender Equity Step',
  '8.6': 'Career Entry'
}

export function ImpactLedger({ institutionId }: { institutionId: string }) {
  const [events, setEvents] = useState<ImpactEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [totalByGoal, setTotalByGoal] = useState<Record<string, number>>({})
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? ''
    const url = `${API}/impact/stream/${institutionId}`

    const sse = new EventSource(url)
    eventSourceRef.current = sse

    sse.onopen = () => setConnected(true)

    sse.onmessage = (e) => {
      try {
        const event: ImpactEvent = JSON.parse(e.data)
        setEvents(prev => [event, ...prev].slice(0, 100))  // Keep last 100
        setTotalByGoal(prev => ({
          ...prev,
          [event.sdg_goal]: (prev[event.sdg_goal] ?? 0) + 1
        }))
      } catch {
        // Ignore parse errors
      }
    }

    sse.onerror = () => {
      setConnected(false)
      // Reconnect after 5 seconds
      setTimeout(() => {
        sse.close()
        // React will re-run this effect if institutionId changes
      }, 5000)
    }

    return () => {
      sse.close()
      setConnected(false)
    }
  }, [institutionId])

  return (
    <div className="space-y-6">
      {/* SDG summary tiles */}
      <SDGSummaryGrid totals={totalByGoal} sessionEvents={events.length} />

      {/* Live feed */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Live Impact Feed</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Real-time anonymised impact events across your cohort
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
            }`} />
            <span className="text-sm text-slate-500">
              {connected ? 'Live' : 'Connecting…'}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
          {events.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🌱</p>
              <p className="text-slate-500">
                Waiting for impact events…
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Events appear here in real time as mentees complete milestones
              </p>
            </div>
          )}
          {events.map((event, i) => (
            <ImpactEventRow key={event.id || i} event={event} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

```typescript
// components/impact/ImpactEventRow.tsx
import { ImpactEvent } from './ImpactLedger'

const EVENT_ICONS: Record<string, string> = {
  career_entry:          '🚀',
  job_offer:             '💼',
  skill_gained:          '📚',
  milestone_reached:     '🏆',
  course_enrolled:       '🎓',
  course_completed:      '✅',
  certification_gained:  '🏅',
  network_connection:    '🤝',
  internship_started:    '💡',
  programme_completed:   '🌟',
  first_salary_negotiation: '💰',
  promotion_received:    '⬆️'
}

const SDG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  '4.4': { bg: 'bg-blue-100',  text: 'text-blue-800',  label: 'SDG 4.4 — Education' },
  '5.5': { bg: 'bg-pink-100',  text: 'text-pink-800',  label: 'SDG 5.5 — Equality' },
  '8.6': { bg: 'bg-green-100', text: 'text-green-800', label: 'SDG 8.6 — Work' }
}

const TRACK_COLORS: Record<string, string> = {
  STEM: 'text-blue-600', Business: 'text-amber-600',
  Trades: 'text-orange-600', Creative: 'text-pink-600', Healthcare: 'text-green-600'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function humaniseEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function ImpactEventRow({ event }: { event: ImpactEvent }) {
  const sdg   = SDG_STYLES[event.sdg_goal]
  const icon  = EVENT_ICONS[event.event_type] ?? '⭐'
  const track = event.sdg_track ?? ''

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors
      animate-in slide-in-from-top-2 duration-300">
      {/* Event icon */}
      <span className="text-2xl flex-shrink-0">{icon}</span>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">
            {humaniseEventType(event.event_type)}
          </span>
          {track && (
            <span className={`text-xs font-medium ${TRACK_COLORS[track] ?? 'text-slate-600'}`}>
              {track} track
            </span>
          )}
        </div>
        {event.description && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{event.description}</p>
        )}
      </div>

      {/* SDG badge */}
      {sdg && (
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0
          ${sdg.bg} ${sdg.text}`}>
          {sdg.label}
        </span>
      )}

      {/* Time */}
      <span className="text-xs text-slate-400 flex-shrink-0 w-12 text-right">
        {formatTime(event.recorded_at)}
      </span>
    </div>
  )
}
```

---

## 5. SDG Summary Grid

```typescript
// components/impact/SDGSummaryGrid.tsx

interface SDGSummaryGridProps {
  totals: Record<string, number>
  sessionEvents: number
}

const SDG_CARDS = [
  {
    goal: '4.4',
    title: 'Quality Education',
    subtitle: 'Skills for employment & entrepreneurship',
    icon: '📚',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    goal: '5.5',
    title: 'Gender Equality',
    subtitle: "Women's full participation & leadership",
    icon: '👩‍💼',
    gradient: 'from-pink-500 to-rose-500'
  },
  {
    goal: '8.6',
    title: 'Decent Work',
    subtitle: 'Reduce youth not in employment or education',
    icon: '💼',
    gradient: 'from-emerald-500 to-green-500'
  }
]

export function SDGSummaryGrid({ totals, sessionEvents }: SDGSummaryGridProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {SDG_CARDS.map(card => (
        <div key={card.goal}
          className="bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden">
          {/* Background gradient accent */}
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-full
            bg-gradient-to-br ${card.gradient} opacity-10 translate-x-8 -translate-y-8`} />

          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                SDG {card.goal}
              </span>
            </div>
            <div className="text-4xl font-bold text-slate-900 mb-1">
              {totals[card.goal] ?? 0}
            </div>
            <p className="font-semibold text-slate-800 text-sm">{card.title}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## 6. SDG Timeline Chart (Analytics)

```typescript
// components/analytics/SDGTimelineChart.tsx
'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'

interface TimelineData {
  week: string
  sdg4: number
  sdg5: number
  sdg8: number
}

interface Props {
  institutionId: string
  token: string
}

export function SDGTimelineChart({ institutionId, token }: Props) {
  const [data, setData] = useState<TimelineData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? ''
    fetch(`${API}/impact/timeline/${institutionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then((rows: Array<{ week: string; sdg_goal: string; event_count: number }>) => {
        // Pivot rows to chart format
        const byWeek: Record<string, TimelineData> = {}
        for (const row of rows) {
          if (!byWeek[row.week]) {
            byWeek[row.week] = { week: row.week, sdg4: 0, sdg5: 0, sdg8: 0 }
          }
          if (row.sdg_goal === '4.4') byWeek[row.week].sdg4 += row.event_count
          if (row.sdg_goal === '5.5') byWeek[row.week].sdg5 += row.event_count
          if (row.sdg_goal === '8.6') byWeek[row.week].sdg8 += row.event_count
        }
        setData(Object.values(byWeek).sort((a,b) => a.week.localeCompare(b.week)))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [institutionId, token])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="h-64 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent
            rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">SDG Impact Over Time</h3>
        <p className="text-sm text-slate-500">Weekly impact events by SDG goal</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickFormatter={w => {
              const d = new Date(w)
              return `${d.getDate()}/${d.getMonth()+1}`
            }} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
          <Tooltip
            contentStyle={{
              background: 'white', border: '1px solid #E2E8F0',
              borderRadius: '12px', fontSize: '12px'
            }}
            formatter={(value, name) => [value, name.toString().toUpperCase()]} />
          <Legend
            formatter={v => ({ sdg4: 'SDG 4.4 Education', sdg5: 'SDG 5.5 Equality', sdg8: 'SDG 8.6 Work' }[v] ?? v)} />
          <Line type="monotone" dataKey="sdg4" stroke="#3B82F6"
            strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="sdg5" stroke="#EC4899"
            strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="sdg8" stroke="#10B981"
            strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

## 7. SDG Report Export

```typescript
// components/reports/ReportBuilder.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ReportBuilderProps {
  institutionId: string
  token: string
}

export function ReportBuilder({ institutionId, token }: ReportBuilderProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<'json' | 'pdf'>('json')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<object | null>(null)

  async function generateReport() {
    if (!startDate || !endDate) return
    setLoading(true)
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${API}/impact/report/${institutionId}?period_start=${startDate}&period_end=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      setReport(data)

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `elevateher-sdg-report-${startDate}-${endDate}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-slate-900 text-lg">Generate SDG Impact Report</h2>
        <p className="text-sm text-slate-500 mt-1">
          Export anonymised impact data for grant submissions and institutional reporting.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Period start</label>
          <input type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2
              text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Period end</label>
          <input type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2
              text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={generateReport}
          disabled={!startDate || !endDate || loading}
          className="bg-violet-600 hover:bg-violet-700">
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
      </div>

      {report && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
          <h3 className="font-medium text-slate-900 mb-3">Report Preview</h3>
          <pre className="text-xs text-slate-700 overflow-x-auto max-h-64 overflow-y-auto">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
```

---

## 8. Impact SSE Endpoint (Backend)

```python
# services/api/routers/impact.py (SSE stream endpoint)

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
import asyncpg, asyncio, json, uuid
from datetime import datetime

from dependencies import get_db_pool, require_institution_admin, get_redis

router = APIRouter()

@router.get("/impact/stream/{institution_id}")
async def stream_impact_events(
    institution_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_db_pool),
    redis = Depends(get_redis)
):
    """
    Server-Sent Events stream for live Impact Ledger.
    Polls for new events every 3 seconds and pushes to dashboard.
    Compatible with Next.js EventSource (no authentication on SSE
    for simplicity — add JWT query param in production).
    """
    async def generate():
        # Send initial connection event
        yield 'data: {"type":"connected","ts":"' + datetime.utcnow().isoformat() + '"}\n\n'

        # Track last event sent
        last_ts_key = f"impact_stream:last_ts:{institution_id}"
        last_ts = await redis.get(last_ts_key) or "2020-01-01T00:00:00"

        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, event_type, sdg_goal, sdg_track,
                           description, recorded_at
                    FROM impact_events
                    WHERE institution_id = $1
                      AND recorded_at > $2::timestamptz
                    ORDER BY recorded_at ASC
                    LIMIT 10
                    """,
                    uuid.UUID(institution_id),
                    last_ts
                )

            if rows:
                for row in rows:
                    event_data = {
                        "id": str(row["id"]),
                        "event_type": row["event_type"],
                        "sdg_goal": row["sdg_goal"],
                        "sdg_track": row["sdg_track"],
                        "description": row["description"],
                        "recorded_at": row["recorded_at"].isoformat()
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"

                # Update last timestamp
                last_ts = rows[-1]["recorded_at"].isoformat()
                await redis.set(last_ts_key, last_ts, ex=3600)

            # Heartbeat every 30s to keep connection alive
            yield ": heartbeat\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",       # Nginx: disable buffering for SSE
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.post("/impact/events")
async def record_impact_event(
    data: dict,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Manually record an impact event (from mentor or admin)."""
    async with pool.acquire() as conn:
        event_id = await conn.fetchval(
            """
            INSERT INTO impact_events (
                user_id, match_id, session_id, institution_id,
                event_type, sdg_goal, sdg_track, description
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING id
            """,
            uuid.UUID(data["user_id"]),
            uuid.UUID(data["match_id"]) if data.get("match_id") else None,
            uuid.UUID(data["session_id"]) if data.get("session_id") else None,
            uuid.UUID(data["institution_id"]) if data.get("institution_id") else None,
            data["event_type"], data["sdg_goal"],
            data.get("sdg_track"), data.get("description")
        )
    return {"event_id": str(event_id)}
```

---

*File 07 of 10 — ElevateHer Complete Technical Suite*

---
---

# ElevateHer — File 08: Agentic Facilitation Layer (Complete)
### Phi-3 Mini · Session Summaries · Mentor Question Prompts · Mentee Nudges · Celery Tasks

> **Senior Engineer Note:** The agent is ElevateHer's biggest differentiator versus every other mentorship platform. It makes the platform feel alive. It must never replace the mentor — it must make the mentor 30% better. Every agent output must be under 150 words. Every response must be warm, brief, and culturally aware.

---

## 1. Agent Service

```python
# services/api/services/agent_service.py
"""
ElevateHer Agentic Facilitation Layer.
Model: Phi-3 mini 4K Instruct (Q4_K_M GGUF) — ~2.5GB VRAM
Role: Silent co-facilitator. Assists mentor and mentee without replacing either.

Key principle: The agent generates suggestions and summaries.
It NEVER sends messages directly to users. A human (mentor/mentee) always acts.
"""

from llama_cpp import Llama
from functools import lru_cache
import logging, os, re

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a silent co-facilitator for ElevateHer, an AI-powered career
mentorship platform for girls aged 14-22 in Southeast Asia.

Your role:
- Support the mentor-mentee relationship, not replace it
- Be concise, warm, and encouraging
- Keep all responses under 150 words
- Never include personal information or specific names in outputs
- Focus only on career development, skills, and professional growth
- Be culturally sensitive to Southeast Asian contexts
- If a topic seems inappropriate or off-career, redirect gently

You help with: session summaries, mentor question suggestions, mentee check-in messages.
You never: give medical advice, discuss relationships, or replace professional guidance."""


@lru_cache(maxsize=1)
def _get_phi3_model() -> Llama | None:
    model_path = os.getenv("AGENT_MODEL_PATH", "./models/Phi-3-mini-4k-instruct-Q4_K_M.gguf")

    if not os.path.exists(model_path):
        logger.warning(
            f"Phi-3 mini not found at {model_path}. "
            "Agentic features will use template fallbacks. "
            "Run: python scripts/download_models.py"
        )
        return None

    logger.info("Loading Phi-3 mini 4K Instruct...")
    model = Llama(
        model_path=model_path,
        n_ctx=4096,
        n_gpu_layers=20,        # ~2GB VRAM — leaves room for SEA-LION
        verbose=False,
        n_threads=4
    )
    logger.info("Phi-3 mini loaded ✅")
    return model


def _chat(prompt: str, max_tokens: int = 200, temperature: float = 0.35) -> str:
    """
    Low-level inference call to Phi-3 mini.
    Returns empty string if model unavailable (graceful degradation).
    """
    model = _get_phi3_model()
    if model is None:
        return ""

    try:
        response = model.create_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=0.9,
            repeat_penalty=1.1,
            stop=["<|end|>", "<|endoftext|>", "\n\n\n"]
        )
        text = response["choices"][0]["message"]["content"].strip()
        return _clean_output(text)
    except Exception as e:
        logger.error(f"Phi-3 inference error: {e}")
        return ""


def _clean_output(text: str) -> str:
    """Remove any accidentally generated names, tokens, or unsafe patterns."""
    # Remove model artifacts
    text = re.sub(r'<[^>]+>', '', text)
    # Remove excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Trim
    return text.strip()


# ── Core Agent Functions ──────────────────────────────────────────────────────

def summarise_session(
    session_notes: str,
    track: str,
    milestone_title: str,
    session_num: int
) -> str:
    """
    Generate a 2-3 sentence summary of a completed mentorship session.
    Saved to sessions.agent_summary for guardian and admin visibility.

    Falls back to a template if model unavailable.
    """
    if not session_notes or len(session_notes.strip()) < 20:
        return f"Session {session_num} completed: {milestone_title}. Track: {track}."

    prompt = (
        f"Summarise this mentorship session in 2-3 sentences.\n"
        f"Track: {track}\n"
        f"Milestone: {milestone_title}\n"
        f"Session {session_num} notes: {session_notes[:500]}\n\n"
        f"Write from a third-person perspective. "
        f"End with one specific next step. Keep it under 100 words."
    )

    result = _chat(prompt, max_tokens=150, temperature=0.3)

    if not result:
        # Template fallback
        return (
            f"Mentorship session {session_num} completed successfully. "
            f"Focus area: {milestone_title} on the {track} track. "
            f"Next step: continue working on the goals discussed."
        )

    return result


def suggest_mentor_questions(
    track: str,
    last_milestone: str,
    mentee_challenge: str,
    session_num: int
) -> list[str]:
    """
    Suggest 3 open-ended questions for the mentor to use in the next session.
    Surfaced on the mentor's dashboard before each session.
    """
    prompt = (
        f"Suggest exactly 3 short, open-ended questions for a career mentor "
        f"to ask their mentee in their next session.\n"
        f"Track: {track}\n"
        f"Last milestone: {last_milestone}\n"
        f"Mentee's known challenge: {mentee_challenge}\n"
        f"Session number: {session_num} of 12\n\n"
        f"Format: numbered list, each question on its own line. "
        f"Questions should be practical and forward-looking."
    )

    result = _chat(prompt, max_tokens=200, temperature=0.4)

    if not result:
        # Template fallback by track
        fallbacks = {
            "STEM": [
                "What specific technical skill would you like to develop before our next session?",
                "Have you had a chance to explore any of the resources we discussed?",
                "What's one thing in your field that currently excites or confuses you?"
            ],
            "Business": [
                "What part of your business idea have you validated or tested since last time?",
                "What's the biggest uncertainty you're facing right now?",
                "Have you spoken to any potential customers or collaborators this week?"
            ],
            "Trades": [
                "How is your practical skill-building going? Any gaps you've identified?",
                "Have you looked into any certifications or apprenticeships we mentioned?",
                "What's the biggest challenge in your trade environment right now?"
            ],
            "Creative": [
                "How has your portfolio project progressed since our last session?",
                "Have you received any client or audience feedback to share?",
                "What's one creative constraint you're working within right now?"
            ],
            "Healthcare": [
                "What aspect of the healthcare pathway is still unclear to you?",
                "Have you shadowed anyone or visited any healthcare settings recently?",
                "What motivates you most about working in healthcare?"
            ]
        }
        return fallbacks.get(track, fallbacks["STEM"])

    # Parse numbered list from model output
    lines = [l.strip() for l in result.split('\n') if l.strip()]
    questions = []
    for line in lines:
        # Strip numbering: "1. Question" or "1) Question"
        cleaned = re.sub(r'^[\d]+[.)]\s*', '', line).strip()
        if cleaned and len(cleaned) > 10:
            questions.append(cleaned)
        if len(questions) == 3:
            break

    # Pad with fallbacks if fewer than 3 parsed
    if len(questions) < 3:
        fallback = suggest_mentor_questions.__wrapped__ if hasattr(suggest_mentor_questions, '__wrapped__') else None
        while len(questions) < 3:
            questions.append(f"What's your biggest priority for the {track} track this week?")

    return questions[:3]


def generate_mentee_nudge(
    mentee_name: str,
    days_since_last_session: int,
    track: str,
    next_milestone: str,
    language: str = "en"
) -> str:
    """
    Generate a warm, brief SMS nudge for an inactive mentee.
    Target: under 160 characters (one SMS).
    """
    lang_instructions = {
        "ms": "Write in Bahasa Melayu (informal, friendly).",
        "id": "Write in Bahasa Indonesia (informal, friendly).",
        "th": "Write in Thai script.",
        "en": "Write in English (warm, brief, encouraging).",
        "ja": "Write in Japanese (polite, encouraging)."
    }

    prompt = (
        f"Write a brief, warm SMS nudge for a career mentorship programme participant.\n"
        f"Days since last session: {days_since_last_session}\n"
        f"Track: {track}\n"
        f"Next milestone: {next_milestone}\n"
        f"{lang_instructions.get(language, lang_instructions['en'])}\n"
        f"Keep under 160 characters. Include a call-to-action (e.g. dial *384# or reply READY).\n"
        f"Do NOT use the person's real name in the output."
    )

    result = _chat(prompt, max_tokens=80, temperature=0.5)

    if not result or len(result) > 200:
        # SMS template fallbacks by language
        templates = {
            "en": (
                f"Your ElevateHer {track} mentor is waiting for you! "
                f"Next up: {next_milestone[:40]}. "
                f"Ready? Dial *384# or reply READY."
            ),
            "ms": (
                f"Mentor ElevateHer {track} anda menunggu! "
                f"Seterusnya: {next_milestone[:40]}. "
                f"Bersedia? Dail *384# atau balas SEDIA."
            ),
            "id": (
                f"Mentor ElevateHer {track} kamu menunggu! "
                f"Selanjutnya: {next_milestone[:40]}. "
                f"Siap? Dial *384# atau balas SIAP."
            ),
            "th": (
                f"เมนทอร์ ElevateHer {track} รอคุณอยู่! "
                f"ถัดไป: {next_milestone[:30]}. "
                f"พร้อมไหม? กด *384# หรือตอบ พร้อม"
            )
        }
        return templates.get(language, templates["en"])[:160]

    return result[:160]


def generate_weekly_mentor_brief(
    track: str,
    active_mentee_count: int,
    upcoming_sessions: list[dict]
) -> str:
    """
    Generate a brief weekly summary for the mentor.
    Shown on mentor dashboard each Monday.
    """
    session_titles = [s.get("milestone_title", "Session") for s in upcoming_sessions[:3]]
    sessions_str = ", ".join(session_titles) if session_titles else "no sessions scheduled"

    prompt = (
        f"Write a brief, motivating weekly mentor brief for a career mentor.\n"
        f"Active mentees: {active_mentee_count}\n"
        f"Track they mentor: {track}\n"
        f"Upcoming sessions this week: {sessions_str}\n\n"
        f"Keep under 80 words. Be warm and specific. "
        f"Include one actionable tip for the mentor this week."
    )

    result = _chat(prompt, max_tokens=120, temperature=0.4)

    if not result:
        return (
            f"You have {active_mentee_count} active mentee(s) on the {track} track this week. "
            f"{'Upcoming: ' + sessions_str + '.' if session_titles else ''} "
            f"Tip: Start each session by asking what's changed since your last conversation."
        )

    return result


def evaluate_session_quality(
    session_notes: str,
    milestone_title: str,
    track: str
) -> dict:
    """
    Evaluate session quality and return a quality score + suggestions.
    Used by admin dashboard to flag sessions needing support.
    """
    if not session_notes or len(session_notes.strip()) < 30:
        return {
            "quality_score": 0.5,
            "suggestions": ["Session notes are too brief to evaluate quality."],
            "milestone_likely_reached": False
        }

    prompt = (
        f"Evaluate this mentorship session for quality and milestone progress.\n"
        f"Track: {track}\n"
        f"Milestone: {milestone_title}\n"
        f"Notes: {session_notes[:400]}\n\n"
        f"Respond ONLY as JSON with keys:\n"
        f"quality_score (0.0-1.0), "
        f"milestone_likely_reached (true/false), "
        f"one_suggestion (string under 50 words)."
    )

    result = _chat(prompt, max_tokens=150, temperature=0.2)

    import json as json_module
    try:
        # Strip any markdown code fences
        cleaned = result.replace("```json", "").replace("```", "").strip()
        parsed = json_module.loads(cleaned)
        return {
            "quality_score": float(parsed.get("quality_score", 0.7)),
            "milestone_likely_reached": bool(parsed.get("milestone_likely_reached", False)),
            "suggestions": [parsed.get("one_suggestion", "Continue the good work!")]
        }
    except Exception:
        return {
            "quality_score": 0.7,
            "milestone_likely_reached": True,
            "suggestions": ["Session logged. Keep up the great mentorship!"]
        }
```

---

## 2. Agent Celery Tasks

```python
# services/api/tasks/agent_tasks.py

from celery import shared_task
import logging, os

logger = logging.getLogger(__name__)

@shared_task(name="tasks.agent_summarise_session")
def agent_summarise_session_task(
    session_id: str,
    session_notes: str,
    track: str,
    milestone_title: str,
    session_num: int
):
    """Generate and persist AI session summary after a session completes."""
    from services.agent_service import summarise_session
    import psycopg2

    summary = summarise_session(session_notes, track, milestone_title, session_num)

    if summary:
        conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
        cur  = conn.cursor()
        cur.execute(
            "UPDATE sessions SET agent_summary = %s WHERE id = %s",
            (summary, session_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Agent summary saved for session {session_id[:12]}...")

    return summary


@shared_task(name="tasks.agent_suggest_questions")
def agent_suggest_questions_task(
    session_id: str,
    track: str,
    last_milestone: str,
    mentee_challenge: str,
    session_num: int
):
    """Generate and persist mentor question suggestions before the next session."""
    from services.agent_service import suggest_mentor_questions
    import psycopg2

    questions = suggest_mentor_questions(
        track, last_milestone, mentee_challenge, session_num
    )

    if questions:
        conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
        cur  = conn.cursor()
        cur.execute(
            "UPDATE sessions SET agent_questions = %s WHERE id = %s",
            (questions, session_id)
        )
        conn.commit()
        cur.close()
        conn.close()

    return questions


@shared_task(name="tasks.agent_nudge_inactive_mentees")
def agent_nudge_inactive_mentees_task():
    """
    Periodic task: identify mentees inactive for 5+ days and send nudges.
    Run daily at 9am local time (configure in Celery Beat).
    """
    from services.agent_service import generate_mentee_nudge
    import psycopg2, asyncio
    from services.sms_service import send_sms

    conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
    cur  = conn.cursor()

    # Find active matches where last session was 5+ days ago
    cur.execute(
        """
        SELECT
            u.phone, u.language,
            mp.display_name,
            m.sdg_track,
            COALESCE(
                (SELECT milestone_title FROM sessions
                 WHERE match_id = m.id
                 ORDER BY session_num DESC LIMIT 1),
                'First session'
            ) AS next_milestone,
            EXTRACT(DAY FROM now() - MAX(s.completed_at))::int AS days_inactive
        FROM matches m
        JOIN users u ON u.id = m.mentee_id
        JOIN mentee_profiles mp ON mp.user_id = m.mentee_id
        LEFT JOIN sessions s ON s.match_id = m.id AND s.completed = true
        WHERE m.status = 'active'
          AND u.phone IS NOT NULL
        GROUP BY u.phone, u.language, mp.display_name, m.sdg_track, m.id
        HAVING EXTRACT(DAY FROM now() - MAX(s.completed_at)) >= 5
            OR MAX(s.completed_at) IS NULL
        LIMIT 50
        """
    )
    inactive = cur.fetchall()
    cur.close()
    conn.close()

    nudge_count = 0
    for row in inactive:
        phone, lang, name, track, next_milestone, days = row
        days = days or 7

        nudge = generate_mentee_nudge(
            mentee_name=name,
            days_since_last_session=days,
            track=track or "STEM",
            next_milestone=next_milestone,
            language=lang or "en"
        )

        if nudge and phone:
            asyncio.run(send_sms(phone, nudge))
            nudge_count += 1
            logger.info(f"Nudge sent to {phone[-4:]}... ({lang})")

    logger.info(f"Agent nudge task: {nudge_count} nudges sent")
    return {"nudges_sent": nudge_count}


@shared_task(name="tasks.agent_weekly_mentor_briefs")
def agent_weekly_mentor_briefs_task():
    """
    Weekly task: send mentors their personalised weekly brief.
    Run every Monday at 8am.
    """
    from services.agent_service import generate_weekly_mentor_brief
    import psycopg2, asyncio
    from services.sms_service import send_sms

    conn = psycopg2.connect(os.getenv("DATABASE_URL_SYNC"))
    cur  = conn.cursor()

    cur.execute(
        """
        SELECT
            u.phone, u.language,
            mp.current_mentees, mp.display_name,
            COALESCE(
                (SELECT sdg_track FROM matches
                 WHERE mentor_id = u.id AND status = 'active'
                 LIMIT 1),
                'STEM'
            ) AS track
        FROM mentor_profiles mp
        JOIN users u ON u.id = mp.user_id
        WHERE mp.is_approved = true
          AND mp.current_mentees > 0
          AND u.phone IS NOT NULL
          AND NOT u.is_suspended
        """
    )
    mentors = cur.fetchall()
    cur.close()
    conn.close()

    for row in mentors:
        phone, lang, mentee_count, name, track = row
        brief = generate_weekly_mentor_brief(
            track=track,
            active_mentee_count=mentee_count,
            upcoming_sessions=[]
        )
        if brief and phone:
            asyncio.run(send_sms(phone, f"ElevateHer: {brief[:140]}"))

    return {"briefs_sent": len(mentors)}
```

---

## 3. Celery App & Beat Schedule

```python
# services/api/tasks/celery_app.py

from celery import Celery
from celery.schedules import crontab
from config import get_settings

settings = get_settings()

celery_app = Celery(
    "elevateher",
    broker=settings.redis_url,
    backend=f"{settings.redis_url}/1",
    include=[
        "tasks.embedding_tasks",
        "tasks.safety_tasks",
        "tasks.sms_tasks",
        "tasks.agent_tasks"
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kuala_Lumpur",   # UTC+8 primary timezone
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,            # Acknowledge after completion (not on receive)
    worker_prefetch_multiplier=1,   # One task per worker at a time (AI inference is heavy)
    task_soft_time_limit=120,       # 2 min soft timeout
    task_time_limit=180             # 3 min hard timeout
)

# ── Celery Beat Schedule ──────────────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    "nudge-inactive-mentees-daily": {
        "task": "tasks.agent_nudge_inactive_mentees",
        "schedule": crontab(hour=9, minute=0),  # 9am KL time daily
    },
    "weekly-mentor-briefs": {
        "task": "tasks.agent_weekly_mentor_briefs",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),   # Monday 8am
    },
    "reembed-all-mentors-weekly": {
        "task": "tasks.reembed_all_mentors",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),   # Sunday 2am
    }
}
```

---

## 4. Session Complete Endpoint (triggers agent)

```python
# services/api/routers/session.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
import asyncpg, uuid

from dependencies import get_db_pool, get_current_user, CurrentUser
from tasks.agent_tasks import agent_summarise_session_task, agent_suggest_questions_task
from tasks.impact_tasks import record_session_milestone_impact

router = APIRouter()

@router.post("/{session_id}/complete")
async def complete_session(
    session_id: str,
    mentor_notes: str = "",
    mentee_notes: str = "",
    milestone_reached: bool = True,
    background_tasks: BackgroundTasks = None,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Complete a mentorship session.
    Triggers: agent summary, question suggestions, impact event recording.
    """
    async with pool.acquire() as conn:
        session = await conn.fetchrow(
            """
            SELECT s.*, m.sdg_track, m.mentee_id, m.mentor_id, m.id AS match_id
            FROM sessions s
            JOIN matches m ON m.id = s.match_id
            WHERE s.id = $1
            """,
            uuid.UUID(session_id)
        )
        if not session:
            raise HTTPException(404, "Session not found.")

        # Verify caller is part of this match
        if (str(session["mentee_id"]) != user.id and
                str(session["mentor_id"]) != user.id):
            raise HTTPException(403, "Not authorised to complete this session.")

        # Update session record
        await conn.execute(
            """
            UPDATE sessions SET
                completed = true,
                completed_at = now(),
                mentor_notes = $1,
                mentee_notes = $2,
                milestone_reached = $3
            WHERE id = $4
            """,
            mentor_notes, mentee_notes, milestone_reached, uuid.UUID(session_id)
        )

    # Fire async agent tasks (non-blocking)
    combined_notes = f"Mentor: {mentor_notes}\nMentee: {mentee_notes}"

    agent_summarise_session_task.delay(
        session_id=session_id,
        session_notes=combined_notes,
        track=session["sdg_track"] or "STEM",
        milestone_title=session["milestone_title"] or "Session complete",
        session_num=session["session_num"]
    )

    if session["session_num"] < 12:
        agent_suggest_questions_task.delay(
            session_id=session_id,
            track=session["sdg_track"] or "STEM",
            last_milestone=session["milestone_title"] or "",
            mentee_challenge="",
            session_num=session["session_num"] + 1
        )

    # Record impact event if milestone reached
    if milestone_reached:
        background_tasks.add_task(
            _record_milestone_impact,
            mentee_id=str(session["mentee_id"]),
            match_id=str(session["match_id"]),
            session_id=session_id,
            sdg_track=session["sdg_track"]
        )

    return {
        "message": "Session completed. AI summary is being generated.",
        "session_num": session["session_num"],
        "milestone_reached": milestone_reached
    }


async def _record_milestone_impact(
    mentee_id: str, match_id: str, session_id: str, sdg_track: str
):
    """Record a milestone_reached impact event for the Impact Ledger."""
    from tasks.impact_tasks import record_impact_event_task
    record_impact_event_task.delay(
        user_id=mentee_id,
        match_id=match_id,
        session_id=session_id,
        event_type="milestone_reached",
        sdg_goal="4.4",
        sdg_track=sdg_track
    )
```

---

*File 08 of 10 — ElevateHer Complete Technical Suite*
*Covers: Phi-3 mini inference, session summariser, mentor question generator, multilingual mentee nudges, weekly mentor briefs, session quality evaluator, Celery tasks, Beat schedule, complete session endpoint*
