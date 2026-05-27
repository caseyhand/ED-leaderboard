import { useState } from 'react';
import './AdminPanel.css';

const BLANK_ROW = () => ({
  letter: '', pts: '', pthr: '', esi1: '', esi2: '', esi3: '', esi4: '', esi5: ''
});

// Smart parser — handles tab-separated email/Excel paste, CSV, or JSON
function parseSmartPaste(text) {
  text = text.trim();

  // Try JSON first
  if (text.startsWith('[')) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
    return parsed.map(normalizeRow);
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) throw new Error('No data found');

  // Detect delimiter: tab (Excel/email copy) or comma (CSV)
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map(l => l.split(delimiter).map(c => c.trim().replace(/^"|"$/g, '')));

  // Check if first row looks like a header
  const firstRowLower = rows[0].map(c => c.toLowerCase());
  const hasHeader = firstRowLower.some(c =>
    c.includes('letter') || c.includes('pt') || c.includes('esi') || c === 'pts'
  );

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const headers = hasHeader ? firstRowLower : null;

  return dataRows
    .filter(r => r.length >= 2 && r[0].trim())
    .map(r => {
      if (headers) {
        // Map by header name
        const obj = {};
        headers.forEach((h, i) => { obj[h] = r[i] || ''; });
        return normalizeFromHeaders(obj);
      } else {
        // Assume positional: LETTER, #pts, Pt/hr, ESI1, ESI2, ESI3, ESI4, ESI5
        return {
          letter: r[0]?.trim().toUpperCase() || '',
          pts: parseInt(r[1]) || 0,
          pthr: r[2] && r[2] !== '' ? parseFloat(r[2]) : null,
          esi1: parseInt(r[3]) || 0,
          esi2: parseInt(r[4]) || 0,
          esi3: parseInt(r[5]) || 0,
          esi4: parseInt(r[6]) || 0,
          esi5: parseInt(r[7]) || 0,
        };
      }
    })
    .filter(r => r.letter);
}

function normalizeFromHeaders(obj) {
  const get = (...keys) => {
    for (const k of keys) {
      for (const [ok, ov] of Object.entries(obj)) {
        if (ok.replace(/\s/g,'').includes(k.replace(/\s/g,''))) return ov;
      }
    }
    return '';
  };
  const pthr = get('pt/hr','pthr','pt hr');
  return {
    letter: (get('letter') || '').trim().toUpperCase(),
    pts: parseInt(get('#pts','pts','patients')) || 0,
    pthr: pthr !== '' ? parseFloat(pthr) : null,
    esi1: parseInt(get('esi1','esi 1')) || 0,
    esi2: parseInt(get('esi2','esi 2')) || 0,
    esi3: parseInt(get('esi3','esi 3')) || 0,
    esi4: parseInt(get('esi4','esi 4')) || 0,
    esi5: parseInt(get('esi5','esi 5')) || 0,
  };
}

function normalizeRow(r) {
  return {
    letter: (r.letter || '').toString().trim().toUpperCase(),
    pts: parseInt(r.pts) || 0,
    pthr: r.pthr != null && r.pthr !== '' ? parseFloat(r.pthr) : null,
    esi1: parseInt(r.esi1) || 0,
    esi2: parseInt(r.esi2) || 0,
    esi3: parseInt(r.esi3) || 0,
    esi4: parseInt(r.esi4) || 0,
    esi5: parseInt(r.esi5) || 0,
  };
}

