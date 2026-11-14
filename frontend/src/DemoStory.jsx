import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

/* ─── Branded Seal (reused everywhere) ─────────────────────── */
const Seal = ({ size = 80, rotate = false }) => (
  <svg viewBox="0 0 120 120" width={size} height={size} style={{ overflow: 'visible', filter: 'drop-shadow(0 0 28px rgba(50,189,255,0.45))' }}>
    <g style={{ transformOrigin: '60px 60px', animation: rotate ? 'demoSealRotate 40s linear infinite' : 'none' }}>
      <path d="M60 4L108.5 32V88L60 116L11.5 88V32L60 4Z" fill="#171724" />
      <path d="M60 13L100.7 36.5V83.5L60 107L19.3 83.5V36.5L60 13Z" fill="#0B0B14" stroke="#32BDFF" strokeWidth="1" />
      <path d="M77 35H47L37 45V57L47 64H71L74 67V75L71 78H41V87H73L83 77V64L73 57H49L46 54V47L49 44H77V35Z" fill="#B6FF3C" />
    </g>
  </svg>
);

const FeatureIcon = ({ name, size = 48 }) => {
  const paths = {
    wallet: 'M3 6h18v14H3zM3 10h18M16 15h2',
    shield: 'M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4zM9 12l2 2 4-4',
    yield: 'M3 17l6-6 4 4 8-8M14 7h7v7',
    agent: 'M12 3v3M8 6h8M5 10h14v10H5zM9 15h.01M15 15h.01',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.shield} />
    </svg>
  );
};

/* ─── Story timeline · 12 scenes · ~54 seconds ─────────────── */
const STORY = [
  { kind: 'seal', duration: 3200 },
  { kind: 'title', brand: 'SIGIL', title: 'The estate treasury', highlight: 'that cannot be stolen.', duration: 4500 },
  { kind: 'stat', tag: 'Default', value: '₦85.5M', label: 'in arrears at 1004 Estate alone',
    body: '15% of residents default on ₦570M in yearly service charges — a single Lagos estate. Multiply across Lekki, Ajah, Ikoyi.', duration: 5500 },
  { kind: 'stat', tag: 'Fraud', value: '₦2.4M', label: 'stolen from one tenant',
    body: 'Landlord approved ₦500,000 per unit. Caretaker collected ₦1,300,000. Discovered only on a rare landlord visit.', duration: 5500 },
  { kind: 'stat', tag: 'Opacity', value: '71%', label: "don't trust the numbers",
    body: 'Only 29% of residents feel they get value for the service charges they pay. The other 71% withhold — delaying payments vendors depend on.', duration: 5500 },
  { kind: 'transition', text: 'So we built something different.', duration: 3000 },
  { kind: 'feature', icon: 'wallet', title: 'One-tap onboarding',
    body: 'Residents sign in with Google. Pollar provisions a Stellar wallet in seconds. No seed phrase, no extension, no install.', duration: 4800 },
  { kind: 'feature', icon: 'shield', title: 'Two signatures, always',
    body: 'Every vendor payment requires two officers to sign in the app. No single human — including the estate chairman — can move funds alone.', duration: 4800 },
  { kind: 'feature', icon: 'yield', title: 'Yield on idle balance',
    body: 'Treasury funds sit in a DeFindex vault earning live APY between contribution day and vendor payment day.', duration: 4800 },
  { kind: 'feature', icon: 'agent', title: 'x402 auto-pay agent',
    body: 'Each resident approves a monthly limit once. An x402 agent signs the Soroban authorization and pays automatically. Pollar sponsors the gas.', duration: 4800 },
  { kind: 'reveal', title: 'Try it now.', body: 'Real Stellar testnet. Real treasury. Real signatures. Every payment verified on-chain.', duration: 4000 },
  { kind: 'outro', brand: 'SIGIL', tagline: 'Every naira, sealed on-chain.', duration: 4500 },
];

