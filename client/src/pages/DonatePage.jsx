import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { donate } from '../lib/api';

const POPULAR_CRYPTOS = [
  'BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'XMR', 'BNB', 'SOL', 'DOGE', 'TRX'
];

export default function DonatePage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState('10');
  const [currency, setCurrency] = useState('BTC');
  const [currencies, setCurrencies] = useState(POPULAR_CRYPTOS);
  const [step, setStep] = useState('form'); // form | payment | success
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pollInterval, setPollInterval] = useState(null);

  useEffect(() => {
    donate.currencies().then(data => {
      if (data?.currencies?.length) {
        setCurrencies(data.currencies.map(c => c.toUpperCase ? c.toUpperCase() : c));
      }
    }).catch(() => {});
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, []);

  useEffect(() => {
    if (step !== 'payment' || !paymentData?.payment_id) return;
    const id = setInterval(async () => {
      try {
        const s = await donate.status(paymentData.payment_id);
        if (['finished', 'confirmed'].includes(s.status)) {
          clearInterval(id);
          setStep('success');
        } else if (['failed', 'expired'].includes(s.status)) {
          clearInterval(id);
          setError('Payment failed or expired. Please try again.');
          setStep('form');
        }
      } catch (_) {}
    }, 15000);
    setPollInterval(id);
    return () => clearInterval(id);
  }, [step, paymentData]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const eur = parseFloat(amount);
    if (isNaN(eur) || eur < 5) {
      setError('Minimum donation is €5.00');
      return;
    }
    setLoading(true);
    try {
      const data = await donate.createPayment({
        amount_eur: eur,
        pay_currency: currency,
      });
      setPaymentData(data);
      setStep('payment');
    } catch (err) {
      setError(err.message || 'Payment creation failed');
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '32px 28px',
    maxWidth: 520,
    margin: '0 auto',
  };

  // ─── SUCCESS ───────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={{ padding: '48px 16px' }}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 12 }}>
            Thank you!
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
            Your donation has been confirmed. You now have the <strong>Donator</strong> badge.
            Head to your profile to choose your username color and manage your badge.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href="/profile" className="btn btn-primary" style={{ display: 'inline-block' }}>Go to Profile</a>
            <a href="/" className="btn btn-ghost" style={{ display: 'inline-block' }}>Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  // ─── PAYMENT WAITING ───────────────────────────────────────────────────────
  if (step === 'payment' && paymentData) {
    return (
      <div style={{ padding: '48px 16px' }}>
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', fontWeight: 400, marginBottom: 8 }}>
            Complete Your Donation
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Send exactly the amount below to the address. The page updates automatically.
          </p>

          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Amount to send</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>
              {paymentData.pay_amount} <span style={{ color: 'var(--muted)' }}>{paymentData.pay_currency?.toUpperCase()}</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Send to address</div>
            <div style={{
              fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all',
              color: 'var(--text)', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 6,
              padding: '10px 12px',
            }}>
              {paymentData.pay_address}
            </div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 8, fontSize: 12 }}
              onClick={() => navigator.clipboard.writeText(paymentData.pay_address)}
            >
              Copy address
            </button>
          </div>

          {paymentData.invoice_url && (
            <a href={paymentData.invoice_url} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
              Open Payment Page ↗
            </a>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: '#F59E0B', animation: 'pulse 2s infinite',
            }} />
            Waiting for payment confirmation…
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        </div>
      </div>
    );
  }

  // ─── DONATION FORM ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '48px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤝</div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2rem', fontWeight: 400, marginBottom: 10 }}>
            Support Vpred
          </h1>
          <p style={{ color: 'var(--muted)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
            Help keep this platform independent. Every donation — large or small — makes a difference.
          </p>
        </div>

        {/* Donator perks */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
            🎖️ Donator perks (min. €5)
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'var(--muted)', fontSize: 14, lineHeight: 2 }}>
            <li><strong style={{ color: 'var(--text)' }}>Donator badge</strong> — visible on your profile and posts</li>
            <li><strong style={{ color: 'var(--text)' }}>Custom username color</strong> — choose any color freely in your profile</li>
            <li><strong style={{ color: 'var(--text)' }}>Toggle your badge</strong> — show or hide it anytime from your profile</li>
            <li>Permanent — no expiry</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <form onSubmit={handleSubmit}>
            {/* Amount */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Amount (EUR)
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {[5, 10, 25, 50].map(v => (
                  <button key={v} type="button"
                    onClick={() => setAmount(String(v))}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                      border: `2px solid ${amount === String(v) ? 'var(--primary)' : 'var(--border)'}`,
                      background: amount === String(v) ? 'var(--primary)' : 'var(--bg)',
                      color: amount === String(v) ? '#fff' : 'var(--text)',
                      fontWeight: 600,
                    }}>
                    €{v}
                  </button>
                ))}
              </div>
              <input
                className="input"
                type="number"
                min="5"
                step="0.01"
                placeholder="Or enter custom amount…"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            {/* Currency */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Pay with
              </label>
              <select
                className="input"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {currencies.slice(0, 80).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {error && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}

            <button type="submit" className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px' }}>
              {loading ? 'Creating payment…' : `Donate €${parseFloat(amount || 0).toFixed(2)} in ${currency}`}
            </button>

            {!user && (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
                You're not logged in — your badge will not be linked to an account.{' '}
                <a href="/login">Log in</a> to receive your donator badge.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
