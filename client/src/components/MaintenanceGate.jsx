import { useEffect, useState } from 'react';
import MaintenancePage from '../pages/MaintenancePage';

const API_BASE = import.meta.env.VITE_API_URL || 'https://vpred-oxfv.onrender.com';

function getStoredUser() {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export default function MaintenanceGate({ children }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [checked, setChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  useEffect(() => {
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function checkMaintenance() {
    try {
      const res = await fetch(`${API_BASE}/api/maintenance`);
      const data = await res.json();
      setMaintenanceMode(!!data.maintenance);
      setMaintenanceMsg(data.message || '');
    } catch (_) {
      setMaintenanceMode(false);
    } finally {
      setChecked(true);
    }
  }

  function handleLogin(user) {
    setCurrentUser(user);
    // Re-check maintenance status so the gate re-renders immediately
    checkMaintenance();
  }

  if (!checked) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#444', fontSize: '0.875rem' }}>Loading…</div>
      </div>
    );
  }

  // Maintenance active and current user is NOT admin/mod
  if (maintenanceMode && !['admin', 'moderator'].includes(currentUser?.role)) {
    return (
      <MaintenancePage
        message={maintenanceMsg}
        onLogin={handleLogin}
      />
    );
  }

  return children;
}
