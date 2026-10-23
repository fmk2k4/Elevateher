'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      role="main"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: '#fff',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(167,139,250,0.1)',
          border: '2px solid rgba(167,139,250,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <span style={{ fontSize: 28 }} aria-hidden="true">🔍</span>
      </div>

      <h1
        style={{
          fontSize: 72,
          fontWeight: 900,
          background: 'linear-gradient(135deg, #A78BFA, #EC4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 8px',
          lineHeight: 1,
        }}
      >
        404
      </h1>

      <p
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          margin: '0 0 8px',
        }}
      >
        Page not found
      </p>

      <p
        style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 24px',
          textAlign: 'center',
          maxWidth: 360,
        }}
      >
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 24px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color: '#A78BFA',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 600,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(167,139,250,0.1)';
          e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        }}
      >
        <span aria-hidden="true">←</span>
        Return to dashboard
      </Link>
    </div>
  );
}