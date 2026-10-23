'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInstitution } from './InstitutionProvider';

export function TopBar() {
  const pathname = usePathname();
  const { institution, subdomain } = useInstitution();
  const pageTitle = pathname?.split('/').pop() || 'overview';

  return (
    <header
      role="banner"
      style={{
        height: 56,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(15,23,42,0.8)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1
          id="page-title"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            margin: 0,
          }}
        >
          {pageTitle === subdomain || pageTitle === 'overview'
            ? 'Overview'
            : pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1)}
        </h1>
        {institution && (
          <span
            aria-label={`Institution: ${institution.name}`}
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {institution.name}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <time
          dateTime={new Date().toISOString().split('T')[0]}
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          {new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </time>
        <div
          role="img"
          aria-label="User avatar"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          AD
        </div>
      </div>
    </header>
  );
}
