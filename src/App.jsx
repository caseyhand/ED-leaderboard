import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { SEED_WEEKS, DEFAULT_NAMES, ADMIN_PASSWORD } from './data';
import Leaderboard from './components/Leaderboard';
import AdminPanel from './components/AdminPanel';
import WeekSelector from './components/WeekSelector';
import TrendView from './components/TrendView';
import './App.css';

export default function App() {
  const [weeks, setWeeks]           = useLocalStorage('lb-weeks', SEED_WEEKS);
  const [names, setNames]           = useLocalStorage('lb-names', DEFAULT_NAMES);
  const [unblinded, setUnblinded]   = useLocalStorage('lb-unblinded', false);
  const [currentUser, setCurrentUser] = useLocalStorage('lb-current-user', null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [view, setView]             = useState('leaderboard'); // 'leaderboard' | 'season' | 'trends' | 'admin'
  const [isAdmin, setIsAdmin]       = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [letterPickerInput, setLetterPickerInput] = useState('');
  const [letterError, setLetterError] = useState('');

  const selectedWeek = weeks[selectedWeekIdx] || weeks[0];

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
      setAdminError('');
      setShowAdminLogin(false);
      setAdminInput('');
      setView('admin');
    } else {
      setAdminError('Incorrect password');
    }
  }

  function handleAddWeek(newWeek) {
    setWeeks(prev => [newWeek, ...prev]);
  }

  function handleUpdateNames(newNames) {
    setNames(newNames);
  }

  // ── Letter picker (first visit) ──────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="app">
        <div className="letter-picker-overlay">
          <div className="letter-picker-card">
            <div className="lp-header">
              <div className="lp-logo">ED</div>
              <h1>Physician Productivity</h1>
              <p>Which letter were you assigned this week?</p>
            </div>
            <div className="lp-body">
              <input
                className="lp-input"
                type="text"
                maxLength={1}
                placeholder="e.g. H"
                value={letterPickerInput}
                onChange={e => setLetterPickerInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleLetterSubmit()}
                autoFocus
              />
              {letterError && <p className="lp-error">{letterError}</p>}
              <div className="lp-letters">
                {allLetters.map(l => (
                  <button
                    key={l}
                    className="lp-letter-btn"
                    onClick={() => setCurrentUser(l)}
                  >{l}</button>
                ))}
              </div>
              <button className="lp-submit" onClick={handleLetterSubmit}>
                Set My Letter
              </button>
              <button className="lp-skip" onClick={() => setCurrentUser('?')}>
                I don't know my letter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <span className="header-logo">ED</span>
            <div>
              <h1 className="header-title">Physician Productivity</h1>
              <p className="header-sub">
                {currentUser !== '?' && (
                  <>You are <strong>Letter {currentUser}</strong> <button onClick={() => setCurrentUser(null)} title="Change your letter" style={{background:'none',border:'none',cursor:'pointer',fontSize:'14px',padding:'0 2px',verticalAlign:'middle',opacity:0.6}}>✏️</button> · </>
                )}
                Vituity / Trinity Health
              </p>
            </div>
          </div>

          <div className="header-right">
            {isAdmin && (
              <button
                className={`btn-unblind ${unblinded ? 'active' : ''}`}
                onClick={() => setUnblinded(!unblinded)}
              >
                {unblinded ? '🔓 Unblinded' : '🔒 Blinded'}
              </button>
            )}
            {!isAdmin && !showAdminLogin && (
              <button className="btn-ghost" onClick={() => setShowAdminLogin(true)}>
                Admin
              </button>
            )}
            {showAdminLogin && !isAdmin && (
              <div className="admin-inline-login">
                <input
                  type="password"
                  placeholder="Password"
                  value={adminInput}
                  onChange={e => setAdminInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  className="admin-pw-input"
                  autoFocus
                />
                <button className="btn-primary-sm" onClick={handleAdminLogin}>Go</button>
                <button className="btn-ghost-sm" onClick={() => { setShowAdminLogin(false); setAdminInput(''); setAdminError(''); }}>✕</button>
                {adminError && <span className="admin-error">{adminError}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${view === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setView('leaderboard')}
          >📊 Weekly</button>
          <button
            className={`nav-tab ${view === 'season' ? 'active' : ''}`}
            onClick={() => setView('season')}
          >🏅 Season Avg</button>
          <button
            className={`nav-tab ${view === 'trends' ? 'active' : ''}`}
            onClick={() => setView('trends')}
          >📈 Trends</button>
          {isAdmin && (
            <button
              className={`nav-tab ${view === 'admin' ? 'active' : ''}`}
              onClick={() => setView('admin')}
            >⚙️ Admin</button>
          )}
        </nav>
      </header>

      <main className="main">
        {/* ── Weekly view ── */}
        {view === 'leaderboard' && (
          <>
            <WeekSelector
              weeks={weeks}
              selectedIdx={selectedWeekIdx}
              onSelect={setSelectedWeekIdx}
            />
            <Leaderboard
              week={selectedWeek}
              weeks={weeks}
              names={names}
              unblinded={unblinded && isAdmin}
              currentUser={currentUser}
              seasonMode={false}
            />
          </>
        )}

        {/* ── Season average view ── */}
        {view === 'season' && (
          <>
            <div className="season-header">
              <p className="season-desc">
                Cumulative averages across all <strong>{weeks.length} weeks</strong> of data.
                Only weeks with active shifts are counted per physician.
                PACE score uses averaged ESI distribution.
              </p>
            </div>
            <Leaderboard
              week={null}
              weeks={weeks}
              names={names}
              unblinded={unblinded && isAdmin}
              currentUser={currentUser}
              seasonMode={true}
            />
          </>
        )}

        {/* ── Trends view ── */}
        {view === 'trends' && (
          <TrendView
            weeks={weeks}
            names={names}
            currentUser={currentUser}
            unblinded={unblinded && isAdmin}
          />
        )}

        {/* ── Admin view ── */}
        {view === 'admin' && isAdmin && (
          <AdminPanel
            weeks={weeks}
            names={names}
            onAddWeek={handleAddWeek}
            onUpdateNames={handleUpdateNames}
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
