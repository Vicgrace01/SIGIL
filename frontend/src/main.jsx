import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { PollarProvider, usePollar } from '@pollar/react';
import '@pollar/react/styles.css';
import './sigil.css';
import './DemoStory.jsx';

const cfg = window.SIGIL_CONFIG || {};

async function api(path, body, method = 'GET') {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}
const post = (p, b) => api(p, b, 'POST');

const AVATAR_COLORS = [
  { from: '#32BDFF', to: '#1E7CFE' }, { from: '#FF2D9B', to: '#B61A6D' },
  { from: '#B6FF3C', to: '#7AC41F' }, { from: '#FFB340', to: '#E07B00' },
  { from: '#A855F7', to: '#7C3AED' }, { from: '#4ADE80', to: '#16A34A' },
];
const avatarGradient = (seed) => {
  const c = AVATAR_COLORS[seed] || AVATAR_COLORS[0];
  return `linear-gradient(135deg, ${c.from}, ${c.to})`;
};
const initialsOf = (name) => (name || 'S').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

const Icon = ({ name, size = 16 }) => {
  const paths = {
    seal: 'M12 2L21 7V17L12 22L3 17V7L12 2Z M12 5L18 8.5V15.5L12 19L6 15.5V8.5L12 5Z',
    check: 'M4 12l5 5L20 6', arrowRight: 'M9 6l6 6-6 6', plus: 'M12 5v14M5 12h14',
    external: 'M14 4h6v6M20 4l-9 9M10 4H4v16h16v-6',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    copy: 'M8 8V5a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2h-3M5 8h9a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2z',
    close: 'M18 6L6 18M6 6l12 12',
    wallet: 'M3 6h18v14H3zM3 10h18M16 15h2',
    shield: 'M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4zM9 12l2 2 4-4',
    sparkle: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.check} />
    </svg>
  );
};

