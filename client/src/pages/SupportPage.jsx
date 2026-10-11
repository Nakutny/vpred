import { useEffect } from 'react';

export default function SupportPage() {
  useEffect(() => {
    document.title = 'Support me — vpred.org';
  }, []);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px' }}>
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 400, marginBottom: 12 }}>
        Support me
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
        vpred.org is independently run. If this platform has been useful to you, consider supporting it to keep the research free and accessible.
      </p>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '28px 32px',
        marginBottom: 32,
      }}>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', fontWeight: 400, marginBottom: 14 }}>
          What your support covers
        </h2>
        <ul style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 2, paddingLeft: 20, margin: 0 }}>
          <li>Server and hosting costs</li>
          <li>Domain and security certificates</li>
          <li>Ongoing development and maintenance</li>
          <li>Time spent on investigative research</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center' }}>
        <a
          href="https://nowpayments.io/donation"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ fontSize: 16, padding: '12px 36px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          💙 Donate
        </a>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
          Processed securely via NOWPayments. Every contribution matters.
        </p>
      </div>
    </div>
  );
}
