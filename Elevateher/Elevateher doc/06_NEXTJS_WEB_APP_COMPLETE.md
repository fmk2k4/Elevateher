# ElevateHer — File 06: Next.js Web App (Complete)
### All Pages · Components · Auth Flows · Matching UI · Session Management · Mobile-First

> **Senior Engineer Note:** This is the mentee and mentor web interface. It must work on a 3G connection on a budget Android phone. Every component is server-side rendered by default. Images are lazy-loaded. No component exceeds 150KB. Accessibility is not optional — WCAG 2.1 AA is the baseline.

---

## 1. Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx                  # Root layout: fonts, providers, nav
│   ├── page.tsx                    # Landing page
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── guardian-consent/[token]/page.tsx
│   ├── (mentee)/
│   │   ├── layout.tsx              # Mentee shell layout
│   │   ├── onboarding/page.tsx     # 4-step onboarding
│   │   ├── dashboard/page.tsx      # Mentee home
│   │   ├── candidates/page.tsx     # Mentor candidates list
│   │   ├── matches/page.tsx        # My matches
│   │   └── session/[id]/page.tsx  # Live session + chat
│   ├── (mentor)/
│   │   ├── layout.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── my-mentees/page.tsx
│   │   └── session/[id]/page.tsx
│   └── (public)/
│       ├── about/page.tsx
│       └── safety/page.tsx
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── GuardianConsentBanner.tsx
│   ├── mentee/
│   │   ├── OnboardingWizard.tsx
│   │   ├── MentorCandidateCard.tsx
│   │   ├── MatchStatusBadge.tsx
│   │   └── ProgressTracker.tsx
│   ├── mentor/
│   │   ├── MentorProfileForm.tsx
│   │   ├── MenteeList.tsx
│   │   └── VerificationChecklist.tsx
│   ├── session/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── SessionMilestoneCard.tsx
│   │   └── SafetyReportButton.tsx
│   ├── shared/
│   │   ├── SDGTrackBadge.tsx
│   │   ├── LanguageBadge.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   └── ErrorBoundary.tsx
│   └── layout/
│       ├── Navbar.tsx
│       ├── MobileNav.tsx
│       └── Footer.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useMatches.ts
│   ├── useSession.ts
│   └── useSafeMessage.ts
├── lib/
│   ├── api.ts                      # Typed API client
│   ├── auth.ts                     # JWT helpers
│   └── constants.ts
├── public/
│   ├── icons/                      # SVG track icons
│   └── locales/                    # i18n JSON files
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 2. Root Layout & Providers

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter, Noto_Sans } from 'next/font/google'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

