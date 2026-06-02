import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { SEED_WEEKS, DEFAULT_NAMES, ADMIN_PASSWORD } from './data';
import Leaderboard from './components/Leaderboard';
import AdminPanel from './components/AdminPanel';
import WeekSelector from './components/WeekSelector';
import TrendView from './components/TrendView';
import './App.css';

const DATA_VERSION = 3; // bump this every time you add a new week

export default function App() {
  const [weeks, setWeeks] = useLocalStorage('lb-weeks', SEED_WEEKS);
  const [names, setNames] = useLocalStorage('lb-names', DEFAULT_NAMES);
  const [unblinded, setUnblinded] = useLocalStorage('lb-unblinded', false);
  const [currentUser, setCurrentUser] = useLocalStorage('lb-current-user', null);
  const [dataVersion, setDataVersion] = useLocalStorage('lb-data-version', 0);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [view, setView] = useState('leaderboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [letterPickerInput, setLetterPickerInput] = useState('');
  const [letterError, setLetterError] = useState('');

  // Sync seed data when version bumps
  useEffect(() => {
    if (dataVersion < DATA_VERSION) {
      setWeeks(SEED_WEEKS);
      setDataVersion(DATA_VERSION);
    }
  }, [dataVersion]);

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

            <di
