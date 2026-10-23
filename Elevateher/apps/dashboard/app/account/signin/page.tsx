'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardSignInPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      // If successful, dashboard_token cookie is now set
      // Redirect to the admin's subdomain
      if (data.subdomain) {
        window.location.href = `/${data.subdomain}/overview`;
      } else if (data.role === 'admin' || data.role === 'moderator') {
        // Fallback for global admins without an institution
        window.location.href = '/global/overview';
      } else {
        setError('No institution assigned to this account');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          width: 'min(100%, 420px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          background: 'rgba(15, 23, 42, 0.88)',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.35)',
          padding: 32,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#A78BFA' }}>
          Dashboard access
        </p>
        <h1 style={{ margin: '12px 0 24px', fontSize: 32, lineHeight: 1.05 }}>Sign in</h1>
        
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6, fontWeight: 500 }}>Email or Phone</label>
            <input 
              type="text" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, outline: 'none' }} 
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6, fontWeight: 500 }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, outline: 'none' }} 
              required 
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}
