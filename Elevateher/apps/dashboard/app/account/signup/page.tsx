import Link from 'next/link';

export default function DashboardSignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #0B1120 0%, #111827 100%)',
        color: '#E5E7EB',
        padding: 24,
      }}
    >
      <section
        style={{
          width: 'min(100%, 520px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          background: 'rgba(15, 23, 42, 0.88)',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.35)',
          padding: 32,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#22C55E' }}>
          Create access
        </p>
        <h1 style={{ margin: '12px 0 10px', fontSize: 36, lineHeight: 1.05 }}>Request dashboard access</h1>
        <p style={{ margin: 0, color: '#94A3B8', lineHeight: 1.6 }}>
          New mentors, staff, and partners should register through the public web app first. Dashboard access is granted after approval.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '0 18px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Dashboard home
          </Link>
          <span style={{ alignSelf: 'center', color: '#94A3B8', fontSize: 14 }}>Web app signup lives on the public site.</span>
        </div>
      </section>
    </main>
  );
}
