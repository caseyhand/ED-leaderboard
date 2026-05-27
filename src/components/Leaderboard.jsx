import { useMemo, useState } from 'react';
import './Leaderboard.css';

const ESI_COLORS = ['#f85149', '#f97316', '#eab308', '#3fb950', '#58a6ff'];
const ESI_LABELS = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'];
const DEFAULT_WEIGHTS = { esi1: 4.0, esi2: 2.5, esi3: 1.5, esi4: 0.8, esi5: 0.5 };

function calcMetrics(physicians, weights = DEFAULT_WEIGHTS) {
  const active = physicians.filter(p => p.pts > 0);
  if (active.length === 0) return { lookup: {}, groupAvgPthr: 0, groupAvgAcuity: 0 };
  const withCWP = active.map(p => {
    const cwp = p.esi1*weights.esi1 + p.esi2*weights.esi2 + p.esi3*weights.esi3 + p.esi4*weights.esi4 + p.esi5*weights.esi5;
    return { ...p, cwp, acuityIndex: cwp / p.pts };
  });
  const groupAvgPthr = withCWP.reduce((s,p) => s+p.pthr, 0) / withCWP.length;
  const groupAvgAcuity = withCWP.reduce((s,p) => s+p.acuityIndex, 0) / withCWP.length;
  const withPACE = withCWP.map(p => {
    const expectedPthr = groupAvgAcuity > 0 ? groupAvgPthr * (p.acuityIndex / groupAvgAcuity) : groupAvgPthr;
    const pace = expectedPthr > 0 ? p.pthr / expectedPthr : 1.0;
    return { ...p, expectedPthr, pace, delta: p.pthr - expectedPthr };
  });
  const lookup = {};
  withPACE.forEach(p => { lookup[p.letter] = p; });
  return { lookup, groupAvgPthr, groupAvgAcuity };
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
    const avg = f => entries.reduce((s,e) => s+e[f], 0) / n;
    return { letter, weeksActive: n, pts: Math.round(avg('pts')*10)/10, pthr: Math.round(avg('pthr')*100)/100, esi1: Math.round(avg('esi1')*10)/10, esi2: Math.round(avg('esi2')*10)/10, esi3: Math.round(avg('esi3')*10)/10, esi4: Math.round(avg('esi4')*10)/10, esi5: Math.round(avg('esi5')*10)/10 };
  });
}

function EsiBar({ physician }) {
  const counts = [physician.esi1, physician.esi2, physician.esi3, physician.esi4, physician.esi5];
  const total = counts.reduce((a,b) => a+b, 0);
  if (total === 0) return <span className="esi-empty">—</span>;
  return <div className="esi-bar-wrap"><div className="esi-bar">{counts.map((count, i) => count > 0 ? <div key={i} className="esi-segment" style={{ width: `${(count/total)*100}%`, background: ESI_COLORS[i] }} title={`${ESI_LABELS[i]}: ${typeof count==='number'&&count%1!==0?count.toFixed(1):count}`} /> : null)}</div></div>;
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="rank-badge gold">🏆</span>;
  if (rank === 2) return <span className="rank-badge silver">{rank}</span>;
  if (rank === 3) return <span className="rank-badge bronze">{rank}</span>;
  return <span className="rank-badge">{rank}</span>;
}

function PthrBar({ value, max }) {
  return <div className="pthr-bar-wrap"><span className="pthr-value">{value.toFixed(2)}</span><div className="pthr-bar"><div className="pthr-fill" style={{ width: `${max > 0 ? (value/max)*100 : 0}%` }} /></div></div>;
}

function PaceBadge({ pace, delta }) {
  const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(2);
  let cls = 'pace-badge neutral';
  if (pace >= 1.10) cls = 'pace-badge great';
  else if (pace >= 1.03) cls = 'pace-badge good';
  else if (pace <= 0.90) cls = 'pace-badge poor';
  else if (pace <= 0.97) cls = 'pace-badge below';
  return <div className="pace-wrap"><span className={cls}>{pace.toFixed(2)}</span><span className={`pace-delta ${delta >= 0 ? 'pos' : 'neg'}`}>{deltaStr} pt/hr</span></div>;
}

