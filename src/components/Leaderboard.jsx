import { useMemo, useState } from 'react';
import './Leaderboard.css';

const ESI_COLORS = ['#f85149', '#f97316', '#eab308', '#3fb950', '#58a6ff'];

// ESI complexity weights for PACE calculation
const DEFAULT_WEIGHTS = { esi1: 4.0, esi2: 2.5, esi3: 1.5, esi4: 0.8, esi5: 0.5 };

// ── PACE calculation ─────────────────────────────────────────────────────────
function calcPACE(physicians, weights = DEFAULT_WEIGHTS) {
  const active = physicians.filter(p => p.pts > 0);
  if (active.length === 0) return {};

  const withCWP = active.map(p => {
    const cwp =
      p.esi1 * weights.esi1 +
      p.esi2 * weights.esi2 +
      p.esi3 * weights.esi3 +
      p.esi4 * weights.esi4 +
      p.esi5 * weights.esi5;
    return { ...p, cwp, acuityIndex: p.pts > 0 ? cwp / p.pts : 0 };
  });

  const groupAvgPthr   = withCWP.reduce((s, p) => s + p.pthr, 0) / withCWP.length;
  const groupAvgAcuity = withCWP.reduce((s, p) => s + p.acuityIndex, 0) / withCWP.length;

  const result = {};
  withCWP.forEach(p => {
    const expectedPthr = groupAvgAcuity > 0
      ? groupAvgPthr * (p.acuityIndex / groupAvgAcuity)
      : groupAvgPthr;
    result[p.letter] = {
      acuityIndex: p.acuityIndex,
      expectedPthr,
      pace: expectedPthr > 0 ? p.pthr / expectedPthr : null,
    };
  });
  return result;
}

// ── Season average builder ───────────────────────────────────────────────────
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
    const avg = (field) => entries.reduce((s, e) => s + e[field], 0) / n;
    return {
      letter,
      pts:   Math.round(avg('pts') * 10) / 10,
      pthr:  Math.round(avg('pthr') * 100) / 100,
      esi1:  Math.round(avg('esi1') * 10) / 10,
      esi2:  Math.round(avg('esi2') * 10) / 10,
      esi3:  Math.round(avg('esi3') * 10) / 10,
      esi4:  Math.round(avg('esi4') * 10) / 10,
      esi5:  Math.round(avg('esi5') * 10) / 10,
      weeksActive: n,
      _isAvg: true,
    };
  });
}

// ── ESI mini-bar ─────────────────────────────────────────────────────────────
function EsiBar({ p }) {
  const vals = [p.esi1, p.esi2, p.esi3, p.esi4, p.esi5];
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return <span className="esi-empty">—</span>;
  return (
    <div className="esi-bar">
      {vals.map((v, i) =>
        v > 0 ? (
          <div
            key={i}
            className="esi-segment"
            style={{ width: `${(v / total) * 100}%`, background: ESI_COLORS[i] }}
            title={`ESI ${i + 1}: ${typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : v}`}
          />
        ) : null
      )}
    </div>
  );
}

