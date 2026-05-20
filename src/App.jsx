import { useState, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
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
  const [currentUser, setCurrentUser] = useLocalStorage('lb-current-user', 'H');
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [view, setView] = useState('leaderboard'); // 'leaderboard' | 'trends' | 'admin'
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput] = useState('');

  const selectedWeek = weeks[selectedWeekIdx] || weeks[0];

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
    const updated = [weekData, ...weeks];
    setWeeks(updated);
    setSelectedWeekIdx(0);
  }

  function handleUpdateNames(newNames) {
    setNames(newNames);
  }

  function handleLogout() {
    setIsAdmin(false);
    setView('leaderboard');
    setUnblinded(false);
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
            <button
              className={`nav-btn ${view === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setView('leaderboard')}
            >
              Leaderboard
            </button>
            <button
              className={`nav-btn ${view === 'trends' ? 'active' : ''}`}
              onClick={() => setView('trends')}
            >
              Trends
            </button>
            {isAdmin ? (
              <>
                <button
                  className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
                  onClick={() => setView('admin')}
                >
                  Admin
                </button>
                <button className="nav-btn admin-active" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <button
                className="nav-btn"
                onClick={() => setShowAdminLogin(true)}
              >
                Admin
              </button>
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
              <button className="btn btn-primary" onClick={handleAdminLogin}>
                Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="main">
        {view === 'leaderboard' && (
          <>
            <div className="toolbar">
              <WeekSelector
                weeks={weeks}
                selectedIdx={selectedWeekIdx}
                onChange={setSelectedWeekIdx}
              />
              <div className="toolbar-right">
                <div className="user-badge">
                  You are <span className="letter-chip">{currentUser}</span>
                </div>
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
            <Leaderboard
              week={selectedWeek}
              names={names}
              unblinded={unblinded && isAdmin}
              currentUser={currentUser}
            />
          </>
        )}

        {view === 'trends' && (
          <TrendView weeks={weeks} names={names} currentUser={currentUser} unblinded={unblinded && isAdmin} />
        )}

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
