'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useInstitution } from './InstitutionProvider';

const NAV = [
  { href: 'overview', icon: '⊞', label: 'Overview' },
  { href: 'impact', icon: '⚡', label: 'Impact Ledger', badge: 'LIVE' },
  { href: 'safety', icon: '🛡️', label: 'Safety & Trust' },
  { href: 'matches', icon: '🤝', label: 'Matches' },
  { href: 'mentees', icon: '👩‍🎓', label: 'Mentees' },
  { href: 'mentors', icon: '👩‍💼', label: 'Mentors' },
  { href: 'analytics', icon: '📊', label: 'Analytics' },
  { href: 'reports', icon: '📄', label: 'Reports' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { subdomain } = useInstitution();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((s) => !s)}
        aria-label="Toggle navigation menu"
        aria-expanded={mobileOpen}
        aria-controls="primary-nav"
        className="dashboard-mobile-toggle"
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 60,
          padding: '8px 12px',
          borderRadius: 6,
          background: '#0F172A',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          display: 'none',
        }}
      >
        ☰ Menu
      </button>
      <aside
        role="navigation"
        aria-label="Primary"
        id="primary-nav"
        style={{
          width: 240,
          background: '#0F172A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
        className={`dashboard-sidebar ${mobileOpen ? 'is-open' : ''}`}
      >
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Link
            href={`/${subdomain}/overview`}
            aria-label="ElevateHer dashboard home"
            style={{ display: 'inline-block' }}
          >
            <Image src="/logo_new.svg" alt="ElevateHer Logo" width={180} height={72} style={{ height: 72, width: 'auto' }} priority />
          </Link>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              marginTop: 4,
            }}
          >
            Institution Dashboard
          </div>
        </div>

        <nav aria-label="Dashboard sections" style={{ flex: 1, padding: '12px 8px' }}>
          {NAV.map((item) => {
            const active =
              pathname?.endsWith(item.href) ||
              (item.href === 'overview' && pathname === `/${subdomain}`);
            return (
              <Link
                key={item.href}
                href={`/${subdomain}/${item.href}`}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  color: active ? '#A78BFA' : 'rgba(255,255,255,0.65)',
                  background: active
                    ? 'rgba(124,58,237,0.12)'
                    : 'transparent',
                  textDecoration: 'none',
                  marginBottom: 2,
                  transition: 'all 0.15s',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 16 }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    aria-label="Live updates enabled"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(34,197,94,0.15)',
                      color: '#22C55E',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            textAlign: 'center',
          }}
        >
          ElevateHer v2.0 · GoGlobal 2026
        </div>
      </aside>
      {mobileOpen && (
        <div
          role="presentation"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 45,
            display: 'none',
          }}
          className="dashboard-backdrop"
        />
      )}
    </>
  );
}
