import { useMemo } from 'react';
import './Leaderboard.css';

const ESI_COLORS = ['#f85149', '#f97316', '#eab308', '#3fb950', '#58a6ff'];
const ESI_LABELS = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'];

function EsiBar({ physician }) {
  const counts = [physician.esi1, physician.esi2, physician.esi3, physician.esi4, physician.esi5];
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return <span className="esi-empty">—</span>;

  return (
    <div className="esi-bar-wrap">
      <div className="esi-bar">
        {counts.map((count, i) =>
          count > 0 ? (
            <div
              key={i}
              className="esi-segment"
              style={{
                width: `${(count / total) * 100}%`,
                background: ESI_COLORS[i],
              }}
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

export default function Leaderboard({ week, names, unblinded, currentUser }) {
  const { active, inactive } = useMemo(() => {
    if (!week) return { active: [], inactive: [] };
    const active = week.physicians
      .filter(p => p.pts > 0)
      .sort((a, b) => b.pthr - a.pthr || b.pts - a.pts);
    const inactive = week.physicians
      .filter(p => p.pts === 0)
      .sort((a, b) => a.letter.localeCompare(b.letter));
    return { active, inactive };
  }, [week]);

  const maxPthr = useMemo(() =>
    active.length > 0 ? active[0].pthr : 0,
    [active]
  );

  if (!week) return <div className="lb-empty">No data available.</div>;

  function displayName(p) {
    if (!unblinded) return p.letter;
    return names[p.letter] ? `${p.letter} — ${names[p.letter]}` : p.letter;
  }

  const groupAvg = active.length > 0
    ? (active.reduce((s, p) => s + p.pthr, 0) / active.length).toFixed(2)
    : '—';
  const groupTotal = active.reduce((s, p) => s + p.pts, 0);

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
          <span className="stat-value">{groupAvg}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Top Producer</span>
          <span className="stat-value gold-text">
            {active[0] ? `${displayName(active[0])} (${active[0].pthr.toFixed(2)})` : '—'}
          </span>
        </div>
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
            </tr>
          </thead>
          <tbody>
            {active.map((p, idx) => {
              const rank = idx + 1;
              const isMe = p.letter === currentUser;
              const isTop = rank === 1;
              return (
                <tr
                  key={p.letter}
                  className={`lb-row ${isMe ? 'row-me' : ''} ${isTop ? 'row-top' : ''}`}
                >
                  <td className="col-rank">
                    <RankBadge rank={rank} />
                  </td>
                  <td className="col-letter">
                    <span className={`physician-id ${isMe ? 'is-me' : ''}`}>
                      {displayName(p)}
                    </span>
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
                  <td className="col-mix">
                    <EsiBar physician={p} />
                  </td>
                </tr>
              );
            })}

            {inactive.length > 0 && (
              <>
                <tr className="divider-row">
                  <td colSpan={10}>
                    <span className="divider-label">No shifts this week</span>
                  </td>
                </tr>
                {inactive.map(p => (
                  <tr key={p.letter} className="lb-row row-inactive">
                    <td className="col-rank">
                      <span className="rank-badge muted">—</span>
                    </td>
                    <td className="col-letter">
                      <span className="physician-id muted">{displayName(p)}</span>
                    </td>
                    <td className="col-pts num muted">0</td>
                    <td className="col-pthr muted">—</td>
                    <td className="col-esi num muted">{p.esi1 || '—'}</td>
                    <td className="col-esi num muted">{p.esi2 || '—'}</td>
                    <td className="col-esi num muted">{p.esi3 || '—'}</td>
                    <td className="col-esi num muted">{p.esi4 || '—'}</td>
                    <td className="col-esi num muted">{p.esi5 || '—'}</td>
                    <td className="col-mix" />
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
