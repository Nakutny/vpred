import { useState } from 'react';
import SEO from '../components/SEO';

const NOWPAYMENTS_URL = 'https://nowpayments.io/donation?api_key=b20ba8c6-c167-4386-8a65-658f6f462954';

export default function SupportPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <SEO
        title="Support vpred.org – Donate"
        description="Help fund independent investigative research. Donate with cryptocurrency via NOWPayments."
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

      {/* NOWPayments donation CTA */}
      <div className="card" style={{
        padding: '36px 28px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(79,142,247,0.08) 0%, rgba(79,142,247,0.03) 100%)',
        border: '1px solid rgba(79,142,247,0.2)',
        marginBottom: 36,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>💙</div>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.4rem', fontWeight: 400, marginBottom: 10 }}>
          Donate via NOWPayments
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 440, margin: '0 auto 24px' }}>
          Donate anonymously in Bitcoin, Ethereum, Monero, and 300+ other cryptocurrencies.
          Powered by{' '}
          <a href="https://nowpayments.io" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            NOWPayments
          </a>
          {' '}— no account required, instant processing.
        </p>
        <a
          href={NOWPAYMENTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, padding: '12px 28px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Donate with Crypto
        </a>
        <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 12 }}>
          You will be redirected to NOWPayments to complete your donation securely.
        </p>
      </div>

      {/* Transparency note */}
      <div style={{ marginTop: 8, padding: '18px 22px', background: 'var(--surface)', borderRadius: 8, borderLeft: '3px solid var(--border)' }}>
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