function Modal({ title, subtitle, children, onClose }) {
  return createPortal(
    <div className="sg-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sg-dialog">
        <button className="sg-close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        <h2>{title}</h2>
        {subtitle && <p style={{ color: '#8A8AA3', fontSize: '.88rem', marginBottom: 20 }}>{subtitle}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
}

function App({ placeholderEl }) {
  if (!cfg.pollarKey) return <div style={{ padding: 48, color: '#FF2D9B', fontFamily: 'monospace' }}>⚠ POLLAR_PUBLISHABLE_KEY not set</div>;
  return (
    <PollarProvider client={{ apiKey: cfg.pollarKey, stellarNetwork: cfg.network || 'testnet' }}>
      <SigilRoot placeholderEl={placeholderEl} />
    </PollarProvider>
  );
}

function SigilRoot({ placeholderEl }) {
  const pollar = usePollar();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pendingEstateId, setPendingEstateId] = useState(null);

  const reloadUser = useCallback(async () => {
    const r = await api('/api/me');
    const u = r.data.user;
    setUser(u);
    if (u) {
      const e = await api('/api/estates');
      setNeedsOnboarding((e.data.estates || []).length === 0);
    } else {
      setNeedsOnboarding(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { reloadUser(); }, [reloadUser]);

  // ─── FULL-APP MODE ────────────────────────────────────────
  // When authenticated, hide the landing page chrome and give
  // the #app section the full viewport. Logout returns to landing.
  useEffect(() => {
    if (user) document.body.classList.add('in-app');
    else document.body.classList.remove('in-app');
    return () => document.body.classList.remove('in-app');
  }, [user]);

  useEffect(() => {
    if (pollar.isAuthenticated && pollar.wallet?.address && user) {
      post('/api/me/wallet', { wallet_address: pollar.wallet.address });
    }
  }, [pollar.isAuthenticated, pollar.wallet?.address, user]);

  useEffect(() => {
    const onLogout = () => { reloadUser(); try { pollar.logout(); } catch {} };
    window.addEventListener('sigil:logout', onLogout);
    return () => window.removeEventListener('sigil:logout', onLogout);
  }, [pollar, reloadUser]);

  const navRoot = document.getElementById('sigil-root');
  function handleOnboardComplete(estateId) {
    setPendingEstateId(estateId || null);
    reloadUser();
  }

  return (
    <>
      {navRoot && createPortal(<WalletButton user={user} onUserReload={reloadUser} />, navRoot)}
      {placeholderEl && createPortal(
        <div className="sg-app">
          {loading ? <LoadingScreen /> :
            !user ? <AuthScreen onAuth={reloadUser} /> :
            needsOnboarding ? <OnboardingWizard user={user} onComplete={handleOnboardComplete} /> :
            <Dashboard user={user} onLogout={reloadUser} initialEstateId={pendingEstateId} onConsumedInitial={() => setPendingEstateId(null)} />}
        </div>,
        placeholderEl
      )}
    </>
  );
}

/* ═══════════════ ONBOARDING (6 steps) ═══════════════ */
function OnboardingWizard({ user, onComplete }) {
  const pollar = usePollar();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user.name || '');
  const [avatarSeed, setAvatarSeed] = useState(user.avatar_seed ?? 0);
  const [path, setPath] = useState(null);
  const [estateName, setEstateName] = useState('');
  const [monthly, setMonthly] = useState('500');
  const [expected, setExpected] = useState('5');
  const [joinId, setJoinId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [agentLimit, setAgentLimit] = useState('500');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [agentEnabled, setAgentEnabled] = useState(false);

  async function saveProfile() {
    if (!name || name.trim().length < 2) { setErr('Name must be at least 2 characters'); return; }
    setBusy(true); setErr('');
    const r = await post('/api/me/profile', { name: name.trim(), avatar_seed: avatarSeed });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || 'Failed'); return; }
    setStep(2);
  }

  async function createEstate() {
    if (!estateName.trim()) { setErr('Enter an estate name'); return; }
    setBusy(true); setErr('');
    const r = await post('/api/estates', {
      name: estateName.trim(), monthly_usd: parseInt(monthly, 10),
      expected_residents: parseInt(expected, 10),
    });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || 'Failed'); return; }
    setResult({ type: 'create', estate_id: r.data.estate_id, invite_code: r.data.invite_code });
    setStep(4);
  }

  async function joinEstate() {
    setBusy(true); setErr('');
    const r = await post(`/api/estates/${joinId}/join`, { invite_code: joinCode.trim() });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || 'Failed'); return; }
    setResult({ type: 'join', estate_id: parseInt(joinId, 10) });
    setStep(4);
  }

  async function enableAgent() {
    if (!result) return;
    setBusy(true); setErr('');
    const r = await post(`/api/estates/${result.estate_id}/agent/enable`, { monthly_limit_cents: parseInt(agentLimit, 10) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || 'Failed'); return; }
    setAgentEnabled(true);
    setStep(6);
  }

  function skipAgent() { setAgentEnabled(false); setStep(6); }
  function enterEstate() { onComplete(result.estate_id); }

  const initials = initialsOf(name);

  return (
    <div className="sg-onboard">
      <div className="sg-onboard-progress">
        {[1, 2, 3, 4, 5, 6].map(n => (
          <div key={n} className={`dot ${n < step ? 'done' : n === step ? 'active' : ''}`}>
            {n < step ? '✓' : n}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="sg-onboard-step">
          <div className="step-tag">Step 1 of 6 · Your profile</div>
          <h2>What should we call you?</h2>
          <div className="avatar-preview">
            <div className="big-avatar" style={{ background: avatarGradient(avatarSeed) }}>{initials || 'S'}</div>
          </div>
          <label className="sg-label">Your name</label>
          <input className="sg-input" value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="Ada Obi" autoFocus />
          <label className="sg-label">Avatar colour</label>
          <div className="color-picker">
            {AVATAR_COLORS.map((c, i) => (
              <button key={i} type="button" className={`color-swatch ${i === avatarSeed ? 'active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }} onClick={() => setAvatarSeed(i)} />
            ))}
          </div>
          {err && <div className="sg-status sg-error">{err}</div>}
          <button className="sg-btn" onClick={saveProfile} disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>
            {busy ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="sg-onboard-step">
          <div className="step-tag">Step 2 of 6 · Choose your role</div>
          <h2>Are you starting an estate or joining one?</h2>
          <div className="path-cards">
            <button type="button" className="path-card" onClick={() => { setPath('create'); setStep(3); }}>
              <div className="path-icon"><Icon name="plus" size={28} /></div>
              <h3>Create estate</h3>
              <p>Start fresh. You become the first officer.</p>
              <span className="path-cta">Create →</span>
            </button>
            <button type="button" className="path-card" onClick={() => { setPath('join'); setStep(3); }}>
              <div className="path-icon"><Icon name="user" size={28} /></div>
              <h3>Join estate</h3>
              <p>Enter an invite code from an existing member.</p>
              <span className="path-cta">Join →</span>
            </button>
          </div>
          <button type="button" className="sg-btn ghost" onClick={() => setStep(1)}>← Back</button>
        </div>
      )}

      {step === 3 && path === 'create' && (
        <div className="sg-onboard-step">
          <div className="step-tag">Step 3 of 6 · Estate details</div>
          <h2>Set up your estate</h2>
          <label className="sg-label">Estate name</label>
          <input className="sg-input" value={estateName} onChange={e => { setEstateName(e.target.value); setErr(''); }} placeholder="Lekki Phase 1 Residents Association" autoFocus />
          <label className="sg-label">How many residents will pay?</label>
          <input className="sg-input" type="number" value={expected} onChange={e => setExpected(e.target.value)} min="1" max="200" />
          <label className="sg-label">Monthly contribution per resident (cents)</label>
          <input className="sg-input" type="number" value={monthly} onChange={e => setMonthly(e.target.value)} min="10" max="100000" />
          <p style={{ fontSize: '.78rem', color: '#8A8AA3', marginBottom: 14 }}>
            ${((parseInt(monthly, 10) || 0) / 100).toFixed(2)}/resident · {expected} residents · ${((parseInt(monthly, 10) || 0) * (parseInt(expected, 10) || 0) / 100).toFixed(2)}/month total
          </p>
          {err && <div className="sg-status sg-error">{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="sg-btn ghost" onClick={() => setStep(2)} style={{ flex: 1, justifyContent: 'center' }}>← Back</button>
            <button className="sg-btn" onClick={createEstate} disabled={busy || !estateName.trim()} style={{ flex: 2, justifyContent: 'center' }}>
              {busy ? 'Creating…' : 'Create estate →'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && path === 'join' && (
        <div className="sg-onboard-step">
          <div className="step-tag">Step 3 of 6 · Join estate</div>
          <h2>Enter your invite</h2>
          <label className="sg-label">Estate ID</label>
          <input className="sg-input" type="number" value={joinId} onChange={e => { setJoinId(e.target.value); setErr(''); }} placeholder="1" autoFocus />
          <label className="sg-label">Invite code</label>
          <input className="sg-input" value={joinCode} onChange={e => { setJoinCode(e.target.value.toUpperCase()); setErr(''); }} placeholder="SG-A1B2C3" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
          {err && <div className="sg-status sg-error">{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="sg-btn ghost" onClick={() => setStep(2)} style={{ flex: 1, justifyContent: 'center' }}>← Back</button>
            <button className="sg-btn" onClick={joinEstate} disabled={busy || !joinId || !joinCode.trim()} style={{ flex: 2, justifyContent: 'center' }}>
              {busy ? 'Joining…' : 'Join estate →'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="sg-onboard-step">
          <div className="step-tag">Step 4 of 6 · Connect wallet</div>
          <h2>Connect a Pollar wallet</h2>
          <div className="wallet-status-card">
            {!pollar.isAuthenticated ? (
              <>
                <div className="wallet-status-icon dim"><Icon name="wallet" size={32} /></div>
                <div className="wallet-status-label">No wallet connected</div>
                <button className="sg-btn" onClick={() => pollar.openLoginModal()} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
                  Connect Pollar →
                </button>
              </>
            ) : (
              <>
                <div className="wallet-status-icon active"><Icon name="check" size={32} /></div>
                <div className="wallet-status-label">Wallet connected</div>
                <span className="sg-mono" style={{ fontSize: 10, marginTop: 8 }}>{pollar.wallet?.address}</span>
                <button className="sg-btn" onClick={() => setStep(5)} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
                  Continue →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="sg-onboard-step">
          <div className="step-tag">Step 5 of 6 · Optional</div>
          <h2>Enable the auto-pay agent?</h2>
          <label className="sg-label">Monthly limit (cents)</label>
          <input className="sg-input" type="number" value={agentLimit} onChange={e => setAgentLimit(e.target.value)} min="100" max="100000" />
          <p style={{ fontSize: '.78rem', color: '#8A8AA3', marginBottom: 14 }}>
            ${((parseInt(agentLimit, 10) || 0) / 100).toFixed(2)} maximum per month
          </p>
          {err && <div className="sg-status sg-error">{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="sg-btn ghost" onClick={skipAgent} style={{ flex: 1, justifyContent: 'center' }}>Skip</button>
            <button className="sg-btn lime" onClick={enableAgent} disabled={busy} style={{ flex: 2, justifyContent: 'center' }}>
              {busy ? 'Enabling…' : 'Enable agent →'}
            </button>
          </div>
        </div>
      )}

      {step === 6 && result && (
        <div className="sg-onboard-step">
          <div className="step-tag">Step 6 of 6 · Done</div>
          <h2>{result.type === 'create' ? "You're the first officer" : 'Welcome to the estate'}</h2>
          {result.type === 'create' && (
            <div className="invite-display">
              <span className="sg-label">Invite code</span>
              <div className="invite-code-big">{result.invite_code}</div>
              <div className="invite-meta">Estate ID: <strong>{result.estate_id}</strong></div>
            </div>
          )}
          <div className="onboard-summary">
            <div className="row"><span className="k">Wallet</span><span className="v" style={{ color: '#B6FF3C' }}>✓ Connected</span></div>
            <div className="row"><span className="k">Agent</span><span className="v" style={{ color: agentEnabled ? '#B6FF3C' : '#8A8AA3' }}>{agentEnabled ? '✓ Enabled' : 'Skipped'}</span></div>
            <div className="row"><span className="k">Estate</span><span className="v">✓ {result.type === 'create' ? 'Created' : 'Joined'}</span></div>
          </div>
          <button className="sg-btn" onClick={enterEstate} style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}>
            Enter estate →
          </button>
        </div>
      )}
    </div>
  );
}

function WalletButton({ user, onUserReload }) {
  const { isAuthenticated, wallet, openLoginModal, openWalletBalanceModal, logout } = usePollar();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const short = wallet?.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-5)}` : '';
  const initials = initialsOf(user?.name);

  useEffect(() => { setMenuOpen(false); }, [user?.id]);
  useEffect(() => {
    if (!menuOpen) return;
    function onDocDown(e) {
      if (menuRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    try { await post('/api/logout'); } catch {}
    try { await logout(); } catch {}
    window.dispatchEvent(new CustomEvent('sigil:logout'));
    onUserReload?.();
  }

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
      {!isAuthenticated ? (
        <button className="sg-nav-btn" type="button" onClick={openLoginModal}>Connect Pollar</button>
      ) : (
        <button className="sg-nav-btn connected" type="button" onClick={openWalletBalanceModal} title={wallet?.address}>
          <span className="sg-spin-seal" style={{ background: '#B6FF3C', width: 10, height: 10 }}></span>
          {short || 'Pollar wallet'}
        </button>
      )}
      {user && (
        <button ref={btnRef} className="sg-profile-btn" type="button" onClick={() => setMenuOpen(v => !v)} title={user.email}>
          <span className="sg-avatar" style={{ background: avatarGradient(user.avatar_seed ?? 0) }}>{initials}</span>
        </button>
      )}
      {menuOpen && user && (
        <div ref={menuRef} className="sg-profile-menu">
          <div className="head"><div className="name">{user.name}</div><div className="email">{user.email}</div></div>
          <button type="button" onClick={() => { setProfileOpen(true); setMenuOpen(false); }}><Icon name="user" size={14} /> Profile</button>
          <button type="button" onClick={handleSignOut}><Icon name="logout" size={14} /> Sign out</button>
        </div>
      )}
      {profileOpen && user && <ProfileModal user={user} onClose={() => setProfileOpen(false)} onSaved={onUserReload} />}
    </div>
  );
}

function ProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name);
  const [avatarSeed, setAvatarSeed] = useState(user.avatar_seed ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const initials = initialsOf(name);
  async function save() {
    setBusy(true); setErr('');
    const r = await post('/api/me/profile', { name: name.trim(), avatar_seed: avatarSeed });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast('Profile updated');
    onSaved?.(); onClose();
  }
  return (
    <Modal title="Edit profile" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="big-avatar" style={{ background: avatarGradient(avatarSeed), width: 72, height: 72, fontSize: '1.6rem' }}>{initials}</div>
        </div>
        <div><span className="sg-label">Name</span><input className="sg-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div>
          <span className="sg-label">Avatar colour</span>
          <div className="color-picker">
            {AVATAR_COLORS.map((c, i) => (
              <button key={i} type="button" className={`color-swatch ${i === avatarSeed ? 'active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }} onClick={() => setAvatarSeed(i)} />
            ))}
          </div>
        </div>
        <div><span className="sg-label">Email</span><div style={{ padding: '10px 14px', background: '#171724', border: '1px solid rgba(50,189,255,.15)', borderRadius: 2, color: '#8A8AA3' }}>{user.email}</div></div>
        {err && <div className="sg-status sg-error">{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="sg-btn ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
          <button className="sg-btn" onClick={save} disabled={busy} style={{ flex: 2, justifyContent: 'center' }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}

function LoadingScreen() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <div className="sg-spin-seal" style={{ width: 44, height: 44, background: '#32BDFF' }}></div>
      <p style={{ marginTop: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: '.68rem', letterSpacing: '.18em', textTransform: 'uppercase', color: '#5A5A72' }}>
        Connecting to Sigil engine…
      </p>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    const r = await post(mode === 'register' ? '/api/register' : '/api/login', { name, email, password });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || 'Failed'); return; }
    onAuth();
  }
  return (
    <div className="sg-auth">
      <h2>Enter Sigil</h2>
      <p>Create an account, then we'll guide you through setting up your estate.</p>
      <div className="toggle">
        <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr(''); }}>Register</button>
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Sign in</button>
      </div>
      <form onSubmit={submit}>
        {mode === 'register' && <input className="sg-input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />}
        <input className="sg-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="sg-input" type="password" placeholder="Password (6+ chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        <button className="sg-btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'Working…' : (mode === 'register' ? 'Create account →' : 'Sign in →')}
        </button>
      </form>
      {err && <div className="sg-status sg-error">{err}</div>}
    </div>
  );
}

function Dashboard({ user, onLogout, initialEstateId, onConsumedInitial }) {
  const [estates, setEstates] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const reload = useCallback(async () => {
    const e = await api('/api/estates');
    setEstates(e.data.estates || []);
    if (currentId) {
      const d = await api(`/api/estates/${currentId}`);
      if (d.ok) setCurrent(d.data);
    }
  }, [currentId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (initialEstateId) { selectEstate(initialEstateId); onConsumedInitial?.(); }
  }, [initialEstateId]);

  async function selectEstate(id) {
    setCurrentId(id);
    const d = await api(`/api/estates/${id}`);
    if (d.ok) setCurrent(d.data);
  }

  if (current) return <EstateView current={current} user={user} reload={reload} onBack={() => { setCurrent(null); setCurrentId(null); }} onLogout={onLogout} />;

  return (
    <div style={{ padding: '32px 24px' }}>
      <div className="sg-app-header">
        <div>
          <h1>Welcome, {user.name.split(' ')[0]}</h1>
          <div className="sub">{estates.length} {estates.length === 1 ? 'estate' : 'estates'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className="sg-btn" onClick={() => setCreateOpen(true)}><Icon name="plus" size={14} /> New estate</button>
        <button className="sg-btn ghost" onClick={() => setJoinOpen(true)}>Join with invite</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        {estates.map(e => (
          <div key={e.id} className="sg-card" style={{ cursor: 'pointer' }} onClick={() => selectEstate(e.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{e.name}</h3>
              <span className={`sg-tag ${e.role === 'officer' ? 'lime' : ''}`}>{e.role}</span>
            </div>
            <div className="row"><span className="k">Monthly</span><span className="v">${(e.monthly_usd / 100).toFixed(2)}</span></div>
            <div className="row"><span className="k">Residents</span><span className="v">{e.expected_residents || 5}</span></div>
            <button className="sg-btn ghost sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>Open <Icon name="arrowRight" size={12} /></button>
          </div>
        ))}
      </div>
      {createOpen && <CreateEstateModal onClose={() => setCreateOpen(false)} onSuccess={async (d) => { setCreateOpen(false); window.sigilToast && window.sigilToast('Estate created'); await reload(); await selectEstate(d.estate_id); }} />}
      {joinOpen && <JoinEstateModal onClose={() => setJoinOpen(false)} onSuccess={async (eid) => { setJoinOpen(false); window.sigilToast && window.sigilToast('Joined'); await reload(); await selectEstate(eid); }} />}
    </div>
  );
}

function EstateView({ current, user, reload, onBack, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const isOfficer = current.role === 'officer';
  const myContribution = current.contributions.find(c => c.user_id === user.id);

  function copyInvite() {
    navigator.clipboard.writeText(current.estate.invite_code);
    setCopied(true);
    window.sigilToast && window.sigilToast('Invite code copied');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ padding: '8px 24px 32px' }}>
      <div className="sg-app-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button className="sg-btn ghost sm" onClick={onBack} style={{ padding: '4px 10px' }}>← All estates</button>
            <span className={`sg-tag ${isOfficer ? 'lime' : ''}`}>{current.role}</span>
          </div>
          <h1>{current.estate.name}</h1>
          <div className="sub">
            <button onClick={copyInvite} style={{ background: 'none', border: 'none', color: '#32BDFF', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '.72rem', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {current.estate.invite_code} <Icon name="copy" size={12} /> {copied ? 'copied' : 'copy'}
            </button>
            {' · '}{current.month}
          </div>
        </div>
      </div>

      <div className="sg-tabs">
        {['overview', 'proposals', 'members', 'ledger'].map(t => (
          <button key={t} className={`sg-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab current={current} user={user} reload={reload} myContribution={myContribution} isOfficer={isOfficer} />}
      {tab === 'proposals' && <ProposalsTab current={current} reload={reload} isOfficer={isOfficer} />}
      {tab === 'members' && <MembersTab current={current} reload={reload} isOfficer={isOfficer} />}
      {tab === 'ledger' && <LedgerTab current={current} />}
    </div>
  );
}

function OverviewTab({ current, user, reload, myContribution, isOfficer }) {
  const { isAuthenticated, openLoginModal, openEarnModal } = usePollar();
  const [treasury, setTreasury] = useState(null);
  const eid = current.estate.id;

  useEffect(() => {
    let mounted = true;
    async function fetchBalance() {
      const r = await post(`/api/estates/${eid}/treasury-balance`);
      if (mounted && r.ok) setTreasury(r.data);
    }
    fetchBalance();
    const iv = setInterval(fetchBalance, 15000);
    return () => { mounted = false; clearInterval(iv); };
  }, [eid]);

  const paidCount = current.contributions.filter(c => c.status === 'paid').length;
  const officers = current.members.filter(m => m.role === 'officer').length;
  const totalMembers = current.members.length;
  const expected = current.estate.expected_residents || 5;
  const pendingProposals = current.proposals.filter(p => p.status === 'pending' || p.status === 'ready').length;

  return (
    <div className="sg-grid">
      {!isAuthenticated && (
        <div className="sg-card span-2" style={{ borderColor: 'rgba(255,45,155,.4)', background: 'rgba(255,45,155,.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, marginBottom: 4, color: '#FF2D9B' }}>Connect your wallet</h3>
              <p style={{ fontSize: '.82rem', color: '#8A8AA3', margin: 0 }}>Pay contributions and sign payments.</p>
            </div>
            <button className="sg-btn" onClick={openLoginModal}>Connect Pollar →</button>
          </div>
        </div>
      )}

      <div className="sg-card highlight span-2">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ margin: 0, marginBottom: 8 }}>Treasury</h3>
            <div className="big-num">{treasury ? treasury.usdc : '—'}<small>USDC</small></div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.7rem', color: '#5A5A72', marginTop: 4 }}>
              {treasury ? `${treasury.xlm} XLM` : 'loading…'}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="sg-tag lime">{paidCount}/{expected} paid</span>
              <span className="sg-tag">{totalMembers} members</span>
              <span className={`sg-tag ${officers >= 2 ? 'lime' : 'pink'}`}>{officers}/2 officers</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="sg-label">Treasury address</span>
            <span className="sg-mono" style={{ maxWidth: 260, display: 'inline-block' }}>{cfg.treasury}</span>
            <div style={{ marginTop: 10 }}>
              <a href={`https://stellar.expert/explorer/testnet/account/${cfg.treasury}`} target="_blank" rel="noopener" className="sg-btn ghost sm" style={{ textDecoration: 'none' }}>
                <Icon name="external" size={12} /> Stellar Expert
              </a>
            </div>
          </div>
        </div>
      </div>

      <ContributionCard current={current} user={user} reload={reload} myContribution={myContribution} />
      <AgentCard current={current} user={user} reload={reload} />

      <div className="sg-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Yield (DeFindex)</h3>
          <span className="sg-tag">APY</span>
        </div>
        <div className="row"><span className="k">Vault</span><span className="v">DeFindex</span></div>
        <div className="row"><span className="k">Status</span><span className="v">Idle → earning</span></div>
        <button className="sg-btn ghost sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={openEarnModal}>
          Open Savings →
        </button>
      </div>

      <div className="sg-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Governance</h3>
          <span className={`sg-tag ${officers >= 2 ? 'lime' : 'pink'}`}>{officers}/2</span>
        </div>
        <div className="row"><span className="k">Officers</span><span className="v">{officers} of 2</span></div>
        <div className="row"><span className="k">Pending proposals</span><span className="v">{pendingProposals}</span></div>
        {officers >= 2
          ? <p style={{ fontSize: '.78rem', color: '#B6FF3C', marginTop: 14, margin: 0 }}>✓ Two-officer control active.</p>
          : <p style={{ fontSize: '.78rem', color: '#8A8AA3', marginTop: 14, margin: 0 }}>Promote a second resident to officer to enable 2-of-2.</p>
        }
      </div>
    </div>
  );
}

function ContributionCard({ current, user, reload, myContribution }) {
  const { runTx, isAuthenticated, verified, openLoginModal } = usePollar();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [err, setErr] = useState('');
  const eid = current.estate.id;
  const amountUsd = myContribution?.amount_usd || current.estate.monthly_usd;
  const paid = myContribution?.status === 'paid';

  async function pay() {
    if (!isAuthenticated) { openLoginModal(); return; }
    if (!verified) { setErr('Wallet still verifying. Retry.'); return; }
    setErr(''); setBusy(true); setStage('Preparing…');
    const prep = await post(`/api/estates/${eid}/contribution/prepare`);
    if (!prep.ok) { setBusy(false); setErr(prep.data.error); return; }
    const { contribution_id, amount_units, asset, memo } = prep.data;
    setStage('Approve in Pollar…');
    try {
      const outcome = await runTx('payment', { destination: cfg.treasury, amount: amount_units, asset }, { memo: { type: 'text', value: memo } });
      if (!outcome?.hash) throw new Error('No hash');
      setStage('Verifying on-chain…');
      for (let i = 0; i < 30; i++) {
        const conf = await post(`/api/contributions/${contribution_id}/confirm`, { tx_hash: outcome.hash });
        if (conf.ok) { setStage(''); setBusy(false); window.sigilToast && window.sigilToast('✓ Contribution paid'); reload(); return; }
        if (conf.data.error && !conf.data.error.includes('not indexed')) throw new Error(conf.data.error);
        await new Promise(r => setTimeout(r, 2000));
      }
      throw new Error('Timed out');
    } catch (e) { setErr(e.message || 'Failed'); setStage(''); setBusy(false); }
  }

  return (
    <div className="sg-card highlight">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Your contribution</h3>
        <span className={`sg-tag ${paid ? 'lime' : 'pink'}`}>{paid ? 'Paid' : 'Due'}</span>
      </div>
      <div className="big-num" style={{ fontSize: '2.4rem' }}>${(amountUsd / 100).toFixed(2)}</div>
      <div className="row" style={{ marginTop: 12 }}><span className="k">Month</span><span className="v">{current.month}</span></div>
      {paid ? (
        myContribution?.tx_hash && (
          <div style={{ marginTop: 12 }}>
            <span className="sg-label">Settled · tx</span>
            <span className="sg-mono" style={{ fontSize: 10 }}>{myContribution.tx_hash.slice(0, 32)}…</span>
          </div>
        )
      ) : (
        <button className="sg-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={pay} disabled={busy}>
          {busy ? (stage || 'Working…') : `Pay $${(amountUsd / 100).toFixed(2)} with Pollar →`}
        </button>
      )}
      {err && <div className="sg-status sg-error">{err}</div>}
    </div>
  );
}

function AgentCard({ current, user, reload }) {
  const [agent, setAgent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const eid = current.estate.id;

  useEffect(() => {
    async function load() { const r = await api(`/api/estates/${eid}/agent`); if (r.ok) setAgent(r.data.agent); }
    load();
  }, [eid, current]);

  async function run() {
    setBusy(true);
    const r = await post(`/api/estates/${eid}/agent/run`);
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast('✓ Agent paid your contribution');
    reload();
  }

  return (
    <div className="sg-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Auto-pay agent</h3>
        {agent?.enabled && <span className="sg-tag lime">Active</span>}
      </div>
      {agent?.enabled ? (
        <>
          <div className="row"><span className="k">Limit</span><span className="v">${(agent.monthly_limit_cents / 100).toFixed(2)}/mo</span></div>
          <button className="sg-btn lime sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={run} disabled={busy}>
            {busy ? 'Running…' : 'Run agent now →'}
          </button>
        </>
      ) : (
        <>
          <div className="row"><span className="k">Status</span><span className="v">Not enabled</span></div>
          <button className="sg-btn ghost sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={() => setModalOpen(true)}>
            Enable agent →
          </button>
        </>
      )}
      {err && <div className="sg-status sg-error">{err}</div>}
      {modalOpen && <AgentLimitModal eid={eid} onClose={() => setModalOpen(false)} onSuccess={() => { setModalOpen(false); setAgent({ enabled: true, monthly_limit_cents: 500 }); }} />}
    </div>
  );
}

function AgentLimitModal({ eid, onClose, onSuccess }) {
  const [limit, setLimit] = useState('500');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const r = await post(`/api/estates/${eid}/agent/enable`, { monthly_limit_cents: parseInt(limit, 10) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast('Agent enabled');
    onSuccess();
  }
  return (
    <Modal title="Enable auto-pay" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="sg-label">Monthly limit (cents)</label>
        <input className="sg-input" type="number" value={limit} onChange={e => setLimit(e.target.value)} min="100" max="100000" required autoFocus />
        <p style={{ fontSize: '.78rem', color: '#8A8AA3', marginBottom: 14 }}>${((parseInt(limit, 10) || 0) / 100).toFixed(2)} maximum per month</p>
        <button className="sg-btn" type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Enabling…' : 'Enable agent'}</button>
        {err && <div className="sg-status sg-error">{err}</div>}
      </form>
    </Modal>
  );
}

function ProposalsTab({ current, reload, isOfficer }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [proposalFor, setProposalFor] = useState(null);
  const eid = current.estate.id;

  async function sign(pid) {
    setBusy(true); const r = await post(`/api/proposals/${pid}/sign`); setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast(`Signed · ${r.data.signatures_got}/${r.data.needed}`);
    reload();
  }
  async function exec(pid) {
    setBusy(true); const r = await post(`/api/proposals/${pid}/execute`); setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast('Paid · ' + r.data.tx_hash.slice(0, 10) + '…');
    reload();
  }

  return (
    <div className="sg-grid">
      <div className="sg-card span-2">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Vendors</h3>
          {isOfficer && <button className="sg-btn sm" onClick={() => setVendorOpen(true)}><Icon name="plus" size={12} /> Add vendor</button>}
        </div>
        {current.vendors.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: '.82rem', color: '#5A5A72' }}>
            {isOfficer ? 'No vendors yet. Click "Add vendor" to register one.' : 'No vendors registered.'}
          </div>
        ) : (
          <table className="sg-table">
            <thead><tr><th>Name</th><th>Category</th><th>Wallet</th><th></th></tr></thead>
            <tbody>
              {current.vendors.map(v => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td><span className="sg-tag pink">{v.category}</span></td>
                  <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.68rem', color: '#5A5A72' }}>{v.wallet.slice(0, 10)}…</span></td>
                  <td>{isOfficer && <button className="sg-btn ghost sm" onClick={() => setProposalFor(v)}>Propose →</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="sg-card span-2">
        <h3>Proposals <span style={{ fontSize: '.75rem', color: '#5A5A72', fontWeight: 400, fontFamily: 'JetBrains Mono, monospace' }}>{current.proposals.length}</span></h3>
        {current.proposals.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: '.82rem', color: '#5A5A72' }}>
            No proposals yet.{isOfficer && ' Propose a payment from the vendors above.'}
          </div>
        ) : (
          <table className="sg-table">
            <thead><tr><th>#</th><th>Vendor</th><th>Purpose</th><th>Amount</th><th>Sigs</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {current.proposals.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace' }}>{p.id}</td>
                  <td>{p.vendor_name}</td>
                  <td>{p.purpose}</td>
                  <td>${(p.amount_usd / 100).toFixed(2)}</td>
                  <td><span className={`sg-tag ${p.signatures_got >= p.signatures_needed ? 'lime' : ''}`}>{p.signatures_got}/{p.signatures_needed}</span></td>
                  <td><span className={`sg-tag ${p.status === 'executed' ? 'lime' : p.status === 'ready' ? 'pink' : ''}`}>{p.status}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.status === 'pending' && isOfficer && <button className="sg-btn sm" onClick={() => sign(p.id)} disabled={busy}>Sign</button>}
                    {p.status === 'ready' && isOfficer && <button className="sg-btn lime sm" onClick={() => exec(p.id)} disabled={busy}>Execute →</button>}
                    {p.tx_hash && <span style={{ fontFamily: 'monospace', fontSize: '.62rem', color: '#5A5A72', marginLeft: 8 }}>{p.tx_hash.slice(0, 8)}…</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {err && <div className="sg-status sg-error">{err}</div>}
      </div>
      {vendorOpen && <AddVendorModal eid={eid} onClose={() => setVendorOpen(false)} onSuccess={() => { setVendorOpen(false); reload(); }} />}
      {proposalFor && <CreateProposalModal eid={eid} vendor={proposalFor} onClose={() => setProposalFor(null)} onSuccess={() => { setProposalFor(null); reload(); }} />}
    </div>
  );
}

function AddVendorModal({ eid, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('diesel');
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await post(`/api/estates/${eid}/vendors`, { name, category, wallet });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast('Vendor added');
    onSuccess();
  }
  return (
    <Modal title="Add vendor" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="sg-label">Vendor name</label>
        <input className="sg-input" value={name} onChange={e => setName(e.target.value)} placeholder="Total Diesel Ltd" required autoFocus />
        <label className="sg-label">Category</label>
        <select className="sg-input" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="diesel">Diesel</option><option value="security">Security</option>
          <option value="water">Water</option><option value="waste">Waste</option><option value="other">Other</option>
        </select>
        <label className="sg-label">Stellar wallet (G...)</label>
        <input className="sg-input" value={wallet} onChange={e => setWallet(e.target.value)} placeholder="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" required style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
        <button className="sg-btn" type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Adding…' : 'Add vendor'}</button>
        {err && <div className="sg-status sg-error">{err}</div>}
      </form>
    </Modal>
  );
}

function CreateProposalModal({ eid, vendor, onClose, onSuccess }) {
  const [amount, setAmount] = useState('1000');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await post(`/api/estates/${eid}/proposals`, { vendor_id: vendor.id, amount_usd: parseInt(amount, 10), purpose });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast('Proposal created');
    onSuccess();
  }
  return (
    <Modal title={`Propose payment to ${vendor.name}`} subtitle="Both officers must sign before the treasury releases funds." onClose={onClose}>
      <form onSubmit={submit}>
        <label className="sg-label">Amount (cents)</label>
        <input className="sg-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" required autoFocus />
        <p style={{ fontSize: '.78rem', color: '#8A8AA3', marginBottom: 14 }}>{amount ? `$${(parseInt(amount, 10) / 100).toFixed(2)}` : ''}</p>
        <label className="sg-label">Purpose</label>
        <input className="sg-input" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Diesel — November" required />
        <button className="sg-btn" type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Creating…' : 'Create proposal'}</button>
        {err && <div className="sg-status sg-error">{err}</div>}
      </form>
    </Modal>
  );
}

function MembersTab({ current, reload, isOfficer }) {
  const [promoteTarget, setPromoteTarget] = useState(null);
  const eid = current.estate.id;
  return (
    <div className="sg-card">
      <h3>Members <span style={{ fontSize: '.75rem', color: '#5A5A72', fontWeight: 400, fontFamily: 'JetBrains Mono, monospace' }}>{current.members.length}</span></h3>
      <table className="sg-table">
        <thead><tr><th>Name</th><th>Role</th><th>KYC</th><th>Wallet</th><th></th></tr></thead>
        <tbody>
          {current.members.map(m => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td><span className={`sg-tag ${m.role === 'officer' ? 'lime' : ''}`}>{m.role}</span></td>
              <td><span className={`sg-tag ${m.kyc_status === 'approved' ? 'lime' : 'pink'}`}>{m.kyc_status}</span></td>
              <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.68rem', color: '#5A5A72' }}>{m.wallet_address ? m.wallet_address.slice(0, 10) + '…' : '—'}</span></td>
              <td>{isOfficer && m.role === 'resident' && <button className="sg-btn ghost sm" onClick={() => setPromoteTarget(m)}>Promote →</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {promoteTarget && <PromoteModal eid={eid} member={promoteTarget} onClose={() => setPromoteTarget(null)} onSuccess={() => { setPromoteTarget(null); reload(); }} />}
    </div>
  );
}

function PromoteModal({ eid, member, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function confirm() {
    setBusy(true); setErr('');
    const r = await post(`/api/estates/${eid}/promote`, { member_id: member.id });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    window.sigilToast && window.sigilToast(`${member.name} promoted to officer`);
    onSuccess();
  }
  return (
    <Modal title="Promote to officer" onClose={onClose}>
      <div className="sg-meta">
        <strong>{member.name}</strong>
        <div style={{ fontSize: '.8rem', color: '#8A8AA3', marginTop: 4 }}>{member.wallet_address ? member.wallet_address.slice(0, 20) + '…' : 'no wallet linked'}</div>
      </div>
      <button className="sg-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={confirm} disabled={busy}>{busy ? 'Promoting…' : 'Yes, promote to officer'}</button>
      <button className="sg-btn ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onClose}>Cancel</button>
      {err && <div className="sg-status sg-error">{err}</div>}
    </Modal>
  );
}

function LedgerTab({ current }) {
  return (
    <div className="sg-card">
      <h3>Ledger</h3>
      <table className="sg-table">
        <thead><tr><th>When</th><th>Event</th><th>Description</th><th>Amount</th><th>Tx</th></tr></thead>
        <tbody>
          {current.ledger.map(l => (
            <tr key={l.id}>
              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.65rem', color: '#5A5A72' }}>{l.created_at}</td>
              <td><span className="sg-tag">{l.event_type}</span></td>
              <td>{l.description}</td>
              <td>{l.amount_usd ? `$${(l.amount_usd / 100).toFixed(2)}` : ''}</td>
              <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.6rem', color: '#5A5A72' }}>{l.tx_hash ? l.tx_hash.slice(0, 8) + '…' : ''}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {current.ledger.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: '.82rem', color: '#5A5A72' }}>No activity yet</div>}
    </div>
  );
}

function CreateEstateModal({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [monthly, setMonthly] = useState('500');
  const [expected, setExpected] = useState('5');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await post('/api/estates', { name: name.trim(), monthly_usd: parseInt(monthly, 10), expected_residents: parseInt(expected, 10) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    onSuccess(r.data);
  }
  return (
    <Modal title="Create estate" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="sg-label">Estate name</label>
        <input className="sg-input" value={name} onChange={e => setName(e.target.value)} placeholder="Lekki Phase 1" required autoFocus />
        <label className="sg-label">Expected residents</label>
        <input className="sg-input" type="number" value={expected} onChange={e => setExpected(e.target.value)} min="1" max="200" />
        <label className="sg-label">Monthly per resident (cents)</label>
        <input className="sg-input" type="number" value={monthly} onChange={e => setMonthly(e.target.value)} min="10" max="100000" required />
        <button className="sg-btn" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={busy}>{busy ? 'Creating…' : 'Create estate'}</button>
        {err && <div className="sg-status sg-error">{err}</div>}
      </form>
    </Modal>
  );
}

function JoinEstateModal({ onClose, onSuccess }) {
  const [eid, setEid] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await post(`/api/estates/${eid}/join`, { invite_code: code.trim() });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error); return; }
    onSuccess(parseInt(eid, 10));
  }
  return (
    <Modal title="Join estate" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="sg-label">Estate ID</label>
        <input className="sg-input" type="number" value={eid} onChange={e => setEid(e.target.value)} placeholder="1" required autoFocus />
        <label className="sg-label">Invite code</label>
        <input className="sg-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SG-A1B2C3" required style={{ fontFamily: 'JetBrains Mono, monospace' }} />
        <button className="sg-btn" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={busy}>{busy ? 'Joining…' : 'Join estate'}</button>
        {err && <div className="sg-status sg-error">{err}</div>}
      </form>
    </Modal>
  );
}

const placeholderEl = document.querySelector('.demo-placeholder');
if (placeholderEl) {
  placeholderEl.innerHTML = '';
  placeholderEl.classList.add('sigil-app-container');
}
const navRoot = document.getElementById('sigil-root');
if (navRoot) {
  createRoot(navRoot).render(<App placeholderEl={placeholderEl} />);
}