export default function AdminPanel({
  weeks, names, onAddWeek, onUpdateNames,
  unblinded, onToggleUnblinded, currentUser, onSetCurrentUser
}) {
  const [tab, setTab] = useState('add-week');
  const [weekLabel, setWeekLabel] = useState('');
  const [weekId, setWeekId] = useState('');
  const [inputMode, setInputMode] = useState('paste'); // 'paste' | 'form' | 'json'
  const [pasteText, setPasteText] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [rows, setRows] = useState([BLANK_ROW()]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [nameEdits, setNameEdits] = useState({ ...names });
  const [jsonInput, setJsonInput] = useState('');

  function handlePasteChange(text) {
    setPasteText(text);
    setParseError('');
    setParsedPreview(null);
    if (!text.trim()) return;
    try {
      const parsed = parseSmartPaste(text);
      setParsedPreview(parsed);
    } catch (e) {
      setParseError('Could not parse — try the manual form instead. (' + e.message + ')');
    }
  }

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
    if (inputMode === 'paste') {
      if (!parsedPreview || parsedPreview.length === 0) { setError('Paste data and verify the preview first.'); return; }
      physicians = parsedPreview;
    } else if (inputMode === 'json') {
      try {
        physicians = JSON.parse(jsonInput).map(normalizeRow);
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
    if (!physicians || physicians.length === 0) { setError('No physician data found.'); return; }

    const id = weekId.trim() || `week-${Date.now()}`;
    onAddWeek({ id, label: weekLabel.trim(), dateRange: weekLabel.trim(), physicians });
    setSuccess(`Week "${weekLabel}" added! ${physicians.length} physicians loaded.`);
    setWeekLabel('');
    setWeekId('');
    setRows([BLANK_ROW()]);
    setPasteText('');
    setParsedPreview(null);
    setJsonInput('');
  }

  function handleSaveNames() {
    onUpdateNames(nameEdits);
    setSuccess('Name mappings saved!');
    setTimeout(() => setSuccess(''), 3000);
  }

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
              <p className="panel-sub">Paste Wendy's email table, a CSV, or enter manually.</p>
            </div>
            <div className="mode-tabs">
              {[['paste','📋 Paste'], ['form','✏️ Manual'], ['json','{ } JSON']].map(([m, label]) => (
                <button
                  key={m}
                  className={`mode-tab ${inputMode === m ? 'active' : ''}`}
                  onClick={() => setInputMode(m)}
                >{label}</button>
              ))}
            </div>
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
          </div>

          {/* PASTE MODE */}
          {inputMode === 'paste' && (
            <div className="paste-section">
              <div className="field">
                <label className="field-label">
                  Paste Table Data
                  <span className="field-hint"> — copy from Wendy's email, Excel, or any spreadsheet</span>
                </label>
                <textarea
                  className="field-textarea paste-area"
                  rows={10}
                  placeholder={
`Paste the table directly from Wendy's email or Excel. Any of these formats work:

Tab-separated (copy from email/Excel):
LETTER	#pts	Pt/hr	ESI 1	ESI 2	ESI 3	ESI 4	ESI 5
H	48	2.53	0	9	36	2	0

CSV:
H,48,2.53,0,9,36,2,0`}
                  value={pasteText}
                  onChange={e => handlePasteChange(e.target.value)}
                />
              </div>

              {parseError && (
                <div className="parse-error">⚠️ {parseError}</div>
              )}

              {parsedPreview && parsedPreview.length > 0 && (
                <div className="preview-section">
                  <div className="preview-header">
                    <span className="preview-title">✓ Parsed {parsedPreview.length} physicians — looks correct?</span>
                  </div>
                  <div className="preview-table-wrap">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Letter</th><th>#pts</th><th>Pt/hr</th>
                          <th>ESI 1</th><th>ESI 2</th><th>ESI 3</th><th>ESI 4</th><th>ESI 5</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreview.map((p, i) => (
                          <tr key={i} className={p.pts === 0 ? 'preview-inactive' : ''}>
                            <td className="mono bold">{p.letter}</td>
                            <td className="mono">{p.pts}</td>
                            <td className="mono">{p.pthr ?? '—'}</td>
                            <td className="mono">{p.esi1}</td>
                            <td className="mono">{p.esi2}</td>
                            <td className="mono">{p.esi3}</td>
                            <td className="mono">{p.esi4}</td>
                            <td className="mono">{p.esi5}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANUAL FORM MODE */}
          {inputMode === 'form' && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Letter *</th><th>#pts</th><th>Pt/hr</th>
                    <th>ESI 1</th><th>ESI 2</th><th>ESI 3</th><th>ESI 4</th><th>ESI 5</th>
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

          {/* JSON MODE */}
          {inputMode === 'json' && (
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
              <p className="panel-sub">Map blinded letters to real names. Only visible when unblinded mode is on.</p>
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
            <button className="btn btn-primary" onClick={handleSaveNames}>Save Names</button>
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
              <button className={`toggle-pill ${unblinded ? 'on' : 'off'}`} onClick={onToggleUnblinded}>
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
                <div className="setting-desc">Edit ADMIN_PASSWORD in src/data.js to change</div>
              </div>
              <span className="setting-static">ed2025</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
