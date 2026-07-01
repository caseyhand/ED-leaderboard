import { useState } from 'react';

export default function HoursView({ week, weeks, names, currentUser, unblinded }) {
  const [mode, setMode] = useState('week'); // 'week' | 'season'

  // ---- This week ----
  const weekRows = week
    ? Object.entries(week.hoursWorked || {})
        .map(([letter, hours]) => ({ letter, hours }))
        .sort((a, b) => b.hours - a.hours)
    : [];

  // ---- Season total ----
  const seasonTotals = {};
  weeks.forEach(w => {
    Object.entries(w.hoursWorked || {}).forEach(([letter, hours]) => {
      seasonTotals[letter] = (seasonTotals[letter] || 0) + (hours || 0);
    });
  });
  const seasonRows = Object.entries(seasonTotals)
    .map(([letter, hours]) => ({ letter, hours }))
    .sort((a, b) => b.hours - a.hours);

  const rows = mode === 'week' ? weekRows : seasonRows;
  const maxHours = Math.max(1, ...rows.map(r => r.hours));

  function displayName(letter) {
    if (unblinded && names[letter]) return `${names[letter]} (${letter})`;
    return letter;
  }

  return (
    <div className="hours-view">
      <div className="hours-header">
        <h2 className="hours-title">Hours Worked</h2>
        <div className="hours-mode-toggle">
          <button
            className={`hours-mode-btn ${mode === 'week' ? 'active' : ''}`}
            onClick={() => setMode('week')}
          >
            This Week
          </button>
          <button
            className={`hours-mode-btn ${mode === 'season' ? 'active' : ''}`}
            onClick={() => setMode('season')}
          >
            Season Total
          </button>
        </div>
      </div>

      {mode === 'week' && week && (
        <p className="hours-sub">{week.label}</p>
      )}
      {mode === 'season' && (
        <p className="hours-sub">Across all {weeks.length} weeks on record</p>
      )}

      <div className="hours-list">
        {rows.map((row, i) => {
          const isZero = row.hours === 0;
          const isMe = row.letter === currentUser;
          const pct = Math.round((row.hours / maxHours) * 100);
          return (
            <div
              key={row.letter}
              className={`hours-row ${isZero ? 'hours-row-zero' : ''} ${isMe ? 'hours-row-me' : ''}`}
            >
              <div className="hours-row-label">{displayName(row.letter)}</div>
              <div className="hours-bar-track">
                <div className="hours-bar-fill" style={{ width: `${isZero ? 0 : pct}%` }} />
              </div>
              <div className="hours-row-value">{row.hours}h</div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="hours-empty">No hours data for this week yet.</p>
        )}
      </div>
    </div>
  );
}