// ── PACE badge ───────────────────────────────────────────────────────────────
function PaceBadge({ pace }) {
  if (pace == null) return <span className="pace-null">—</span>;
  const cls =
    pace >= 1.1  ? 'pace-high' :
    pace >= 0.95 ? 'pace-mid'  : 'pace-low';
  return <span className={`pace-badge ${cls}`}>{pace.toFixed(2)}</span>;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Leaderboard({ week, weeks, names, unblinded, currentUser, seasonMode }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState('pthr'); // 'pthr' | 'pace'

  // Build the physician list — either single week or season averages
  const physicians = useMemo(() => {
    if (seasonMode && weeks) {
      return buildSeasonAverages(weeks);
    }
    return week ? week.physicians : [];
  }, [week, weeks, seasonMode]);

  // PACE metrics — for season mode use averaged ESI values
  const paceMap = useMemo(() => calcPACE(physicians), [physicians]);

  // Sort: active physicians first by selected metric, inactive at bottom
  const sorted = useMemo(() => {
    const active   = physicians.filter(p => p.pts > 0);
    const inactive = physicians.filter(p => p.pts === 0)
                               .sort((a, b) => a.letter.localeCompare(b.letter));

    const ranked = [...active].sort((a, b) => {
      if (sortBy === 'pace') {
        const pa = paceMap[a.letter]?.pace ?? -Infinity;
        const pb = paceMap[b.letter]?.pace ?? -Infinity;
        return pb - pa;
      }
      return b.pthr - a.pthr || b.pts - a.pts;
    });

    return [...ranked, ...inactive];
  }, [physicians, paceMap, sortBy]);

  const displayName = (letter) => {
    if (unblinded && names[letter]) return names[letter];
    return letter;
  };

  const fmt = (v) =>
    v == null ? '—' :
    typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : v;

  if (!physicians.length) {
    return <p className="lb-empty">No data for this week.</p>;
  }

  let activeRank = 0;

  return (
    <div className="leaderboard-wrap">
      {/* Controls */}
      <div className="lb-controls">
        {seasonMode && (
          <span className="lb-season-badge">
            Season avg · {weeks?.length ?? 0} weeks
          </span>
        )}
        <div className="lb-sort-group">
          <span className="lb-sort-label">Sort:</span>
          <button
            className={`lb-sort-btn ${sortBy === 'pthr' ? 'active' : ''}`}
            onClick={() => setSortBy('pthr')}
          >Pt/hr</button>
          <button
            className={`lb-sort-btn ${sortBy === 'pace' ? 'active' : ''}`}
            onClick={() => setSortBy('pace')}
          >⚾ PACE</button>
        </div>
        <button
          className={`lb-advanced-btn ${showAdvanced ? 'active' : ''}`}
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? '▾ Hide Advanced' : '▸ Show Advanced Stats'}
        </button>
      </div>

      <div className="lb-scroll">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="col-rank">#</th>
              <th className="col-name">Physician</th>
              <th className="col-pthr">Pt/hr</th>
              <th className="col-pts">#Pts</th>
              {seasonMode && <th className="col-weeks">Wks</th>}
              <th className="col-esi">ESI 1</th>
              <th className="col-esi">ESI 2</th>
              <th className="col-esi">ESI 3</th>
              <th className="col-esi">ESI 4</th>
              <th className="col-esi">ESI 5</th>
              <th className="col-bar">Mix</th>
              {showAdvanced && <>
                <th className="col-acuity">Acuity Idx</th>
                <th className="col-exp">Exp Pt/hr</th>
                <th className="col-pace">PACE</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isActive   = p.pts > 0;
              const isSelf     = p.letter === currentUser;
              const pace       = paceMap[p.letter];
              const prevActive = i > 0 && sorted[i - 1].pts > 0;
              const showDivider = !isActive && prevActive && sorted.some(x => x.pts === 0);

              if (isActive) activeRank++;

              return (
                <>
                  {showDivider && (
                    <tr key={`div-${p.letter}`} className="divider-row">
                      <td colSpan={99}>
                        <span className="divider-label">No shifts this week</span>
                      </td>
                    </tr>
                  )}
                  <tr
                    key={p.letter}
                    className={[
                      'lb-row',
                      isActive  ? '' : 'inactive',
                      isSelf    ? 'self' : '',
                      activeRank === 1 && isActive ? 'top' : '',
                    ].join(' ')}
                  >
                    <td className="col-rank">
                      {isActive
                        ? activeRank === 1
                          ? <span className="trophy">🏆</span>
                          : <span className="rank-num">{activeRank}</span>
                        : null}
                    </td>
                    <td className="col-name">
                      <span className="physician-label">{displayName(p.letter)}</span>
                      {isSelf && <span className="you-badge">you</span>}
                    </td>
                    <td className="col-pthr mono">
                      {isActive ? p.pthr.toFixed(2) : '—'}
                    </td>
                    <td className="col-pts mono">
                      {isActive ? fmt(p.pts) : '—'}
                    </td>
                    {seasonMode && (
                      <td className="col-weeks mono">
                        {p.weeksActive ?? '—'}
                      </td>
                    )}
                    {[p.esi1, p.esi2, p.esi3, p.esi4, p.esi5].map((v, ei) => (
                      <td key={ei} className="col-esi mono">
                        {isActive ? fmt(v) : '—'}
                      </td>
                    ))}
                    <td className="col-bar">
                      {isActive ? <EsiBar p={p} /> : null}
                    </td>
                    {showAdvanced && <>
                      <td className="col-acuity mono">
                        {isActive && pace ? pace.acuityIndex.toFixed(2) : '—'}
                      </td>
                      <td className="col-exp mono">
                        {isActive && pace ? pace.expectedPthr.toFixed(2) : '—'}
                      </td>
                      <td className="col-pace">
                        {isActive ? <PaceBadge pace={pace?.pace} /> : '—'}
                      </td>
                    </>}
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdvanced && (
        <p className="pace-explainer">
          <strong>PACE</strong> = Actual Pt/hr ÷ Expected Pt/hr (case-mix adjusted).{' '}
          <span className="pace-high">≥1.10 ahead of pace</span> ·{' '}
          <span className="pace-mid">0.95–1.09 on pace</span> ·{' '}
          <span className="pace-low">&lt;0.95 below pace</span>
        </p>
      )}
    </div>
  );
}
