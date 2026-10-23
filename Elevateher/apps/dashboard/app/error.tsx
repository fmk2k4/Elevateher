'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
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
          background: 'rgba(239,68,68,0.1)',
          border: '2px solid rgba(239,68,68,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <span style={{ fontSize: 28 }} aria-hidden="true">⚠️</span>
      </div>

      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: '#EC4899',
          margin: '0 0 8px',
          textAlign: 'center',
        }}
      >
        Something went wrong
      </h1>

      <p
        style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.6)',
          margin: '0 0 16px',
          textAlign: 'center',
          maxWidth: 400,
        }}
      >
        We encountered an error loading this page. Please try again.
      </p>

      {error.digest && (
        <p
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.3)',
            margin: '0 0 16px',
            fontFamily: 'monospace',
          }}
          aria-label="Error reference ID"
        >
          Reference: {error.digest}
        </p>
      )}

      <button
        onClick={reset}
        aria-label="Try to recover from this error"
        style={{
          marginTop: 8,
          padding: '12px 24px',
          background: '#EC4899',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#DB2777';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#EC4899';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
        }}
      >
        Try again
      </button>
    </div>
  );
}