function DemoStory() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);

  const step = STORY[index];
  const progress = ((index + 1) / STORY.length) * 100;

  const advance = useCallback(() => {
    setIndex(i => {
      if (i + 1 >= STORY.length) { setFinished(true); return i; }
      return i + 1;
    });
  }, []);

  const skip = useCallback(() => setFinished(true), []);

  useEffect(() => {
    if (finished || paused || !step) return;
    timerRef.current = setTimeout(advance, step.duration);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, finished, step, advance]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') skip();
      else if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
      else if (e.key === 'r' || e.key === 'R') { setIndex(0); setFinished(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, skip]);

  if (finished) {
    return (
      <div className="demo-overlay demo-exit"
        onAnimationEnd={() => window.dispatchEvent(new CustomEvent('demo:done'))} />
    );
  }

  return (
    <div className="demo-overlay">
      <div className="demo-bg-grid" />
      <div className="demo-vignette" />

      <div className="demo-watermark">
        <Seal size={28} rotate />
        <div className="demo-watermark-text">
          <div className="t1">SIGIL</div>
          <div className="t2">SEAL · 0xSIGIL</div>
        </div>
      </div>

      <div className="demo-counter">
        <span className="current">{String(index + 1).padStart(2, '0')}</span>
        <span className="sep">/</span>
        <span className="total">{String(STORY.length).padStart(2, '0')}</span>
      </div>

      <button className="demo-skip" onClick={skip}>
        Skip tour <span>Esc</span>
      </button>

      <div className="demo-progress">
        <div className="demo-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="demo-stage" key={index}>
        {step.kind === 'seal' && (
          <div className="demo-scene demo-scene-seal">
            <div className="demo-seal-big"><Seal size={220} rotate /></div>
            <div className="demo-seal-tag">Establishing secure channel</div>
          </div>
        )}

        {step.kind === 'title' && (
          <div className="demo-scene demo-scene-title">
            <div className="demo-brand-mark"><Seal size={36} /><span>{step.brand}</span></div>
            <h1>{step.title}<br /><em>{step.highlight}</em></h1>
          </div>
        )}

        {step.kind === 'stat' && (
          <div className="demo-scene demo-scene-stat">
            <div className="demo-stat-tag">{step.tag}</div>
            <div className="demo-stat-value">{step.value}</div>
            <div className="demo-stat-label">{step.label}</div>
            <div className="demo-stat-body">{step.body}</div>
          </div>
        )}

        {step.kind === 'transition' && (
          <div className="demo-scene demo-scene-transition">
            <div className="demo-transition-seal"><Seal size={64} rotate /></div>
            <h2>{step.text}</h2>
          </div>
        )}

        {step.kind === 'feature' && (
          <div className="demo-scene demo-scene-feature">
            <div className="demo-feature-icon"><FeatureIcon name={step.icon} size={48} /></div>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </div>
        )}

        {step.kind === 'reveal' && (
          <div className="demo-scene demo-scene-reveal">
            <div className="demo-reveal-seal"><Seal size={120} rotate /></div>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            <button className="demo-enter-btn" onClick={skip}>Enter Sigil →</button>
          </div>
        )}

        {step.kind === 'outro' && (
          <div className="demo-scene demo-scene-outro">
            <div className="demo-outro-seal"><Seal size={140} rotate /></div>
            <div className="demo-brand-mark"><Seal size={32} /><span>{step.brand}</span></div>
            <p className="demo-tagline">{step.tagline}</p>
            <button className="demo-enter-btn" onClick={skip}>Enter Sigil →</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Auto-mount on ?demo=1 or #demo ───────────────────────── */
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(location.search);
  const shouldStart = params.has('demo') || location.hash === '#demo';
  if (shouldStart) {
    setTimeout(() => {
      const host = document.createElement('div');
      host.id = 'sigil-demo-host';
      document.body.appendChild(host);
      createRoot(host).render(<DemoStory />);
    }, 150);
  }
}

export default DemoStory;