// Noto Sans covers Malay, Indonesian, Thai scripts
const notoSans = Noto_Sans({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'ElevateHer — Career Mentorship for Girls',
  description: 'AI-powered career mentorship for girls in Southeast Asia. Works offline via SMS.',
  keywords: ['career mentorship', 'girls', 'STEM', 'Southeast Asia', 'offline', 'SMS'],
  openGraph: {
    title: 'ElevateHer',
    description: 'Safe AI mentorship for every girl — even offline.',
    images: ['/og-image.png']
  },
  themeColor: '#7C3AED'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSans.variable}`}>
      <body className="bg-white text-slate-900 font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
```

---

## 3. API Client (Typed)

```typescript
// lib/api.ts
// Centralised, typed API client. Never call fetch() directly in components.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new APIError(res.status, body.message ?? res.statusText, body)
  }

  if (res.status === 204) return null as T
  return res.json()
}

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: object
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: RegisterRequest) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST', body: JSON.stringify(data)
    }),

  login: (data: LoginRequest) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST', body: JSON.stringify(data)
    }),

  refresh: (refreshToken: string) =>
    request<{ access_token: string; expires_in: number }>('/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refresh_token: refreshToken })
    })
}

// ── Mentee ─────────────────────────────────────────────────────────────────────
export const menteeAPI = {
  createProfile: (data: MenteeProfileCreate, token: string) =>
    request<MenteeProfile>('/mentee/profile', {
      method: 'POST', body: JSON.stringify(data), token
    }),

  getProfile: (token: string) =>
    request<MenteeProfile>('/mentee/profile', { token }),

  getCandidates: (token: string) =>
    request<{ candidates: MentorCandidate[] }>('/mentee/candidates', { token }),

  getMatches: (token: string) =>
    request<Match[]>('/mentee/matches', { token }),

  acceptMatch: (matchId: string, token: string) =>
    request<{ message: string }>(`/mentee/matches/${matchId}/accept`, {
      method: 'POST', token
    }),

  getSessions: (token: string) =>
    request<Session[]>('/mentee/sessions', { token })
}

// ── Mentor ─────────────────────────────────────────────────────────────────────
export const mentorAPI = {
  createProfile: (data: MentorProfileCreate, token: string) =>
    request<{ message: string; verification_status: string }>('/mentor/profile', {
      method: 'POST', body: JSON.stringify(data), token
    }),

  getMyMentees: (token: string) =>
    request<MenteeMatch[]>('/mentor/my-mentees', { token }),

  signCodeOfConduct: (token: string) =>
    request<{ message: string }>('/mentor/sign-code-of-conduct?agreed=true', {
      method: 'POST', token
    })
}

// ── Sessions / Messages ────────────────────────────────────────────────────────
export const sessionAPI = {
  sendMessage: (sessionId: string, content: string, token: string) =>
    request<{ message_id: string; status: string; risk_level: string }>(
      `/safety/message/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
        token
      }
    ),

  getMessages: (sessionId: string, token: string) =>
    request<SessionMessage[]>(`/session/${sessionId}/messages`, { token }),

  completeSession: (sessionId: string, data: SessionComplete, token: string) =>
    request<{ message: string }>(`/session/${sessionId}/complete`, {
      method: 'POST', body: JSON.stringify(data), token
    })
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RegisterRequest {
  email?: string
  phone?: string
  password: string
  role: 'mentee' | 'mentor'
  age?: number
  country: string
  language: string
  guardian_email?: string
  institution_code?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user_id: string
  role: string
}

export interface MenteeProfileCreate {
  full_name: string
  display_name?: string
  career_goals: string[]
  sdg_track: 'STEM' | 'Business' | 'Trades' | 'Creative' | 'Healthcare'
  current_education?: string
  preferred_languages: string[]
  challenges?: string[]
  bio_short?: string
}

export interface MentorCandidate {
  mentor_id: string
  mentor_name: string
  job_title: string
  industry: string
  years_exp: number
  languages: string[]
  match_score: number
  match_reason: string
  bio_preview: string
}

export interface Match {
  match_id: string
  mentor_name: string
  job_title: string
  industry: string
  match_score: number
  match_reason: string
  sdg_track: string
  status: string
  started_at: string | null
  sessions_count: number
}

export interface Session {
  id: string
  session_num: number
  channel: string
  milestone_title: string
  completed: boolean
  completed_at: string | null
  agent_summary: string | null
  scheduled_at: string | null
  sdg_track: string
}

export interface SessionMessage {
  id: string
  sender_role: 'mentor' | 'mentee' | 'system'
  content: string
  sent_at: string
  is_flagged: boolean
}
```

---

## 4. Auth Context & Hook

```typescript
// components/auth/AuthProvider.tsx
'use client'

import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode
} from 'react'
import { authAPI, TokenResponse } from '@/lib/api'

