import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { SEED_WEEKS, DEFAULT_NAMES, ADMIN_PASSWORD } from './data';
import Leaderboard from './components/Leaderboard';
import AdminPanel from './components/AdminPanel';
import WeekSelector from './components/WeekSelector';
import TrendView from './components/TrendView';
import './App.css';

export default function App() {
  const [weeks, setWeeks]             = useLocalStorage('lb-weeks', SEED_WEEKS);
  const [names, setNames]             = useLocalStorage('lb-names', DEFAULT_NAMES);
  const [unblinded, setUnblinded]     = useLocalStorage('lb-unblinded', false);
  const [currentUser, setCurrentUser] = useLocalStorage('lb-current-user', null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [view, setView]               = useState('leaderboard');
  const [isAdmin, setIsAdmin]         = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput]   = useState('');
  const [adminError, setAdminError]   = useState('');
  const [letterInput, setLetterInput] = useState('');
  const [letterError, setLetterError] = useState('');

  const selectedWeek = weeks[selectedWeekIdx] || weeks[0];
  const allLetters = [...new Set(
    weeks.flatMap(w => w.physicians.filter(p => p.pts > 0).map(p => p.letter))
  )].sort();

  function handleLetterSubmit() {
    const val = letterInput.trim().toUpperCase();
    if (!val || val.length !== 1 || !/[A-Z]/.test(val)) {
      setLetterError('Please enter a single letter (A–Z)');
      return;
    }
    setCurrentUser(val);
    setLetterError('');
  }

  function handleAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAdminError('');
      setShowAdminLogin(false);
      setAdminInput('');
    } else {
      setAdminError('Incorrect password');
    }
  }

  function handleLogout() {
    setIsAdmin(false);
    setView('leaderboard');
  }

  function handleAddWeek(newWeek) {
    setWeeks(prev => [newWeek, ...prev]);
    setSelectedWeekIdx(0);
  }

  function handleUpdateNames(newNames) {
    setNames(newNames);
  }

  // ── Letter picker ─────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="onboard-overlay">
        <div className="onboard-card">
          <div className="onboard-icon">🏥</div>
          <h1 className="onboard-title">ED Productivity</h1>
          <p className="onboard-sub">Physician Performance Dashboard</p>
          <div className="onboard-divider" />
          <p className="onboard-prompt">Which letter were you assigned this week?</p>
          <div className="onboard-letters">
            {allLetters.map(l => (
              <button key={l} className="letter-btn" onClick={() => setCurrentUser(l)}>{l}</button>
            ))}
          </div>
          <p className="onboard-or">or type it</p>
          <div className="onboard-input-row">
            <input
              className="modal-input onboard-input"
              type="text" maxLength={1} placeholder="H"
              value={letterInput}
              onChange={e => setLetterInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleLetterSubmit()}
              autoFocus
            />
            <button className="btn btn-primary" onClick={handleLetterSubmit}>Go</button>
          </div>
          {letterError && <p className="modal-error">{letterError}</p>}
          <button className="onboard-skip" onClick={() => setCurrentUser('?')}>I don't know my letter</button>
        </div>
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">🏥</span>
              <div>
                <div className="logo-title">ED Productivity</div>
                <div className="logo-sub">Physician Performance Dashboard</div>
              </div>
            </div>
            <nav className="nav">
              <button className={`nav-btn ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => setView('leaderboard')}>
                📊 Weekly
              </button>
              <button className={`nav-btn ${view === 'season' ? 'active' : ''}`} onClick={() => setView('season')}>
                🏅 Season Avg
              </button>
              <button className={`nav-btn ${view === 'trends' ? 'active' : ''}`} onClick={() => setView('trends')}>
                📈 Trends
              </button>
              {isAdmin ? (
                <>
                  <button className={`nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>Admin</button>
                  <button className="nav-btn admin-active" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <button className="nav-btn" onClick={() => setShowAdminLogin(true)}>Admin</button>
              )}
            </nav>
          </div>
          <div className="toolbar-right">
            <div className="user-badge">
              You are <span className="letter-chip">{currentUser}</span>
              <button className="change-letter" onClick={() => setCurrentUser(null)} title="Change letter">✏️</button>
            </div>
            {isAdmin && (
              <button className={`toggle-btn ${unblinded ? 'active' : ''}`} onClick={() => setUnblinded(!unblinded)}>
                {unblinded ? '🔓 Unblinded' : '🔒 Blinded'}
              </button>
            )}
          </div>
        </div>
      </header>

      {showAdminLogin && !isAdmin && (
        <div className="modal-overlay" onClick={() => setShowAdminLogin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Admin Access</h3>
            <p className="modal-sub">Enter the admin password to continue.</p>
            <input type="password" className="modal-input" placeholder="Password"
              value={adminInput} onChange={e => setAdminInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} autoFocus />
            {adminError && <p className="modal-error">{adminError}</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowAdminLogin(false); setAdminInput(''); setAdminError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdminLogin}>Login</button>
            </div>
          </div>
        </div>
      )}

      <main className="main">
        {view === 'leaderboard' && (
          <>
            <div className="toolbar">
              <WeekSelector weeks={weeks} selectedIdx={selectedWeekIdx} onChange={setSelectedWeekIdx} />
              {isAdmin && (
                <div className="toolbar-right">
                  <button className={`toggle-btn ${unblinded ? 'active' : ''}`} onClick={() => setUnblinded(!unblinded)}>
                    {unblinded ? '🔓 Unblinded' : '🔒 Blinded'}
                  </button>
                </div>
              )}
            </div>
            <Leaderboard week={selectedWeek} weeks={weeks} names={names} unblinded={unblinded && isAdmin} currentUser={currentUser} seasonMode={false} />
          </>
        )}

        {view === 'season' && (
          <Leaderboard week={null} weeks={weeks} names={names} unblinded={unblinded && isAdmin} currentUser={currentUser} seasonMode={true} />
        )}

        {view === 'trends' && (
          <TrendView weeks={weeks} names={names} currentUser={currentUser} unblinded={unblinded && isAdmin} />
        )}

        {view === 'admin' && isAdmin && (
          <AdminPanel
            weeks={weeks} names={names}
            onAddWeek={handleAddWeek} onUpdateNames={handleUpdateNames}
            unblinded={unblinded} onToggleUnblinded={() => setUnblinded(!unblinded)}
            currentUser={currentUser} onSetCurrentUser={setCurrentUser}
          />
        )}
      </main>

      <footer className="footer">
        <span>ED Physician Productivity Dashboard</span>
        <span className="footer-sep">·</span>
        <span>Data is blinded by default</span>
        <span className="footer-sep">·</span>
        <span>Vituity / Trinity Health</span>
      </footer>
    </div>
  );
}
