import { useState } from 'react';
import './AdminPanel.css';

const BLANK_ROW = () => ({
  letter: '', pts: '', pthr: '', esi1: '', esi2: '', esi3: '', esi4: '', esi5: ''
});

export default function AdminPanel({
  weeks, names, onAddWeek, onUpdateNames,
  unblinded, onToggleUnblinded, currentUser, onSetCurrentUser
}) {
  const [tab, setTab] = useState('add-week'); // 'add-week' | 'names' | 'settings'
  const [weekLabel, setWeekLabel] = useState('');
  const [weekId, setWeekId] = useState('');
  const [rows, setRows] = useState([BLANK_ROW()]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [nameEdits, setNameEdits] = useState({ ...names });
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  function handleRowChange(idx, field, value) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }
  function addRow() { setRows(prev => [...prev, BLANK_ROW()]); }
  function removeRow(idx) { setRows(prev => prev.filter((_, i) => i !== idx)); }

  function handleSubmitWeek() {
    setError('');
    setSuccess('');
    if (!weekLabel.trim()) { setError('Week label is required (e.g. "Week of 5/10–5/16")'); return; }

    let physicians;
    if (jsonMode) {
      try {
        physicians = JSON.parse(jsonInput);
        if (!Array.isArray(physicians)) throw new Error('Must be an array');
      } catch (e) {
        setError('Invalid JSON: ' + e.message); return;
      }
    } else {
      physicians = rows
        .filter(r => r.letter.trim())
        .map(r => ({
          letter: r.letter.trim().toUpperCase(),
          pts: parseInt(r.pts) || 0,
          pthr: r.pthr === '' || r.pthr === null ? null : parseFloat(r.pthr),
          esi1: parseInt(r.esi1) || 0,
          esi2: parseInt(r.esi2) || 0,
          esi3: parseInt(r.esi3) || 0,
          esi4: parseInt(r.esi4) || 0,
          esi5: parseInt(r.esi5) || 0,
        }));
    }
    if (physicians.length === 0) { setError('No physician data entered.'); return; }

    const id = weekId.trim() || `week-${Date.now()}`;
    onAddWeek({ id, label: weekLabel.trim(), dateRange: weekLabel.trim(), physicians });
    setSuccess(`Week "${weekLabel}" added successfully!`);
    setWeekLabel('');
    setWeekId('');
    setRows([BLANK_ROW()]);
    setJsonInput('');
  }

  function handleSaveNames() {
    onUpdateNames(nameEdits);
    setSuccess('Name mappings saved!');
    setTimeout(() => setSuccess(''), 3000);
  }

  // Extract all known letters from seed + weeks
  const allLetters = [...new Set(weeks.flatMap(w => w.physicians.map(p => p.letter)))].sort();

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <h2 className="admin-title">Admin Panel</h2>
        <p className="admin-sub">Manage weekly data, physician names, and display settings.</p>
      </div>

      <div className="admin-tabs">
        {['add-week', 'names', 'settings'].map(t => (
          <button
            key={t}
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); setError(''); setSuccess(''); }}
          >
            {{ 'add-week': 'Add Week', names: 'Name Mappings', settings: 'Settings' }[t]}
          </button>
        ))}
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* ADD WEEK TAB */}
      {tab === 'add-week' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Add Weekly Data</h3>
              <p className="panel-sub">Enter the physician data for a new week. All fields except Letter are optional.</p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => setJsonMode(!jsonMode)}
            >
              {jsonMode ? '📋 Switch to Form' : '{ } JSON Mode'}
            </button>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Week Label *</label>
              <input
                className="field-input"
                placeholder="e.g. Week of 5/10–5/16"
                value={weekLabel}
                onChange={e => setWeekLabel(e.target.value)}
              />
            </div>
            <div className="field field-sm">
              <label className="field-label">Week ID (optional)</label>
              <input
                className="field-input"
                placeholder="e.g. 2025-W20"
                value={weekId}
                onChange={e => setWeekId(e.target.value)}
              />
            </div>
          </div>

          {jsonMode ? (
            <div className="field">
              <label className="field-label">Physician Data (JSON array)</label>
              <textarea
                className="field-textarea"
                rows={12}
                placeholder={`[\n  { "letter": "H", "pts": 48, "pthr": 2.53, "esi1": 0, "esi2": 9, "esi3": 36, "esi4": 2, "esi5": 0 },\n  ...\n]`}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
              />
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Letter *</th>
                    <th>#pts</th>
                    <th>Pt/hr</th>
                    <th>ESI 1</th>
                    <th>ESI 2</th>
                    <th>ESI 3</th>
                    <th>ESI 4</th>
                    <th>ESI 5</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      {['letter', 'pts', 'pthr', 'esi1', 'esi2', 'esi3', 'esi4', 'esi5'].map(field => (
                        <td key={field}>
                          <input
                            className={`cell-input ${field === 'letter' ? 'letter-cell' : ''}`}
                            value={row[field]}
                            placeholder={field === 'letter' ? 'A' : '0'}
                            onChange={e => handleRowChange(idx, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td>
                        <button className="row-remove" onClick={() => removeRow(idx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-ghost add-row-btn" onClick={addRow}>
                + Add Physician
              </button>
            </div>
          )}

          <div className="panel-actions">
            <button className="btn btn-primary" onClick={handleSubmitWeek}>
              Save Week
            </button>
          </div>
        </div>
      )}

      {/* NAMES TAB */}
      {tab === 'names' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Physician Name Mappings</h3>
              <p className="panel-sub">Map blinded letters to physician names. Names are only shown when unblinded mode is enabled.</p>
            </div>
          </div>
          <div className="names-grid">
            {allLetters.map(letter => (
              <div key={letter} className="name-row">
                <span className="name-letter">{letter}</span>
                <input
                  className="field-input"
                  placeholder={`Name for ${letter}`}
                  value={nameEdits[letter] || ''}
                  onChange={e => setNameEdits(prev => ({ ...prev, [letter]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={handleSaveNames}>
              Save Names
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <div className="panel">
          <h3 className="panel-title">Display Settings</h3>

          <div className="settings-list">
            <div className="setting-row">
              <div>
                <div className="setting-label">Unblinded Mode</div>
                <div className="setting-desc">Show physician names instead of letter codes</div>
              </div>
              <button
                className={`toggle-pill ${unblinded ? 'on' : 'off'}`}
                onClick={onToggleUnblinded}
              >
                {unblinded ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Your Letter</div>
                <div className="setting-desc">Your blinded identifier — this row will be highlighted</div>
              </div>
              <input
                className="field-input setting-input"
                maxLength={1}
                value={currentUser}
                onChange={e => onSetCurrentUser(e.target.value.toUpperCase())}
                style={{ width: 60, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Admin Password</div>
                <div className="setting-desc">Default: ed2025 — edit in src/data.js to change</div>
              </div>
              <span className="setting-static">ed2025</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
