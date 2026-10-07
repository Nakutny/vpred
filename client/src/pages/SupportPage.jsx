import SEO from '../components/SEO';

const WALLETS = [
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    color: '#f7931a',
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#f7931a"/>
        <path d="M22.5 13.8c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.6 2.6c-.4-.1-.9-.2-1.3-.3l.6-2.6-1.6-.4-.7 2.7c-.4-.1-.7-.2-1-.2l-2.1-.5-.4 1.7s1.2.3 1.2.3c.7.2.8.7.8 1l-.8 3.3c0 0 .1 0 .2 0l-.2-.1-1.2 4.7c-.1.2-.3.6-.8.5 0 .1-1.2-.3-1.2-.3l-.8 1.8 2 .5 1.1.3-.7 2.8 1.6.4.7-2.7c.5.1.9.3 1.4.4l-.7 2.7 1.6.4.7-2.8c2.7.5 4.7.3 5.6-2.2.7-2-.1-3.2-1.5-3.9 1-.2 1.8-.9 2-2.3zm-3.5 4.9c-.5 2-3.9.9-5 .7l.9-3.5c1.1.3 4.6.8 4.1 2.8zm.5-5c-.5 1.8-3.3.9-4.3.7l.8-3.2c.9.2 3.9.7 3.5 2.5z" fill="white"/>
      </svg>
    ),
  },
  {
    name: 'Ethereum',
    symbol: 'ETH',
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    color: '#627eea',
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#627eea"/>
        <path d="M16 5l-.1.4v14.3l.1.1 6.5-3.8L16 5z" fill="white" opacity=".8"/>
        <path d="M16 5L9.5 16l6.5 3.8V5z" fill="white"/>
        <path d="M16 21.2l-.1.1v4.9l.1.2 6.5-9.1-6.5 3.9z" fill="white" opacity=".8"/>
        <path d="M16 26.4v-5.2l-6.5-3.9 6.5 9.1z" fill="white"/>
        <path d="M16 19.8l6.5-3.8-6.5-3V19.8z" fill="white" opacity=".6"/>
        <path d="M9.5 16l6.5 3.8V13L9.5 16z" fill="white" opacity=".8"/>
      </svg>
    ),
  },
  {
    name: 'Monero',
    symbol: 'XMR',
    address: '88L2RUrPpvHq21Q9dY4HxTqvJHYqrMcHiA7wRZcF4fzQ1G8Xt4n9XK3BVLZ5hN7Km3jHGXeQRG',
    color: '#ff6600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#ff6600"/>
        <path d="M16 6C10.48 6 6 10.48 6 16s4.48 10 10 10 10-4.48 10-10S21.52 6 16 6zm-.5 14.5v-7.6l-3.7 3.7-1.1-1.1 4.8-4.8 4.8 4.8-1.1 1.1-3.7-3.7v7.6h-1z" fill="white"/>
      </svg>
    ),
  },
  {
    name: 'Litecoin',
    symbol: 'LTC',
    address: 'LTdsVS8VDw6syvfQADdhf2PHAm3rMGJvPX',
    color: '#bfbbbb',
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#bfbbbb"/>
        <path d="M10 22h12v2H10v-2zm1.8-5.1l1.1-.4.4-1.5-1.1.4L13 13h5.5l-.5 2h1.9l.6-2H22l.5-2H14l-1.3 5-1.1.4-.4 1.5z" fill="white"/>
      </svg>
    ),
  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
        background: copied ? 'rgba(76,175,125,0.1)' : 'var(--surface)',
        color: copied ? 'var(--success)' : 'var(--muted)',
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 5,
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </>
      )}
    </button>
  );
}

import { useState } from 'react';

export default function SupportPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <SEO
        title="Support vpred.org – Donate"
        description="Help fund independent investigative research. Donate anonymously with cryptocurrency."
        url="https://vpred.org/support"
      />

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 400, marginBottom: 14 }}>
          Support Independent Research
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
          vpred.org is a non-commercial open research collective. We rely entirely on voluntary donations to cover server costs, tooling, and development. Every contribution helps keep investigations running.
        </p>
      </div>

      {/* What donations cover */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', fontWeight: 400, marginBottom: 16 }}>
          What your donation covers
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {[
            { icon: '🖥️', label: 'Server & hosting', desc: 'Railway + Netlify infrastructure' },
            { icon: '🔒', label: 'Security tools', desc: 'Keeping data and sources safe' },
            { icon: '⚙️', label: 'Development', desc: 'Building new platform features' },
            { icon: '📡', label: 'Data access', desc: 'OSINT and public record tools' },
          ].map(item => (
            <div key={item.label} style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{item.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Crypto donation section */}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: 400, marginBottom: 6 }}>
          Donate with Cryptocurrency
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
          We accept anonymous cryptocurrency donations. Send any amount to the addresses below.
          Powered by{' '}
          <a href="https://nowpayments.io" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            NOWPayments
          </a>
          {' '}— no account required.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {WALLETS.map(wallet => (
            <div key={wallet.symbol} className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {wallet.icon}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{wallet.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{wallet.symbol}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <code style={{
                  flex: 1,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  background: 'var(--surface2)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  color: 'var(--text)',
                  wordBreak: 'break-all',
                  minWidth: 0,
                }}>
                  {wallet.address}
                </code>
                <CopyButton text={wallet.address} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NOWPayments widget / CTA */}
      <div className="card" style={{ padding: '28px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(79,142,247,0.08) 0%, rgba(79,142,247,0.03) 100%)', border: '1px solid rgba(79,142,247,0.2)' }}>
        <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', fontWeight: 400, marginBottom: 8 }}>
          Prefer a guided payment?
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
          Use NOWPayments to donate in 300+ cryptocurrencies with instant conversion.
        </p>
        <a
          href="https://nowpayments.io/donation/vpred"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ display: 'inline-flex' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Donate via NOWPayments
        </a>
      </div>

      {/* Transparency note */}
      <div style={{ marginTop: 40, padding: '18px 22px', background: 'var(--surface)', borderRadius: 8, borderLeft: '3px solid var(--border)' }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Transparency</h4>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          vpred.org does not sell personal data. All donations are voluntary and non-refundable.
          We do not provide tax receipts. The platform is operated as an independent non-commercial project.
          No personal data is collected in connection with cryptocurrency donations.
        </p>
      </div>
    </div>
  );
}
