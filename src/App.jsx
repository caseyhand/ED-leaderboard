import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';

const DATA_VERSION = 7; // bump every time new week data is pushed
if (typeof window !== 'undefined' &&
    localStorage.getItem('lb-data-version') !== String(DATA_VERSION)) {
  localStorage.removeItem('lb-weeks');
  localStorage.setItem('lb-data-version', String(DATA_VERSION));
}
import { SEED_WEEKS, DEFAULT_NAMES, ADMIN_PASSWORD } from './data';
import Leaderboard from './components/Leaderboard';
import AdminPanel from './components/AdminPanel';
import WeekSelector from './components/WeekSelector';
import TrendView from './components/TrendView';
import './App.css';

export default function App() {
  const [weeks, setWeeks] = useLocalStorage('lb-weeks', SEED_WEEKS);
  const [names, setNames] = useLocalStorage('lb-names', DEFAULT_NAMES);
  const [unblinded, setUnblinded] = useLocalStorage('lb-unblinded', false);
  const [currentUser, setCurrentUser] = useLocalStorage('lb-current-user', null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [view, setView] = useState('leaderboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [letterPickerInput, setLetterPickerInput] = useState('');
  const [letterError, setLetterError] = useState('');

  const selectedWeek = weeks[selectedWeekIdx] || weeks[0];

  // All active letters across all weeks for the picker
  const allLetters = [...new Set(
    weeks.flatMap(w => w.physicians.filter(p => p.pts > 0).map(p => p.letter))
  )].sort();

  function handleLetterSubmit() {
    const val = letterPickerInput.trim().toUpperCase();
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
      setShowAdminLogin(false);
      setAdminError('');
      setAdminInput('');
      setView('admin');
    } else {
      setAdminError('Incorrect password');
    }
  }

  function handleAddWeek(weekData) {
    setWeeks([weekData, ...weeks]);
    setSelectedWeekIdx(0);
  }

  function handleLogout() {
    setIsAdmin(false);
    setView('leaderboard');
    setUnblinded(false);
  }

  // First-visit letter picker — show if no letter set yet
  if (!currentUser) {
    return (
      <div className="app">
        <div className="onboard-overlay">
          <div className="onboard-card">
            <div className="onboard-icon">⚕</div>
            <h1 className="onboard-title">ED Productivity Dashboard</h1>
            <p className="onboard-sub">Vituity / Trinity Health</p>

            <div className="onboard-divider" />

            <p className="onboard-prompt">
              Wendy's email included your blinded letter identifier.<br />
              Enter it below to highlight your row on the leaderboard.
            </p>

            <div className="onboard-letters">
              {allLetters.map(l => (
                <button
                  key={l}
                  className={`letter-btn ${letterPickerInput === l ? 'selected' : ''}`}
                  onClick={() => setLetterPickerInput(l)}
                >
                  {l}
                </button>
              ))}
            </div>

            <p className="onboard-or">or type it in</p>

            <div className="onboard-input-row">
              <input
                className="modal-input onboard-input"
                placeholder="Your letter (e.g. H)"
                maxLength={1}
                value={letterPickerInput}
                onChange={e => {
                  setLetterPickerInput(e.target.value.toUpperCase());
                  setLetterError('');
                }}
                onKeyDown={e => e.key === 'Enter' && handleLetterSubmit()}
                autoFocus
              />
              <button className="btn btn-primary" onClick={handleLetterSubmit}>
                Let's go →
              </button>
            </div>

            {letterError && <p className="modal-error" style={{textAlign:'center'}}>{letterError}</p>}

            <button
              className="onboard-skip"
              onClick={() => setCurrentUser('?')}
            >
              I don't know my letter — just show me the board
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">⚕</span>
              <div>
                <div className="logo-title">ED Productivity</div>
                <div className="logo-sub">Physician Performance Dashboard</div>
              </div>
            </div>
          </div>

          <nav className="nav">
            <button className={`nav-btn ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => setView('leaderboard')}>
              Leaderboard
            </button>
            <button className={`nav-btn ${view === 'season' ? 'active' : ''}`} onClick={() => setView('season')}>
              🏅 Season Avg
            </button>
            <button className={`nav-btn ${view === 'trends' ? 'active' : ''}`} onClick={() => setView('trends')}>
              Trends
            </button>
            {isAdmin ? (
              <>
                <button className={`nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
                  Admin
                </button>
                <button className="nav-btn admin-active" onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <button className="nav-btn" onClick={() => setShowAdminLogin(true)}>Admin</button>
            )}
          </nav>
        </div>
      </header>

      {/* Admin login modal */}
      {showAdminLogin && (
        <div className="modal-overlay" onClick={() => setShowAdminLogin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Admin Access</h3>
            <p className="modal-sub">Enter the admin password to continue.</p>
            <input
              type="password"
              className="modal-input"
              placeholder="Password"
              value={adminInput}
              onChange={e => setAdminInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              autoFocus
            />
            {adminError && <p className="modal-error">{adminError}</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowAdminLogin(false); setAdminInput(''); setAdminError(''); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAdminLogin}>Login</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="main">
        {view === 'leaderboard' && (
          <>
            <div className="toolbar">
              <WeekSelector weeks={weeks} selectedIdx={selectedWeekIdx} onChange={setSelectedWeekIdx} />
              <div className="toolbar-right">
                {currentUser !== '?' && (
                  <div className="user-badge">
                    You are <span className="letter-chip">{currentUser}</span>
                    <button className="change-letter" onClick={() => setCurrentUser(null)} title="Change letter">✎</button>
                  </div>
                )}
                {isAdmin && (
                  <button
                    className={`toggle-btn ${unblinded ? 'active' : ''}`}
                    onClick={() => setUnblinded(!unblinded)}
                  >
                    {unblinded ? '🔓 Unblinded' : '🔒 Blinded'}
                  </button>
                )}
              </div>
            </div>
            <Leaderboard week={selectedWeek} names={names} unblinded={unblinded && isAdmin} currentUser={currentUser} />
          </>
        )}

        {view === 'season' && (
          <Leaderboard
            week={null}
            weeks={weeks}
            names={names}
            unblinded={unblinded && isAdmin}
            currentUser={currentUser}
            seasonMode={true}
          />
        )}

        {view === 'trends' && (
          <TrendView weeks={weeks} names={names} currentUser={currentUser} unblinded={unblinded && isAdmin} />
        )}

        {view === 'admin' && isAdmin && (
          <AdminPanel
            weeks={weeks}
            names={names}
            onAddWeek={handleAddWeek}
            onUpdateNames={setNames}
            unblinded={unblinded}
            onToggleUnblinded={() => setUnblinded(!unblinded)}
            currentUser={currentUser}
            onSetCurrentUser={setCurrentUser}
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
