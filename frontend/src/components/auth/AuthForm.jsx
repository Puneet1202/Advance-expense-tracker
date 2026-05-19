import { useState } from 'react';
import api from '../../api/axios';

export default function AuthForm({ onLoginSuccess }) {
  const [tab, setTab]     = useState('login');
  const [form, setForm]   = useState({ name: '', email: '', password: '' });
  const [msg, setMsg]     = useState('');
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setLoading(true);
    try {
      if (tab === 'login') {
        const r = await api.post('/auth/login', { email: form.email, password: form.password });
        await onLoginSuccess(r.data);
      } else {
        const r = await api.post('/auth/register', form);
        setMsg(r.data.message);
        setTimeout(() => { setTab('login'); setMsg(''); }, 2200);
      }
    } catch (e) {
      setErr(e.response?.data?.message || 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1.5rem', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '-15%', right: '-10%', width: '520px', height: '520px',
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(91,91,214,0.09) 0%, transparent 65%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-8%', width: '380px', height: '380px',
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(52,199,89,0.06) 0%, transparent 65%)'
      }} />

      <div className="anim-up" style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '18px', margin: '0 auto 1.25rem',
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', boxShadow: '0 8px 28px var(--accent-glow)', transition: 'transform 0.3s ease'
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08) rotate(-3deg)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'}
          >💳</div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em', marginBottom: '6px' }}>
            Expense<span style={{ color: 'var(--accent)' }}>Tracker</span>
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>
            {tab === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{
            display: 'flex', background: 'var(--bg-3)', borderRadius: '12px',
            padding: '4px', gap: '4px', marginBottom: '1.75rem', border: '1px solid var(--border)'
          }}>
            {['login', 'register'].map(t => (
              <button key={t} type="button" onClick={() => { setTab(t); setMsg(''); setErr(''); }} style={{
                flex: 1, padding: '9px 0', borderRadius: '9px', border: 'none',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                background: tab === t ? 'var(--surface)' : 'transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-3)',
                boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
              }}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {msg && <div style={{ marginBottom: '1rem', padding: '11px 14px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: '10px', color: 'var(--green)', fontSize: '0.84rem' }}>✓ {msg}</div>}
          {err && <div style={{ marginBottom: '1rem', padding: '11px 14px', background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '10px', color: 'var(--red)', fontSize: '0.84rem' }}>⚠ {err}</div>}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {tab === 'register' && (
              <Label label="Full Name">
                <input className="field" type="text" placeholder="Puneet Kumar"
                  value={form.name} onChange={e => set('name', e.target.value)} required />
              </Label>
            )}
            <Label label="Email">
              <input className="field" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </Label>
            <Label label="Password">
              <input className="field" type="password" placeholder="••••••••"
                value={form.password} onChange={e => set('password', e.target.value)} required />
            </Label>
            <button type="submit" className="btn btn-accent" disabled={loading}
              style={{ width: '100%', padding: '13px', fontSize: '0.9rem', marginTop: '4px', borderRadius: '12px', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          {tab === 'login' && (
            <p style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: '0.78rem', marginTop: '1.25rem' }}>
              Demo: <span style={{ color: 'var(--accent)', fontWeight: 500 }}>demo@demo.com</span> / <span style={{ color: 'var(--accent)', fontWeight: 500 }}>demo123</span>
            </p>
          )}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Secured with end-to-end encryption 🔒
        </p>
      </div>
    </div>
  );
}

function Label({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}