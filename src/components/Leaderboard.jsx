import { useMemo, useState } from 'react';
import './Leaderboard.css';

const ESI_COLORS = ['#f85149', '#f97316', '#eab308', '#3fb950', '#58a6ff'];
const ESI_LABELS = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'];

// Default ESI time weights — admin-tunable in future
const DEFAULT_WEIGHTS = { esi1: 4.0, esi2: 2.5, esi3: 1.5, esi4: 0.8, esi5: 0.5 };

function calcMetrics(physicians, weights = DEFAULT_WEIGHTS) {
  const active = physicians.filter(p => p.pts > 0);
  if (active.length === 0) return {};

  // Step 1: Complexity-weighted patients per physician
  const withCWP = active.map(p => {
    const cwp = (p.esi1 * weights.esi1) + (p.esi2 * weights.esi2) +
                (p.esi3 * weights.esi3) + (p.esi4 * weights.esi4) +
                (p.esi5 * weights.esi5);
    const acuityIndex = p.pts > 0 ? cwp / p.pts : 0;
    return { ...p, cwp, acuityIndex };
  });

  // Step 2: Group averages
  const groupAvgPthr = withCWP.reduce((s, p) => s + p.pthr, 0) / withCWP.length;
  const groupAvgAcuity = withCWP.reduce((s, p) => s + p.acuityIndex, 0) / withCWP.length;

  // Step 3: Expected Pt/hr and PACE per physician
  const withPACE = withCWP.map(p => {
    // Expected pt/hr adjusts group average by how much harder/easier this physician's patients were
    const expectedPthr = groupAvgAcuity > 0
      ? groupAvgPthr * (p.acuityIndex / groupAvgAcuity)
      : groupAvgPthr;
    const pace = expectedPthr > 0 ? p.pthr / expectedPthr : 1.0;
    const delta = p.pthr - expectedPthr;
    return { ...p, expectedPthr, pace, delta };
  });

  // Build lookup by letter
  const lookup = {};
  withPACE.forEach(p => { lookup[p.letter] = p; });
  return { lookup, groupAvgPthr, groupAvgAcuity };
}

