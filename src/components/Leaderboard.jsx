import { useMemo, useState } from 'react';
import './Leaderboard.css';

const ESI_COLORS = ['#f85149', '#f97316', '#eab308', '#3fb950', '#58a6ff'];
const DEFAULT_WEIGHTS = { esi1: 4.0, esi2: 2.5, esi3: 1.5, esi4: 0.8, esi5: 0.5 };

function calcPACE(physicians, weights = DEFAULT_WEIGHTS) {
  const active = physicians.filter(p => p.pts > 0);
  if (active.length === 0) return {};
  const withCWP = active.map(p => {
    const cwp = p.esi1*weights.esi1 + p.esi2*weights.esi2 + p.esi3*weights.esi3 + p.esi4*weights.esi4 + p.esi5*weights.esi5;
    return { ...p, cwp, acuityIndex: p.pts > 0 ? cwp / p.pts : 0 };
  });
  const groupAvgPthr = withCWP.reduce((s,p) => s+p.pthr, 0) / withCWP.length;
  const groupAvgAcuity = withCWP.reduce((s,p) => s+p.acuityIndex, 0) / withCWP.length;
  const result = {};
  withCWP.forEach(p => {
    const expectedPthr = groupAvgAcuity > 0 ? groupAvgPthr * (p.acuityIndex / groupAvgAcuity) : groupAvgPthr;
    result[p.letter] = { acuityIndex: p.acuityIndex, expectedPthr, pace: expectedPthr > 0 ? p.pthr / expectedPthr : null };
  });
  return result;
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
    return {
      letter,
      pts: Math.round(avg('pts')*10)/10,
      pthr: Math.round(avg('pthr')*100)/100,
      esi1: Math.round(avg('esi1')*10)/10,
      esi2: Math.round(avg('esi2')*10)/10,
      esi3: Math.round(avg('esi3')*10)/10,
      esi4: Math.round(avg('esi4')*10)/10,
      esi5: Math.round(avg('esi5')*10)/10,
      weeksActive: n,
    };
  });
}

function EsiBar({ p }) {
  const vals = [p.esi1, p.esi2, p.esi3, p.esi4, p.esi5];
  const total = vals.reduce((a,b) => a+b, 0);
  if (!total) return <span className="esi-empty">—</span>;
  return (
    <div className="esi-bar">
      {vals.map((v,i) => v > 0 ? (
        <div key={i} className="esi-segment"
          style={{ width: `${(v/total)*100}%`, background: ESI_COLORS[i] }}
          title={`ESI ${i+1}: ${typeof v==='number' && v%1!==0 ? v.toFixed(1) : v}`} />
      ) : null)}
    </div>
  );
}