function AcuityPip({ acuityIndex, groupAvg }) {
  const ratio = groupAvg > 0 ? acuityIndex / groupAvg : 1;
  let label = 'avg', cls = 'acuity-pip avg';
  if (ratio >= 1.15) { label = 'high'; cls = 'acuity-pip high'; }
  else if (ratio >= 1.05) { label = 'mod+'; cls = 'acuity-pip mod-high'; }
  else if (ratio <= 0.85) { label = 'low'; cls = 'acuity-pip low'; }
  else if (ratio <= 0.95) { label = 'mod-'; cls = 'acuity-pip mod-low'; }
  return <div className="acuity-pip-wrap"><span className={cls}>{label}</span><span className="acuity-val">{acuityIndex.toFixed(2)}</span></div>;
}

export default function Leaderboard({ week, weeks, names, unblinded, currentUser, seasonMode }) {
  const [sortMode, setSortMode] = useState('pthr');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const physicians = useMemo(() => {
    if (seasonMode && weeks) return buildSeasonAverages(weeks);
    return week ? week.physicians : [];
  }, [week, weeks, seasonMode]);

  const { active, inactive } = useMemo(() => ({
    active: physicians.filter(p => p.pts > 0),
    inactive: physicians.filter(p => p.pts === 0).sort((a,b) => a.letter.localeCompare(b.letter))
  }), [physicians]);

  const { lookup, groupAvgPthr, groupAvgAcuity } = useMemo(
    () => active.length > 0 ? calcMetrics(active) : { lookup: {}, groupAvgPthr: 0, groupAvgAcuity: 0 },
    [active]
  );

  const sorted = useMemo(() => {
    const enriched = active.map(p => ({ ...p, ...(lookup[p.letter] || {}) }));
    if (sortMode === 'pace') return enriched.sort((a,b) => (b.pace||0) - (a.pace||0));
    return enriched.sort((a,b) => b.pthr - a.pthr || b.pts - a.pts);
  }, [active, lookup, sortMode]);

  const maxPthr = sorted.length > 0 ? sorted.reduce((m,p) => Math.max(m,p.pthr), 0) : 0;
  const groupTotal = active.reduce((s,p) => s+p.pts, 0);
  const topRaw = sorted.length > 0 ? [...sorted].sort((a,b) => b.pthr-a.pthr)[0] : null;
  const topPace = sorted.length > 0 ? [...sorted].sort((a,b) => (b.pace||0)-(a.pace||0))[0] : null;

  function displayName(p) {
    if (!unblinded) return p.letter;
    return names[p.letter] ? `${p.letter} — ${names[p.letter]}` : p.letter;
  }
  function fmt(v) {
    if (v == null) return '—';
    return typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : String(v);
  }

  if (!physicians.length) return <div className="lb-empty">No data available.</div>;

  return (
    <div className="lb-wrap">
      <div className="stats-bar">
        <div className="stat"><span className="stat-label">Physicians Active</span><span className="stat-value">{active.length}</span></div>
        <div className="stat"><span className="stat-label">{seasonMode ? 'Avg Pts / Week' : 'Total Patients'}</span><span className="stat-value">{seasonMode ? fmt(Math.round(groupTotal/active.length*10)/10) : groupTotal}</span></div>
        <div className="stat"><span className="stat-label">Group Avg Pt/hr</span><span className="stat-value">{groupAvgPthr.toFixed(2)}</span></div>
        <div className="stat"><span className="stat-label">{seasonMode ? 'Top Avg Pt/hr' : 'Top Raw Pt/hr'}</span><span className="stat-value gold-text">{topRaw ? `${displayName(topRaw)} (${topRaw.pthr.toFixed(2)})` : '—'}</span></div>
      </div>

      {showAdvanced && (
        <div className="pace-explainer">
          <div className="explainer-inner">
            <div className="explainer-icon">⚾</div>
            <div>
              <div className="explainer-title">PACE — Performance Above Case-mix Expectation</div>
              <div className="explainer-body">Like WAR in baseball — adjusts raw Pt/hr for the complexity of your case mix. A PACE of <strong>1.10</strong> means you saw 10% more patients than expected given your acuity load. Weights: ESI 1 = 4.0× · ESI 2 = 2.5× · ESI 3 = 1.5× · ESI 4 = 0.8× · ESI 5 = 0.5×. Group avg acuity index: <strong>{groupAvgAcuity.toFixed(2)}</strong>.</div>
            </div>
          </div>
        </div>
      )}

      <div className="lb-toolbar">
        {seasonMode && <span style={{display:'inline-flex',alignItems:'center',background:'var(--gold-dim)',border:'1px solid var(--gold-border)',color:'var(--gold)',fontSize:'11px',fontWeight:'600',letterSpacing:'0.05em',textTransform:'uppercase',padding:'3px 10px',borderRadius:'20px'}}>Season Avg · {weeks?.length ?? 0} weeks</span>}
        <div className="sort-tabs">
          <span className="sort-label">Sort by</span>
          <button className={`sort-tab ${sortMode==='pthr'?'active':''}`} onClick={() => setSortMode('pthr')}>Raw Pt/hr</button>
          <button className={`sort-tab ${sortMode==='pace'?'active':''}`} onClick={() => { setSortMode('pace'); setShowAdvanced(true); }}>⚾ PACE</button>
        </div>
        <button className={`advanced-toggle ${showAdvanced?'active':''}`} onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? '▲ Hide Advanced Stats' : '▼ Show Advanced Stats'}</button>
      </div>

      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th>Rank</th><th>Physician</th><th className="num">Pts</th><th>Pt/hr</th>
              {seasonMode && <th className="num">Wks</th>}
              <th className="num">ESI 1</th><th className="num">ESI 2</th><th className="num">ESI 3</th><th className="num">ESI 4</th><th className="num">ESI 5</th><th>Acuity Mix</th>
              {showAdvanced && <><th className="col-adv">Acuity Idx</th><th className="col-adv">Exp Pt/hr</th><th className="col-adv">PACE</th></>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const rank = idx + 1;
              const isMe = p.letter === currentUser;
              const isTop = rank === 1;
              return (
                <tr key={p.letter} className={`lb-row ${isMe?'row-me':''} ${isTop?'row-top':''}`}>
                  <td><RankBadge rank={rank} /></td>
                  <td><span className={`physician-id ${isMe?'is-me':''}`}>{displayName(p)}</span>{isMe && <span className="you-tag">you</span>}</td>
                  <td className="num">{fmt(p.pts)}</td>
                  <td><PthrBar value={p.pthr} max={maxPthr} /></td>
                  {seasonMode && <td className="num" style={{color:'var(--text-muted)'}}>{p.weeksActive ?? '—'}</td>}
                  <td className="num esi1">{fmt(p.esi1)||'—'}</td><td className="num esi2">{fmt(p.esi2)||'—'}</td><td className="num esi3">{fmt(p.esi3)||'—'}</td><td className="num esi4">{fmt(p.esi4)||'—'}</td><td className="num esi5">{fmt(p.esi5)||'—'}</td>
                  <td><EsiBar physician={p} /></td>
                  {showAdvanced && <>
                    <td className="col-adv">{p.acuityIndex != null ? <AcuityPip acuityIndex={p.acuityIndex} groupAvg={groupAvgAcuity} /> : '—'}</td>
                    <td className="col-adv num"><span className="exp-pthr">{p.expectedPthr?.toFixed(2) ?? '—'}</span></td>
                    <td className="col-adv">{p.pace != null ? <PaceBadge pace={p.pace} delta={p.delta} /> : '—'}</td>
                  </>}
                </tr>
              );
            })}
            {inactive.length > 0 && <>
              <tr className="divider-row"><td colSpan={99}><span className="divider-label">No shifts this week</span></td></tr>
              {inactive.map(p => (
                <tr key={p.letter} className="lb-row row-inactive">
                  <td><span className="rank-badge muted">—</span></td>
                  <td><span className="physician-id muted">{displayName(p)}</span></td>
                  <td className="num muted">0</td><td className="muted">—</td>
                  {seasonMode && <td />}
                  <td className="num muted">{p.esi1||'—'}</td><td className="num muted">{p.esi2||'—'}</td><td className="num muted">{p.esi3||'—'}</td><td className="num muted">{p.esi4||'—'}</td><td className="num muted">{p.esi5||'—'}</td>
                  <td />{showAdvanced && <><td /><td /><td /></>}
                </tr>
              ))}
            </>}
          </tbody>
        </table>
      </div>

      {showAdvanced && topPace && (
        <div className="pace-leaders">
          <div className="pace-leader-title">⚾ Top PACE Performers</div>
          <div className="pace-leader-list">
            {[...sorted].sort((a,b) => (b.pace||0)-(a.pace||0)).slice(0,5).map((p,i) => (
              <div key={p.letter} className={`pace-leader-row ${p.letter===currentUser?'is-me':''}`}>
                <span className="pace-leader-rank">#{i+1}</span>
                <span className="pace-leader-letter">{displayName(p)}</span>
                <span className="pace-leader-score">{p.pace?.toFixed(2)}</span>
                <span className={`pace-leader-delta ${p.delta>=0?'pos':'neg'}`}>{p.delta>=0?'+':''}{p.delta?.toFixed(2)} vs expected</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
EOFcat > ~/Desktop/ED\ Weekly\ Productivity/ed-leaderboard/src/components/Leaderboard.jsx << 'EOF'
import { useMemo, useState } from 'react';
import './Leaderboard.css';

const ESI_COLORS = ['#f85149', '#f97316', '#eab308', '#3fb950', '#58a6ff'];
const ESI_LABELS = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'];
const DEFAULT_WEIGHTS = { esi1: 4.0, esi2: 2.5, esi3: 1.5, esi4: 0.8, esi5: 0.5 };

function calcMetrics(physicians, weights = DEFAULT_WEIGHTS) {
  const active = physicians.filter(p => p.pts > 0);
  if (active.length === 0) return { lookup: {}, groupAvgPthr: 0, groupAvgAcuity: 0 };
  const withCWP = active.map(p => {
    const cwp = p.esi1*weights.esi1 + p.esi2*weights.esi2 + p.esi3*weights.esi3 + p.esi4*weights.esi4 + p.esi5*weights.esi5;
    return { ...p, cwp, acuityIndex: cwp / p.pts };
  });
  const groupAvgPthr = withCWP.reduce((s,p) => s+p.pthr, 0) / withCWP.length;
  const groupAvgAcuity = withCWP.reduce((s,p) => s+p.acuityIndex, 0) / withCWP.length;
  const withPACE = withCWP.map(p => {
    const expectedPthr = groupAvgAcuity > 0 ? groupAvgPthr * (p.acuityIndex / groupAvgAcuity) : groupAvgPthr;
    const pace = expectedPthr > 0 ? p.pthr / expectedPthr : 1.0;
    return { ...p, expectedPthr, pace, delta: p.pthr - expectedPthr };
  });
  const lookup = {};
  withPACE.forEach(p => { lookup[p.letter] = p; });
  return { lookup, groupAvgPthr, groupAvgAcuity };
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
    const avg = f => entries.reduce((s,e) => s+e[f], 0) / n;
    return { letter, weeksActive: n, pts: Math.round(avg('pts')*10)/10, pthr: Math.round(avg('pthr')*100)/100, esi1: Math.round(avg('esi1')*10)/10, esi2: Math.round(avg('esi2')*10)/10, esi3: Math.round(avg('esi3')*10)/10, esi4: Math.round(avg('esi4')*10)/10, esi5: Math.round(avg('esi5')*10)/10 };
  });
}

function EsiBar({ physician }) {
  const counts = [physician.esi1, physician.esi2, physician.esi3, physician.esi4, physician.esi5];
  const total = counts.reduce((a,b) => a+b, 0);
  if (total === 0) return <span className="esi-empty">—</span>;
  return <div className="esi-bar-wrap"><div className="esi-bar">{counts.map((count, i) => count > 0 ? <div key={i} className="esi-segment" style={{ width: `${(count/total)*100}%`, background: ESI_COLORS[i] }} title={`${ESI_LABELS[i]}: ${typeof count==='number'&&count%1!==0?count.toFixed(1):count}`} /> : null)}</div></div>;
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="rank-badge gold">🏆</span>;
  if (rank === 2) return <span className="rank-badge silver">{rank}</span>;
  if (rank === 3) return <span className="rank-badge bronze">{rank}</span>;
  return <span className="rank-badge">{rank}</span>;
}

function PthrBar({ value, max }) {
  return <div className="pthr-bar-wrap"><span className="pthr-value">{value.toFixed(2)}</span><div className="pthr-bar"><div className="pthr-fill" style={{ width: `${max > 0 ? (value/max)*100 : 0}%` }} /></div></div>;
}

function PaceBadge({ pace, delta }) {
  const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(2);
  let cls = 'pace-badge neutral';
  if (pace >= 1.10) cls = 'pace-badge great';
  else if (pace >= 1.03) cls = 'pace-badge good';
  else if (pace <= 0.90) cls = 'pace-badge poor';
  else if (pace <= 0.97) cls = 'pace-badge below';
  return <div className="pace-wrap"><span className={cls}>{pace.toFixed(2)}</span><span className={`pace-delta ${delta >= 0 ? 'pos' : 'neg'}`}>{deltaStr} pt/hr</span></div>;
}

function AcuityPip({ acuityIndex, groupAvg }) {
  const ratio = groupAvg > 0 ? acuityIndex / groupAvg : 1;
  let label = 'avg', cls = 'acuity-pip avg';
  if (ratio >= 1.15) { label = 'high'; cls = 'acuity-pip high'; }
  else if (ratio >= 1.05) { label = 'mod+'; cls = 'acuity-pip mod-high'; }
  else if (ratio <= 0.85) { label = 'low'; cls = 'acuity-pip low'; }
  else if (ratio <= 0.95) { label = 'mod-'; cls = 'acuity-pip mod-low'; }
  return <div className="acuity-pip-wrap"><span className={cls}>{label}</span><span className="acuity-val">{acuityIndex.toFixed(2)}</span></div>;
}

export default function Leaderboard({ week, weeks, names, unblinded, currentUser, seasonMode }) {
  const [sortMode, setSortMode] = useState('pthr');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const physicians = useMemo(() => {
    if (seasonMode && weeks) return buildSeasonAverages(weeks);
    return week ? week.physicians : [];
  }, [week, weeks, seasonMode]);

  const { active, inactive } = useMemo(() => ({
    active: physicians.filter(p => p.pts > 0),
    inactive: physicians.filter(p => p.pts === 0).sort((a,b) => a.letter.localeCompare(b.letter))
  }), [physicians]);

  const { lookup, groupAvgPthr, groupAvgAcuity } = useMemo(
    () => active.length > 0 ? calcMetrics(active) : { lookup: {}, groupAvgPthr: 0, groupAvgAcuity: 0 },
    [active]
  );

  const sorted = useMemo(() => {
    const enriched = active.map(p => ({ ...p, ...(lookup[p.letter] || {}) }));
    if (sortMode === 'pace') return enriched.sort((a,b) => (b.pace||0) - (a.pace||0));
    return enriched.sort((a,b) => b.pthr - a.pthr || b.pts - a.pts);
  }, [active, lookup, sortMode]);

  const maxPthr = sorted.length > 0 ? sorted.reduce((m,p) => Math.max(m,p.pthr), 0) : 0;
  const groupTotal = active.reduce((s,p) => s+p.pts, 0);
  const topRaw = sorted.length > 0 ? [...sorted].sort((a,b) => b.pthr-a.pthr)[0] : null;
  const topPace = sorted.length > 0 ? [...sorted].sort((a,b) => (b.pace||0)-(a.pace||0))[0] : null;

  function displayName(p) {
    if (!unblinded) return p.letter;
    return names[p.letter] ? `${p.letter} — ${names[p.letter]}` : p.letter;
  }
  function fmt(v) {
    if (v == null) return '—';
    return typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : String(v);
  }

  if (!physicians.length) return <div className="lb-empty">No data available.</div>;

  return (
    <div className="lb-wrap">
      <div className="stats-bar">
        <div className="stat"><span className="stat-label">Physicians Active</span><span className="stat-value">{active.length}</span></div>
        <div className="stat"><span className="stat-label">{seasonMode ? 'Avg Pts / Week' : 'Total Patients'}</span><span className="stat-value">{seasonMode ? fmt(Math.round(groupTotal/active.length*10)/10) : groupTotal}</span></div>
        <div className="stat"><span className="stat-label">Group Avg Pt/hr</span><span className="stat-value">{groupAvgPthr.toFixed(2)}</span></div>
        <div className="stat"><span className="stat-label">{seasonMode ? 'Top Avg Pt/hr' : 'Top Raw Pt/hr'}</span><span className="stat-value gold-text">{topRaw ? `${displayName(topRaw)} (${topRaw.pthr.toFixed(2)})` : '—'}</span></div>
      </div>

      {showAdvanced && (
        <div className="pace-explainer">
          <div className="explainer-inner">
            <div className="explainer-icon">⚾</div>
            <div>
              <div className="explainer-title">PACE — Performance Above Case-mix Expectation</div>
              <div className="explainer-body">Like WAR in baseball — adjusts raw Pt/hr for the complexity of your case mix. A PACE of <strong>1.10</strong> means you saw 10% more patients than expected given your acuity load. Weights: ESI 1 = 4.0× · ESI 2 = 2.5× · ESI 3 = 1.5× · ESI 4 = 0.8× · ESI 5 = 0.5×. Group avg acuity index: <strong>{groupAvgAcuity.toFixed(2)}</strong>.</div>
            </div>
          </div>
        </div>
      )}

      <div className="lb-toolbar">
        {seasonMode && <span style={{display:'inline-flex',alignItems:'center',background:'var(--gold-dim)',border:'1px solid var(--gold-border)',color:'var(--gold)',fontSize:'11px',fontWeight:'600',letterSpacing:'0.05em',textTransform:'uppercase',padding:'3px 10px',borderRadius:'20px'}}>Season Avg · {weeks?.length ?? 0} weeks</span>}
        <div className="sort-tabs">
          <span className="sort-label">Sort by</span>
          <button className={`sort-tab ${sortMode==='pthr'?'active':''}`} onClick={() => setSortMode('pthr')}>Raw Pt/hr</button>
          <button className={`sort-tab ${sortMode==='pace'?'active':''}`} onClick={() => { setSortMode('pace'); setShowAdvanced(true); }}>⚾ PACE</button>
        </div>
        <button className={`advanced-toggle ${showAdvanced?'active':''}`} onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? '▲ Hide Advanced Stats' : '▼ Show Advanced Stats'}</button>
      </div>

      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th>Rank</th><th>Physician</th><th className="num">Pts</th><th>Pt/hr</th>
              {seasonMode && <th className="num">Wks</th>}
              <th className="num">ESI 1</th><th className="num">ESI 2</th><th className="num">ESI 3</th><th className="num">ESI 4</th><th className="num">ESI 5</th><th>Acuity Mix</th>
              {showAdvanced && <><th className="col-adv">Acuity Idx</th><th className="col-adv">Exp Pt/hr</th><th className="col-adv">PACE</th></>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const rank = idx + 1;
              const isMe = p.letter === currentUser;
              const isTop = rank === 1;
              return (
                <tr key={p.letter} className={`lb-row ${isMe?'row-me':''} ${isTop?'row-top':''}`}>
                  <td><RankBadge rank={rank} /></td>
                  <td><span className={`physician-id ${isMe?'is-me':''}`}>{displayName(p)}</span>{isMe && <span className="you-tag">you</span>}</td>
                  <td className="num">{fmt(p.pts)}</td>
                  <td><PthrBar value={p.pthr} max={maxPthr} /></td>
                  {seasonMode && <td className="num" style={{color:'var(--text-muted)'}}>{p.weeksActive ?? '—'}</td>}
                  <td className="num esi1">{fmt(p.esi1)||'—'}</td><td className="num esi2">{fmt(p.esi2)||'—'}</td><td className="num esi3">{fmt(p.esi3)||'—'}</td><td className="num esi4">{fmt(p.esi4)||'—'}</td><td className="num esi5">{fmt(p.esi5)||'—'}</td>
                  <td><EsiBar physician={p} /></td>
                  {showAdvanced && <>
                    <td className="col-adv">{p.acuityIndex != null ? <AcuityPip acuityIndex={p.acuityIndex} groupAvg={groupAvgAcuity} /> : '—'}</td>
                    <td className="col-adv num"><span className="exp-pthr">{p.expectedPthr?.toFixed(2) ?? '—'}</span></td>
                    <td className="col-adv">{p.pace != null ? <PaceBadge pace={p.pace} delta={p.delta} /> : '—'}</td>
                  </>}
                </tr>
              );
            })}
            {inactive.length > 0 && <>
              <tr className="divider-row"><td colSpan={99}><span className="divider-label">No shifts this week</span></td></tr>
              {inactive.map(p => (
                <tr key={p.letter} className="lb-row row-inactive">
                  <td><span className="rank-badge muted">—</span></td>
                  <td><span className="physician-id muted">{displayName(p)}</span></td>
                  <td className="num muted">0</td><td className="muted">—</td>
                  {seasonMode && <td />}
                  <td className="num muted">{p.esi1||'—'}</td><td className="num muted">{p.esi2||'—'}</td><td className="num muted">{p.esi3||'—'}</td><td className="num muted">{p.esi4||'—'}</td><td className="num muted">{p.esi5||'—'}</td>
                  <td />{showAdvanced && <><td /><td /><td /></>}
                </tr>
              ))}
            </>}
          </tbody>
        </table>
      </div>

      {showAdvanced && topPace && (
        <div className="pace-leaders">
          <div className="pace-leader-title">⚾ Top PACE Performers</div>
          <div className="pace-leader-list">
            {[...sorted].sort((a,b) => (b.pace||0)-(a.pace||0)).slice(0,5).map((p,i) => (
              <div key={p.letter} className={`pace-leader-row ${p.letter===currentUser?'is-me':''}`}>
                <span className="pace-leader-rank">#{i+1}</span>
                <span className="pace-leader-letter">{displayName(p)}</span>
                <span className="pace-leader-score">{p.pace?.toFixed(2)}</span>
                <span className={`pace-leader-delta ${p.delta>=0?'pos':'neg'}`}>{p.delta>=0?'+':''}{p.delta?.toFixed(2)} vs expected</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