interface AuthState {
  accessToken: string | null
  userId: string | null
  role: string | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const TOKEN_KEY   = 'eh_access_token'
const REFRESH_KEY = 'eh_refresh_token'
const USER_KEY    = 'eh_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const user  = sessionStorage.getItem(USER_KEY)
    if (token && user) {
      const { userId: uid, role: r } = JSON.parse(user)
      setAccessToken(token)
      setUserId(uid)
      setRole(r)
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await authAPI.login({ identifier, password })
    _setSession(data)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(USER_KEY)
    setAccessToken(null)
    setUserId(null)
    setRole(null)
  }, [])

  const refreshToken = useCallback(async () => {
    const rt = sessionStorage.getItem(REFRESH_KEY)
    if (!rt) { logout(); return }
    try {
      const data = await authAPI.refresh(rt)
      sessionStorage.setItem(TOKEN_KEY, data.access_token)
      setAccessToken(data.access_token)
    } catch {
      logout()
    }
  }, [logout])

  function _setSession(data: TokenResponse) {
    sessionStorage.setItem(TOKEN_KEY, data.access_token)
    sessionStorage.setItem(REFRESH_KEY, data.refresh_token)
    sessionStorage.setItem(USER_KEY, JSON.stringify({ userId: data.user_id, role: data.role }))
    setAccessToken(data.access_token)
    setUserId(data.user_id)
    setRole(data.role)
  }

  return (
    <AuthContext.Provider value={{
      accessToken, userId, role, isLoading, login, logout, refreshToken
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

---

## 5. Registration Form

```typescript
// components/auth/RegisterForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { authAPI, APIError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

const COUNTRIES = [
  { code: 'MY', name: 'Malaysia' }, { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' }, { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },    { code: 'GB', name: 'United Kingdom' }
]

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'id', name: 'Bahasa Indonesia' }, { code: 'th', name: 'Thai' },
  { code: 'ja', name: 'Japanese' }
]

export function RegisterForm({ role }: { role: 'mentee' | 'mentor' }) {
  const router = useRouter()
  const { login } = useAuth()

  const [form, setForm] = useState({
    email: '', phone: '', password: '', country: 'MY',
    language: 'en', age: '', guardian_email: '', institution_code: ''
  })
  const [usePhone, setUsePhone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isMinor = form.age !== '' && parseInt(form.age) < 18

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authAPI.register({
        email: usePhone ? undefined : form.email,
        phone: usePhone ? form.phone : undefined,
        password: form.password,
        role,
        age: form.age ? parseInt(form.age) : undefined,
        country: form.country,
        language: form.language,
        guardian_email: isMinor ? form.guardian_email : undefined,
        institution_code: form.institution_code || undefined
      })

      if (!usePhone) {
        await login(form.email, form.password)
        router.push(role === 'mentee' ? '/mentee/onboarding' : '/mentor/onboarding')
      } else {
        router.push('/auth/login?registered=1')
      }
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Toggle between email and phone */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
        <button type="button"
          onClick={() => setUsePhone(false)}
          className={`flex-1 py-2 text-sm rounded-md transition-all ${
            !usePhone ? 'bg-white shadow font-medium' : 'text-slate-500'
          }`}>
          Email
        </button>
        <button type="button"
          onClick={() => setUsePhone(true)}
          className={`flex-1 py-2 text-sm rounded-md transition-all ${
            usePhone ? 'bg-white shadow font-medium' : 'text-slate-500'
          }`}>
          Phone (SMS only)
        </button>
      </div>

      {!usePhone ? (
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" required
            value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="you@example.com" className="mt-1" />
        </div>
      ) : (
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" type="tel"
            value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="+60123456789 (include country code)" className="mt-1" />
          <p className="text-xs text-slate-500 mt-1">
            SMS/USSD access only. Works on basic feature phones.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required minLength={8}
          value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
          placeholder="At least 8 characters" className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Country</Label>
          <Select value={form.country} onValueChange={v => setForm(p => ({ ...p, country: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Language</Label>
          <Select value={form.language} onValueChange={v => setForm(p => ({ ...p, language: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => (
                <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="age">Age <span className="text-slate-400 text-xs">(optional)</span></Label>
        <Input id="age" type="number" min={10} max={100}
          value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
          placeholder="Your age" className="mt-1 w-32" />
      </div>

      {/* Guardian consent for minors */}
      {isMinor && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-sm">
            <strong>Guardian consent required.</strong> Because you are under 18, a parent or
            guardian must approve your account. We'll send them an email.
            <div className="mt-2">
              <Label htmlFor="guardian_email">Guardian's email address</Label>
              <Input id="guardian_email" type="email" required
                value={form.guardian_email}
                onChange={e => setForm(p => ({ ...p, guardian_email: e.target.value }))}
                placeholder="parent@example.com" className="mt-1" />
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="institution_code">
          Institution code <span className="text-slate-400 text-xs">(optional)</span>
        </Label>
        <Input id="institution_code" type="text"
          value={form.institution_code}
          onChange={e => setForm(p => ({ ...p, institution_code: e.target.value }))}
          placeholder="e.g. inti, nyp, binus" className="mt-1" />
        <p className="text-xs text-slate-500 mt-1">
          If your school or university is a GoGlobal partner, enter their code.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700"
        disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-xs text-center text-slate-500">
        By signing up, you agree to our{' '}
        <a href="/safety" className="underline">Safety Policy</a> and{' '}
        <a href="/privacy" className="underline">Privacy Notice</a>.
        ElevateHer is free for learners. Always.
      </p>
    </form>
  )
}
```

---

## 6. Mentee Onboarding Wizard

```typescript
// app/(mentee)/onboarding/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { menteeAPI } from '@/lib/api'
import { Button } from '@/components/ui/button'

const TRACKS = [
  { id: 'STEM',       icon: '🔬', label: 'STEM',           desc: 'Science, Tech, Engineering, Math' },
  { id: 'Business',   icon: '💼', label: 'Business',        desc: 'Entrepreneurship, Management, Finance' },
  { id: 'Trades',     icon: '🔧', label: 'Skilled Trades',  desc: 'Technical skills, Vocational, Crafts' },
  { id: 'Creative',   icon: '🎨', label: 'Creative',        desc: 'Design, Media, Arts, Content' },
  { id: 'Healthcare', icon: '🏥', label: 'Healthcare',      desc: 'Nursing, Allied Health, Medicine' }
]

const CHALLENGES = [
  { id: 'family_pressure',   label: 'Family pressure or expectations' },
  { id: 'no_role_models',    label: 'No female role models in my field' },
  { id: 'no_network',        label: 'No professional network' },
  { id: 'language_barrier',  label: 'Language barrier' },
  { id: 'cost',              label: 'Financial constraints' },
  { id: 'safety_concerns',   label: 'Safety concerns on other platforms' },
  { id: 'cultural_norms',    label: 'Cultural or gender norms' }
]

const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'id', label: 'Bahasa Indonesia' }, { code: 'th', label: 'Thai' },
  { code: 'ja', label: 'Japanese' }
]

export default function OnboardingPage() {
  const { accessToken } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    full_name: '', display_name: '', career_goals: [] as string[],
    sdg_track: '', current_education: '', preferred_languages: ['en'],
    challenges: [] as string[], bio_short: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleItem<K extends keyof typeof data>(
    key: K, value: string
  ) {
    setData(prev => {
      const arr = prev[key] as string[]
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
      }
    })
  }

  async function handleSubmit() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      await menteeAPI.createProfile({
        full_name: data.full_name,
        display_name: data.display_name || data.full_name.split(' ')[0],
        career_goals: data.career_goals.length > 0 ? data.career_goals : [data.sdg_track.toLowerCase()],
        sdg_track: data.sdg_track as any,
        current_education: data.current_education,
        preferred_languages: data.preferred_languages,
        challenges: data.challenges,
        bio_short: data.bio_short
      }, accessToken)
      router.push('/mentee/candidates')
    } catch {
      setError('Could not save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    {
      title: 'Your name',
      valid: data.full_name.length >= 2,
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Full name</label>
            <input className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:ring-2 focus:ring-violet-500 focus:outline-none"
              placeholder="e.g. Aisha Rahman"
              value={data.full_name}
              onChange={e => setData(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">
              Display name <span className="text-slate-400 font-normal">(how mentors see you)</span>
            </label>
            <input className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:ring-2 focus:ring-violet-500 focus:outline-none"
              placeholder="First name is fine, e.g. Aisha"
              value={data.display_name}
              onChange={e => setData(p => ({ ...p, display_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Current education</label>
            <input className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:ring-2 focus:ring-violet-500 focus:outline-none"
              placeholder="e.g. Form 5, SMK Bukit Jalil"
              value={data.current_education}
              onChange={e => setData(p => ({ ...p, current_education: e.target.value }))} />
          </div>
        </div>
      )
    },
    {
      title: 'Your career track',
      valid: data.sdg_track !== '',
      content: (
        <div className="grid grid-cols-1 gap-3">
          {TRACKS.map(track => (
            <button key={track.id} type="button"
              onClick={() => setData(p => ({ ...p, sdg_track: track.id }))}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                data.sdg_track === track.id
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 hover:border-violet-200'
              }`}>
              <span className="text-3xl">{track.icon}</span>
              <div>
                <p className="font-semibold text-slate-900">{track.label}</p>
                <p className="text-sm text-slate-500">{track.desc}</p>
              </div>
              {data.sdg_track === track.id && (
                <span className="ml-auto text-violet-600">✓</span>
              )}
            </button>
          ))}
        </div>
      )
    },
    {
      title: 'Languages you speak',
      valid: data.preferred_languages.length > 0,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            We'll match you with mentors who speak your language.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(lang => (
              <button key={lang.code} type="button"
                onClick={() => toggleItem('preferred_languages', lang.code)}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                  data.preferred_languages.includes(lang.code)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-slate-200 text-slate-700 hover:border-violet-300'
                }`}>
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'What challenges do you face?',
      valid: true,
      content: (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Select all that apply. This helps us find the right mentor.</p>
          {CHALLENGES.map(ch => (
            <button key={ch.id} type="button"
              onClick={() => toggleItem('challenges', ch.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-all ${
                data.challenges.includes(ch.id)
                  ? 'border-violet-400 bg-violet-50 text-violet-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}>
              <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                data.challenges.includes(ch.id) ? 'border-violet-500 bg-violet-500' : 'border-slate-300'
              }`}>
                {data.challenges.includes(ch.id) && <span className="text-white text-xs">✓</span>}
              </span>
              {ch.label}
            </button>
          ))}
        </div>
      )
    }
  ]

  const current = steps[step - 1]
  const progress = (step / steps.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Step {step} of {steps.length}</span>
            <span className="text-sm font-medium text-violet-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-violet-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">{current.title}</h1>
        </div>

        {/* Step content */}
        <div className="mb-8">{current.content}</div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" className="flex-1"
              onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          <Button
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            disabled={!current.valid || loading}
            onClick={step === steps.length ? handleSubmit : () => setStep(s => s + 1)}>
            {loading ? 'Saving…' : step === steps.length ? 'Find my mentor' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## 7. Mentor Candidate Cards

```typescript
// components/mentee/MentorCandidateCard.tsx
'use client'

import { MentorCandidate } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const TRACK_COLORS: Record<string, string> = {
  STEM:       'bg-blue-100 text-blue-800',
  Business:   'bg-amber-100 text-amber-800',
  Trades:     'bg-orange-100 text-orange-800',
  Creative:   'bg-pink-100 text-pink-800',
  Healthcare: 'bg-green-100 text-green-800'
}

function MatchScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const circumference = 2 * Math.PI * 20
  const dash = (circumference * pct) / 100

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
        <circle cx="24" cy="24" r="20" fill="none"
          stroke="#E2E8F0" strokeWidth="4" />
        <circle cx="24" cy="24" r="20" fill="none"
          stroke="#7C3AED" strokeWidth="4"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center
        text-sm font-bold text-violet-700">
        {pct}%
      </span>
    </div>
  )
}

interface Props {
  candidate: MentorCandidate
  onSelect: (mentorId: string) => void
  isLoading?: boolean
}

export function MentorCandidateCard({ candidate, onSelect, isLoading }: Props) {
  return (
    <article className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm
      hover:shadow-md hover:border-violet-200 transition-all">
      <div className="flex gap-4">
        {/* Avatar placeholder */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-pink-400
          flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {candidate.mentor_name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{candidate.mentor_name}</h3>
              <p className="text-sm text-slate-600">
                {candidate.job_title} · {candidate.industry}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {candidate.years_exp} years experience
              </p>
            </div>
            <MatchScoreRing score={candidate.match_score} />
          </div>

          {/* Match reason */}
          <div className="mt-3 flex items-start gap-2 p-3 bg-violet-50 rounded-xl">
            <span className="text-violet-500 flex-shrink-0">✦</span>
            <p className="text-sm text-violet-800 italic">{candidate.match_reason}</p>
          </div>

          {/* Bio preview */}
          <p className="mt-3 text-sm text-slate-600 line-clamp-2">{candidate.bio_preview}</p>

          {/* Languages */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {candidate.languages.map(lang => (
              <Badge key={lang} variant="outline" className="text-xs">
                {lang.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Button
        className="w-full mt-4 bg-violet-600 hover:bg-violet-700"
        onClick={() => onSelect(candidate.mentor_id)}
        disabled={isLoading}>
        {isLoading ? 'Sending request…' : 'Request this mentor'}
      </Button>
    </article>
  )
}
```

---

## 8. Chat Window (Session Messages)

```typescript
// components/session/ChatWindow.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { sessionAPI, SessionMessage } from '@/lib/api'
import { MessageBubble } from './MessageBubble'
import { SafetyReportButton } from './SafetyReportButton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ChatWindowProps {
  sessionId: string
  matchId: string
  currentUserRole: 'mentor' | 'mentee'
  otherPartyName: string
  milestoneTitle: string
}

export function ChatWindow({
  sessionId, matchId, currentUserRole, otherPartyName, milestoneTitle
}: ChatWindowProps) {
  const { accessToken, userId } = useAuth()
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [safetyWarning, setSafetyWarning] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load messages
  useEffect(() => {
    if (!accessToken) return
    sessionAPI.getMessages(sessionId, accessToken)
      .then(setMessages)
      .catch(() => setError('Could not load messages.'))
  }, [sessionId, accessToken])

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!draft.trim() || !accessToken || sending) return

    const text = draft.trim()
    setDraft('')
    setSending(true)
    setError('')
    setSafetyWarning('')

    try {
      const result = await sessionAPI.sendMessage(sessionId, text, accessToken)

      // Add optimistic message
      const optimistic: SessionMessage = {
        id: result.message_id,
        sender_role: currentUserRole,
        content: text,
        sent_at: new Date().toISOString(),
        is_flagged: result.flagged ?? false
      }
      setMessages(prev => [...prev, optimistic])

      if (result.risk_level === 'HIGH' || result.risk_level === 'CRITICAL') {
        setSafetyWarning(
          'A safety concern was detected in this conversation. ' +
          'Our moderation team has been notified.'
        )
      }
    } catch (err: any) {
      if (err.status === 403) {
        setError(
          'This message could not be sent due to our safety guidelines. ' +
          'Please review our community standards.'
        )
        setDraft(text)   // Restore draft so user can edit
      } else {
        setError('Message could not be sent. Please try again.')
        setDraft(text)
      }
    } finally {
      setSending(false)
    }
  }, [draft, accessToken, sending, sessionId, currentUserRole])

  // Keyboard shortcut: Enter to send, Shift+Enter for new line
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900">{otherPartyName}</p>
          <p className="text-xs text-slate-500">📍 {milestoneTitle}</p>
        </div>
        <SafetyReportButton reportedName={otherPartyName} matchId={matchId} />
      </div>

      {/* Safety warning */}
      {safetyWarning && (
        <Alert className="mx-4 mt-2 border-amber-200 bg-amber-50">
          <AlertDescription className="text-sm text-amber-800">
            ⚠️ {safetyWarning}
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">👋</p>
            <p className="text-slate-500 text-sm">
              Say hello to {otherPartyName}! This is the start of your mentorship journey.
            </p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_role === currentUserRole}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Input area */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2 items-end">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl
              border-slate-200 focus:ring-2 focus:ring-violet-500"
            rows={1}
          />
          <Button
            onClick={sendMessage}
            disabled={!draft.trim() || sending}
            className="h-11 w-11 p-0 rounded-xl bg-violet-600 hover:bg-violet-700 flex-shrink-0">
            {sending ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          All messages are moderated for safety. Keep conversations career-focused.
        </p>
      </div>
    </div>
  )
}


// components/session/MessageBubble.tsx
import { SessionMessage } from '@/lib/api'

export function MessageBubble({
  message, isOwn
}: { message: SessionMessage; isOwn: boolean }) {
  const time = new Date(message.sent_at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
        isOwn
          ? 'bg-violet-600 text-white rounded-br-sm'
          : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div className={`flex items-center gap-1 mt-1 ${
          isOwn ? 'justify-end' : 'justify-start'
        }`}>
          <span className={`text-xs ${isOwn ? 'text-violet-200' : 'text-slate-400'}`}>
            {time}
          </span>
          {message.is_flagged && (
            <span className="text-xs text-amber-400" title="Flagged for review">⚠</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## 9. Progress Tracker Component

```typescript
// components/mentee/ProgressTracker.tsx

interface Milestone {
  week: number
  title: string
  sdg_tag: string
  reached?: boolean
}

interface ProgressTrackerProps {
  track: string
  milestones: Milestone[]
  currentSession: number
  totalSessions: number
}

export function ProgressTracker({
  track, milestones, currentSession, totalSessions
}: ProgressTrackerProps) {
  const pct = Math.round((currentSession / 12) * 100)

  const SDG_COLORS: Record<string, string> = {
    '4.4': 'bg-blue-100 text-blue-800',
    '5.5': 'bg-pink-100 text-pink-800',
    '8.6': 'bg-green-100 text-green-800'
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">{track} Track Progress</h3>
          <p className="text-sm text-slate-500">Session {currentSession} of 12</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-violet-600">{pct}%</span>
          <p className="text-xs text-slate-500">complete</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full
          transition-all duration-700"
          style={{ width: `${pct}%` }} />
      </div>

      {/* Milestones */}
      <div className="space-y-2">
        {milestones.map((m, i) => {
          const done = m.reached || m.week <= Math.floor(currentSession * 12 / totalSessions)
          return (
            <div key={i}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                done ? 'bg-violet-50' : 'bg-slate-50'
              }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center
                flex-shrink-0 text-xs font-bold ${
                done ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {done ? '✓' : m.week}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  done ? 'text-violet-900' : 'text-slate-600'
                }`}>{m.title}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                SDG_COLORS[m.sdg_tag] || 'bg-gray-100 text-gray-700'
              }`}>
                SDG {m.sdg_tag}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

---

## 10. next.config.ts & package.json

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
            "font-src 'self' fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "connect-src 'self' " + process.env.NEXT_PUBLIC_API_URL
          ].join('; ')
        }
      ]
    }]
  },

  // Image optimisation
  images: {
    domains: ['supabase.co'],
    formats: ['image/webp', 'image/avif']
  },

  // Bundle optimisation for low-bandwidth
  experimental: {
    optimizeCss: true
  },

  // Compress responses
  compress: true
}

export default nextConfig
```

```json
// apps/web/package.json
{
  "name": "@elevateher/web",
  "version": "2.0.0",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^3.4.15",
    "@radix-ui/react-alert-dialog": "^1.1.2",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-badge": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "lucide-react": "^0.468.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.7.2",
    "eslint": "^9.15.0",
    "eslint-config-next": "14.2.18",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20"
  }
}
```

---

*File 06 of 10 — ElevateHer Complete Technical Suite*
*Covers: Full Next.js app structure, typed API client, AuthProvider, RegisterForm, OnboardingWizard, MentorCandidateCard, ChatWindow, MessageBubble, ProgressTracker, next.config.ts, package.json*