function EsiBar({ physician }) {
  const counts = [physician.esi1, physician.esi2, physician.esi3, physician.esi4, physician.esi5];
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return <span className="esi-empty">—</span>;
  return (
    <div className="esi-bar-wrap">
      <div className="esi-bar">
        {counts.map((count, i) =>
          count > 0 ? (
            <div key={i} className="esi-segment"
              style={{ width: `${(count / total) * 100}%`, background: ESI_COLORS[i] }}
              title={`${ESI_LABELS[i]}: ${count}`}
            />
          ) : null
        )}
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="rank-badge gold">🏆</span>;
  if (rank === 2) return <span className="rank-badge silver">{rank}</span>;
  if (rank === 3) return <span className="rank-badge bronze">{rank}</span>;
  return <span className="rank-badge">{rank}</span>;
}

function PthrBar({ value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="pthr-bar-wrap">
      <span className="pthr-value">{value.toFixed(2)}</span>
      <div className="pthr-bar">
        <div className="pthr-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PaceBadge({ pace, delta }) {
  const pct = ((pace - 1) * 100);
  const isPositive = pct >= 0;
  const absStr = Math.abs(pct).toFixed(0);
  const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(2);

  let cls = 'pace-badge neutral';
  if (pace >= 1.10) cls = 'pace-badge great';
  else if (pace >= 1.03) cls = 'pace-badge good';
  else if (pace <= 0.90) cls = 'pace-badge poor';
  else if (pace <= 0.97) cls = 'pace-badge below';

  return (
    <div className="pace-wrap">
      <span className={cls}>{pace.toFixed(2)}</span>
      <span className={`pace-delta ${isPositive ? 'pos' : 'neg'}`}>
        {deltaStr} pt/hr
      </span>
    </div>
  );
}

function AcuityPip({ acuityIndex, groupAvg }) {
  const ratio = groupAvg > 0 ? acuityIndex / groupAvg : 1;
  let label = 'avg';
  let cls = 'acuity-pip avg';
  if (ratio >= 1.15) { label = 'high'; cls = 'acuity-pip high'; }
  else if (ratio >= 1.05) { label = 'mod+'; cls = 'acuity-pip mod-high'; }
  else if (ratio <= 0.85) { label = 'low'; cls = 'acuity-pip low'; }
  else if (ratio <= 0.95) { label = 'mod-'; cls = 'acuity-pip mod-low'; }
  return (
    <div className="acuity-pip-wrap">
      <span className={cls}>{label}</span>
      <span className="acuity-val">{acuityIndex.toFixed(2)}</span>
    </div>
  );
}


function buildSeasonAverages(weeks) {
  const map = {};
  weeks.forEach(week => {
    week.physicians.forEach(p => {
      if (p.pts === 0) return;
      if (!map[p.letter]) map[p.letter] = { letter: p.letter, entries: [] };
      map[p.letter].entries.push(p);
    });
  });
  return Object.values(map).map(({ letter, entries }) => {
    const n = entries.length;
    const avg = f => entries.reduce((s, e) => s + e[f], 0) / n;
    return {
      letter, weeksActive: n,
      pts:  Math.round(avg('pts') * 10) / 10,
      pthr: Math.round(avg('pthr') * 100) / 100,
      esi1: Math.round(avg('esi1') * 10) / 10,
      esi2: Math.round(avg('esi2') * 10) / 10,
      esi3: Math.round(avg('esi3') * 10) / 10,
      esi4: Math.round(avg('esi4') * 10) / 10,
      esi5: Math.round(avg('esi5') * 10) / 10,
    };
  });
}

export default function Leaderboard({ week, weeks, names, unblinded, currentUser, seasonMode }) {
  const [sortMode, setSortMode] = useState('pthr'); // 'pthr' | 'pace'
  const [showAdvanced, setShowAdvanced] = useState(false);

  const physicians = useMemo(() => {
    if (seasonMode && weeks) return buildSeasonAverages(weeks);
    return week ? week.physicians : [];
  }, [week, weeks, seasonMode]);

  const { active, inactive } = useMemo(() => {
    if (!physicians.length) return { active: [], inactive: [] };
    const active = physicians.filter(p => p.pts > 0);
    const inactive = physicians
      .filter(p => p.pts === 0)
      .sort((a, b) => a.letter.localeCompare(b.letter));
    return { active, inactive };
  }, [week]);

  const { lookup, groupAvgPthr, groupAvgAcuity } = useMemo(
    () => active.length > 0 ? calcMetrics(active) : { lookup: {}, groupAvgPthr: 0, groupAvgAcuity: 0 },
    [active]
  );

  const sorted = useMemo(() => {
    const enriched = active.map(p => ({ ...p, ...(lookup[p.letter] || {}) }));
    if (sortMode === 'pace') {
      return enriched.sort((a, b) => (b.pace || 0) - (a.pace || 0));
    }
    return enriched.sort((a, b) => b.pthr - a.pthr || b.pts - a.pts);
  }, [active, lookup, sortMode]);

  const maxPthr = sorted.length > 0 ? sorted.reduce((m, p) => Math.max(m, p.pthr), 0) : 0;
  const maxAapr = sorted.length > 0 ? sorted.reduce((m, p) => Math.max(m, p.pace || 0), 0) : 0;

  if (!week && !seasonMode) return <div className="lb-empty">No data available.</div>;

  function displayName(p) {
    if (!unblinded) return p.letter;
    return names[p.letter] ? `${p.letter} — ${names[p.letter]}` : p.letter;
  }

  const groupTotal = active.reduce((s, p) => s + p.pts, 0);

  // Top by each metric
  const topRaw = sorted.length > 0 ? [...sorted].sort((a,b) => b.pthr - a.pthr)[0] : null;
  const topAapr = sorted.length > 0 ? [...sorted].sort((a,b) => (b.pace||0) - (a.pace||0))[0] : null;

  const colSpan = showAdvanced ? 13 : 10;

  return (
    <div className="lb-wrap">
      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-label">Physicians Active</span>
          <span className="stat-value">{active.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total Patients</span>
          <span className="stat-value">{groupTotal}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Group Avg Pt/hr</span>
          <span className="stat-value">{groupAvgPthr.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Top Raw Pt/hr</span>
          <span className="stat-value gold-text">
            {topRaw ? `${displayName(topRaw)} (${topRaw.pthr.toFixed(2)})` : '—'}
          </span>
        </div>
      </div>

      {/* PACE explainer card — shown when advanced mode on */}
      {showAdvanced && (
        <div className="pace-explainer">
          <div className="explainer-inner">
            <div className="explainer-icon">⚾</div>
            <div>
              <div className="explainer-title">Acuity-Adjusted Performance Rating (PACE)</div>
              <div className="explainer-body">
                Like WAR in baseball — adjusts raw Pt/hr for the complexity of your case mix.
                A PACE of <strong>1.10</strong> means you're seeing 10% more patients than expected
                given your acuity. Weights: ESI 1 = 4.0×, ESI 2 = 2.5×, ESI 3 = 1.5×, ESI 4 = 0.8×, ESI 5 = 0.5×.
                Group avg acuity index: <strong>{groupAvgAcuity.toFixed(2)}</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="lb-toolbar">
        <div className="sort-tabs">
          <span className="sort-label">Sort by</span>
          <button
            className={`sort-tab ${sortMode === 'pthr' ? 'active' : ''}`}
            onClick={() => setSortMode('pthr')}
          >
            Raw Pt/hr
          </button>
          <button
            className={`sort-tab ${sortMode === 'pace' ? 'active' : ''}`}
            onClick={() => { setSortMode('pace'); setShowAdvanced(true); }}
          >
            ⚾ PACE
          </button>
        </div>
        <button
          className={`advanced-toggle ${showAdvanced ? 'active' : ''}`}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▲ Hide Advanced Stats' : '▼ Show Advanced Stats'}
        </button>
      </div>

      {/* Table */}
      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="col-rank">Rank</th>
              <th className="col-letter">Physician</th>
              <th className="col-pts">Pts</th>
              <th className="col-pthr">Pt/hr</th>
              <th className="col-esi num">ESI 1</th>
              <th className="col-esi num">ESI 2</th>
              <th className="col-esi num">ESI 3</th>
              <th className="col-esi num">ESI 4</th>
              <th className="col-esi num">ESI 5</th>
              <th className="col-mix">Acuity Mix</th>
              {showAdvanced && <>
                <th className="col-adv">Acuity Idx</th>
                <th className="col-adv">Exp Pt/hr</th>
                <th className="col-adv">PACE</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const rank = idx + 1;
              const isMe = p.letter === currentUser;
              const isTop = rank === 1;
              return (
                <tr key={p.letter} className={`lb-row ${isMe ? 'row-me' : ''} ${isTop ? 'row-top' : ''}`}>
                  <td className="col-rank"><RankBadge rank={rank} /></td>
                  <td className="col-letter">
                    <span className={`physician-id ${isMe ? 'is-me' : ''}`}>{displayName(p)}</span>
                    {isMe && <span className="you-tag">you</span>}
                  </td>
                  <td className="col-pts num">{p.pts}</td>
                  <td className="col-pthr">
                    <PthrBar value={p.pthr} max={maxPthr} />
                  </td>
                  <td className="col-esi num esi1">{p.esi1 || '—'}</td>
                  <td className="col-esi num esi2">{p.esi2 || '—'}</td>
                  <td className="col-esi num esi3">{p.esi3 || '—'}</td>
                  <td className="col-esi num esi4">{p.esi4 || '—'}</td>
                  <td className="col-esi num esi5">{p.esi5 || '—'}</td>
                  <td className="col-mix"><EsiBar physician={p} /></td>
                  {showAdvanced && <>
                    <td className="col-adv">
                      {p.acuityIndex != null
                        ? <AcuityPip acuityIndex={p.acuityIndex} groupAvg={groupAvgAcuity} />
                        : '—'}
                    </td>
                    <td className="col-adv num">
                      <span className="exp-pthr">{p.expectedPthr?.toFixed(2) ?? '—'}</span>
                    </td>
                    <td className="col-adv">
                      {p.pace != null
                        ? <PaceBadge pace={p.pace} delta={p.delta} />
                        : '—'}
                    </td>
                  </>}
                </tr>
              );
            })}

            {inactive.length > 0 && (
              <>
                <tr className="divider-row">
                  <td colSpan={colSpan}>
                    <span className="divider-label">No shifts this week</span>
                  </td>
                </tr>
                {inactive.map(p => (
                  <tr key={p.letter} className="lb-row row-inactive">
                    <td className="col-rank"><span className="rank-badge muted">—</span></td>
                    <td className="col-letter"><span className="physician-id muted">{displayName(p)}</span></td>
                    <td className="col-pts num muted">0</td>
                    <td className="col-pthr muted">—</td>
                    <td className="col-esi num muted">{p.esi1 || '—'}</td>
                    <td className="col-esi num muted">{p.esi2 || '—'}</td>
                    <td className="col-esi num muted">{p.esi3 || '—'}</td>
                    <td className="col-esi num muted">{p.esi4 || '—'}</td>
                    <td className="col-esi num muted">{p.esi5 || '—'}</td>
                    <td className="col-mix" />
                    {showAdvanced && <><td /><td /><td /></>}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* PACE leaderboard when in advanced mode */}
      {showAdvanced && topAapr && (
        <div className="pace-leaders">
          <div className="pace-leader-title">⚾ Top PACE Performers This Week</div>
          <div className="pace-leader-list">
            {[...sorted].sort((a,b) => (b.pace||0) - (a.pace||0)).slice(0, 5).map((p, i) => (
              <div key={p.letter} className={`pace-leader-row ${p.letter === currentUser ? 'is-me' : ''}`}>
                <span className="pace-leader-rank">#{i+1}</span>
                <span className="pace-leader-letter">{displayName(p)}</span>
                <span className="pace-leader-score">{p.pace?.toFixed(2)}</span>
                <span className={`pace-leader-delta ${p.delta >= 0 ? 'pos' : 'neg'}`}>
                  {p.delta >= 0 ? '+' : ''}{p.delta?.toFixed(2)} vs expected
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