function PaceBadge({ pace }) {
  if (pace == null) return <span style={{color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>—</span>;
  const cls = pace>=1.15 ? 'great' : pace>=1.05 ? 'good' : pace>=0.95 ? 'neutral' : pace>=0.85 ? 'below' : 'poor';
  return <div className="pace-wrap"><span className={`pace-badge ${cls}`}>{pace.toFixed(2)}</span></div>;
}

export default function Leaderboard({ week, weeks, names, unblinded, currentUser, seasonMode }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState('pthr');

  const physicians = useMemo(() => {
    if (seasonMode && weeks) return buildSeasonAverages(weeks);
    return week ? week.physicians : [];
  }, [week, weeks, seasonMode]);

  const paceMap = useMemo(() => calcPACE(physicians), [physicians]);

  const maxPthr = useMemo(() => {
    const active = physicians.filter(p => p.pts > 0);
    return active.length ? Math.max(...active.map(p => p.pthr)) : 1;
  }, [physicians]);

  const stats = useMemo(() => {
    const active = physicians.filter(p => p.pts > 0);
    if (!active.length) return null;
    const totalPts = active.reduce((s,p) => s+p.pts, 0);
    const groupAvgPthr = active.reduce((s,p) => s+p.pthr, 0) / active.length;
    const top = [...active].sort((a,b) => b.pthr-a.pthr)[0];
    return { active: active.length, totalPts, groupAvgPthr, top };
  }, [physicians]);

  const sorted = useMemo(() => {
    const active = physicians.filter(p => p.pts > 0);
    const inactive = physicians.filter(p => p.pts === 0).sort((a,b) => a.letter.localeCompare(b.letter));
    const ranked = [...active].sort((a,b) => {
      if (sortBy === 'pace') {
        return (paceMap[b.letter]?.pace ?? -Infinity) - (paceMap[a.letter]?.pace ?? -Infinity);
      }
      return b.pthr - a.pthr || b.pts - a.pts;
    });
    return [...ranked, ...inactive];
  }, [physicians, paceMap, sortBy]);

  const displayName = letter => (unblinded && names[letter]) ? names[letter] : letter;
  const fmt = v => v == null ? '—' : typeof v==='number' && v%1!==0 ? v.toFixed(1) : String(v);

  if (!physicians.length) return <p className="lb-empty">No data for this period.</p>;

  let activeRank = 0;

  return (
    <div className="lb-wrap">
      {stats && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Physicians Active</span>
            <span className="stat-value">{stats.active}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{seasonMode ? 'Avg Pts / Week' : 'Total Patients'}</span>
            <span className="stat-value">{seasonMode ? fmt(Math.round(stats.totalPts/stats.active*10)/10) : stats.totalPts}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Group Avg Pt/hr</span>
            <span className="stat-value">{stats.groupAvgPthr.toFixed(2)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{seasonMode ? 'Top Avg Pt/hr' : 'Top Raw Pt/hr'}</span>
            <span className="stat-value gold-text">{displayName(stats.top.letter)} ({stats.top.pthr.toFixed(2)})</span>
          </div>
        </div>
      )}

      <div className="lb-toolbar">
        {seasonMode && (
          <span style={{display:'inline-flex',alignItems:'center',background:'var(--gold-dim)',border:'1px solid var(--gold-border)',color:'var(--gold)',fontSize:'11px',fontWeight:'600',letterSpacing:'0.05em',textTransform:'uppercase',padding:'3px 10px',borderRadius:'20px'}}>
            Season Avg · {weeks?.length ?? 0} weeks
          </span>
        )}
        <div className="sort-tabs">
          <span className="sort-label">Sort:</span>
          <button className={`sort-tab ${sortBy==='pthr'?'active':''}`} onClick={() => setSortBy('pthr')}>Pt/hr</button>
          <button className={`sort-tab ${sortBy==='pace'?'active':''}`} onClick={() => setSortBy('pace')}>⚾ PACE</button>
        </div>
        <button className={`advanced-toggle ${showAdvanced?'active':''}`} onClick={() => setShowAdvanced(v => !v)}>
          {showAdvanced ? '▾ Hide Advanced Stats' : '▸ Show Advanced Stats'}
        </button>
      </div>

      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th style={{width:'40px',textAlign:'center'}}>#</th>
              <th>Physician</th>
              <th>Pt/hr</th>
              <th className="num">Pts</th>
              {seasonMode && <th className="num">Wks</th>}
              <th className="num">ESI 1</th>
              <th className="num">ESI 2</th>
              <th className="num">ESI 3</th>
              <th className="num">ESI 4</th>
              <th className="num">ESI 5</th>
              <th>Mix</th>
              {showAdvanced && <>
                <th className="num">Acuity Idx</th>
                <th className="num">Exp Pt/hr</th>
                <th className="num">PACE</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isActive = p.pts > 0;
              const isSelf = p.letter === currentUser;
              const pace = paceMap[p.letter];
              const showDivider = !isActive && i > 0 && sorted[i-1].pts > 0;
              if (isActive) activeRank++;
              const isTop = isActive && activeRank === 1;
              const rowClass = ['lb-row', !isActive?'row-inactive':'', isTop&&!isSelf?'row-top':'', isSelf&&!isTop?'row-me':'', isTop&&isSelf?'row-top row-me':''].join(' ');
              return (
                <>
                  {showDivider && (
                    <tr key={`div-${p.letter}`} className="divider-row">
                      <td colSpan={99}><span className="divider-label">No Shifts This Week</span></td>
                    </tr>
                  )}
                  <tr key={p.letter} className={rowClass}>
                    <td style={{textAlign:'center'}}>
                      {isActive ? (isTop
                        ? <span className="rank-badge gold">🏆</span>
                        : <span className={`rank-badge ${activeRank===2?'silver':activeRank===3?'bronze':'muted'}`}>{activeRank}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`physician-id ${isSelf?'is-me':!isActive?'muted':''}`}>{displayName(p.letter)}</span>
                      {isSelf && <span className="you-tag">you</span>}
                    </td>
                    <td>
                      {isActive ? (
                        <div className="pthr-bar-wrap">
                          <span className="pthr-value">{p.pthr.toFixed(2)}</span>
                          <div className="pthr-bar"><div className="pthr-fill" style={{width:`${(p.pthr/maxPthr)*100}%`}}/></div>
                        </div>
                      ) : <span style={{color:'var(--text-muted)'}}>—</span>}
                    </td>
                    <td className="num">{isActive ? fmt(p.pts) : '—'}</td>
                    {seasonMode && <td className="num" style={{color:'var(--text-muted)'}}>{p.weeksActive ?? '—'}</td>}
                    {[p.esi1,p.esi2,p.esi3,p.esi4,p.esi5].map((v,ei) => (
                      <td key={ei} className={`num ${isActive?`esi${ei+1}`:'muted'}`}>{isActive ? fmt(v) : '—'}</td>
                    ))}
                    <td>{isActive ? <EsiBar p={p}/> : null}</td>
                    {showAdvanced && <>
                      <td className="col-adv num">
                        {isActive && pace ? (
                          <div className="acuity-pip-wrap">
                            <span className={`acuity-pip ${pace.acuityIndex>=2.0?'high':pace.acuityIndex>=1.7?'mod-high':pace.acuityIndex>=1.4?'avg':pace.acuityIndex>=1.1?'mod-low':'low'}`}>
                              {pace.acuityIndex>=2.0?'High':pace.acuityIndex>=1.7?'Mod-Hi':pace.acuityIndex>=1.4?'Avg':pace.acuityIndex>=1.1?'Mod-Lo':'Low'}
                            </span>
                            <span className="acuity-val">{pace.acuityIndex.toFixed(2)}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="col-adv num">{isActive && pace ? <span className="exp-pthr">{pace.expectedPthr.toFixed(2)}</span> : '—'}</td>
                      <td className="col-adv num">{isActive ? <PaceBadge pace={pace?.pace}/> : '—'}</td>
                    </>}
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdvanced && (
        <div className="pace-explainer">
          <div className="explainer-inner">
            <span className="explainer-icon">⚾</span>
            <div>
              <div className="explainer-title">PACE — Performance Above Case-mix Expectation</div>
              <div className="explainer-body">
                <strong>PACE = Actual Pt/hr ÷ Expected Pt/hr</strong>, where expected is adjusted for your ESI case mix.
                A score of <strong>1.10</strong> means you saw 10% more patients than expected given your acuity load.
                Weights: ESI 1 = 4.0 · ESI 2 = 2.5 · ESI 3 = 1.5 · ESI 4 = 0.8 · ESI 5 = 0.5
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
