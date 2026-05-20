import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import './TrendView.css';

const COLORS = [
  '#2dd4bf', '#f59e0b', '#58a6ff', '#3fb950', '#bc8cff',
  '#f97316', '#f85149', '#94a3b8', '#e879f9', '#fb7185',
  '#34d399', '#fbbf24', '#60a5fa', '#a78bfa', '#f472b6',
  '#4ade80', '#facc15', '#38bdf8', '#818cf8', '#fb923c',
];

export default function TrendView({ weeks, names, currentUser, unblinded }) {
  const [highlightLetter, setHighlightLetter] = useState(currentUser);

  // Build per-physician trend data
  const { chartData, letters } = useMemo(() => {
    if (!weeks || weeks.length === 0) return { chartData: [], letters: [] };

    // Get all unique letters with at least one active week
    const letterSet = new Set();
    weeks.forEach(w => w.physicians.forEach(p => {
      if (p.pts > 0) letterSet.add(p.letter);
    }));
    const letters = Array.from(letterSet).sort();

    // Build week-by-week data points (oldest first for chart)
    const reversed = [...weeks].reverse();
    const chartData = reversed.map(week => {
      const row = { week: week.label };
      week.physicians.forEach(p => {
        if (p.pthr !== null) row[p.letter] = p.pthr;
      });
      // Group avg
      const active = week.physicians.filter(p => p.pts > 0);
      row.__avg = active.length > 0
        ? parseFloat((active.reduce((s, p) => s + p.pthr, 0) / active.length).toFixed(2))
        : null;
      return row;
    });

    return { chartData, letters };
  }, [weeks]);

  function displayLabel(letter) {
    if (!unblinded) return `Physician ${letter}`;
    return names[letter] ? names[letter] : `Physician ${letter}`;
  }

  if (weeks.length < 1) {
    return (
      <div className="trend-empty">
        <p>No data yet. Add more weekly data to see trends.</p>
      </div>
    );
  }

  if (weeks.length < 2) {
    return (
      <div className="trend-empty">
        <p>Add a second week of data to view trends over time.</p>
        <p className="trend-hint">Currently showing: {weeks[0]?.label}</p>
      </div>
    );
  }

  return (
    <div className="trend-wrap">
      <div className="trend-header">
        <div>
          <h2 className="trend-title">Pt/hr Trends</h2>
          <p className="trend-sub">{weeks.length} weeks of data</p>
        </div>
        <div className="trend-legend">
          {letters.map((letter, i) => (
            <button
              key={letter}
              className={`legend-pill ${highlightLetter === letter ? 'active' : ''}`}
              style={{ '--pill-color': COLORS[i % COLORS.length] }}
              onClick={() => setHighlightLetter(highlightLetter === letter ? null : letter)}
            >
              {unblinded && names[letter] ? names[letter] : letter}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-card">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="week"
              tick={{ fill: '#8b949e', fontSize: 11 }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 11 }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e6edf3',
              }}
              formatter={(val, name) => [
                val?.toFixed(2) ?? '—',
                name === '__avg' ? 'Group Avg' : displayLabel(name)
              ]}
            />
            {/* Group average reference */}
            <Line
              type="monotone"
              dataKey="__avg"
              stroke="#484f58"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name="__avg"
            />
            {letters.map((letter, i) => {
              const color = COLORS[i % COLORS.length];
              const isHighlighted = highlightLetter === letter;
              const isMe = letter === currentUser;
              const opacity = highlightLetter
                ? (isHighlighted ? 1 : 0.12)
                : (isMe ? 1 : 0.55);
              return (
                <Line
                  key={letter}
                  type="monotone"
                  dataKey={letter}
                  stroke={color}
                  strokeWidth={isHighlighted || isMe ? 2.5 : 1.5}
                  dot={{ r: isHighlighted ? 4 : 2, fill: color }}
                  activeDot={{ r: 6 }}
                  opacity={opacity}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-physician summary table */}
      <div className="trend-table-wrap">
        <h3 className="section-title">Summary by Physician</h3>
        <table className="trend-table">
          <thead>
            <tr>
              <th>Physician</th>
              <th className="num">Weeks Active</th>
              <th className="num">Avg Pt/hr</th>
              <th className="num">Best Week</th>
              <th className="num">Total Pts</th>
            </tr>
          </thead>
          <tbody>
            {letters
              .map(letter => {
                const rows = weeks.map(w => w.physicians.find(p => p.letter === letter)).filter(Boolean);
                const active = rows.filter(p => p.pts > 0);
                const avgPthr = active.length > 0
                  ? (active.reduce((s, p) => s + p.pthr, 0) / active.length).toFixed(2)
                  : '—';
                const bestPthr = active.length > 0
                  ? Math.max(...active.map(p => p.pthr)).toFixed(2)
                  : '—';
                const totalPts = rows.reduce((s, p) => s + p.pts, 0);
                return { letter, weeksActive: active.length, avgPthr, bestPthr, totalPts };
              })
              .sort((a, b) => parseFloat(b.avgPthr) - parseFloat(a.avgPthr))
              .map((row, i) => {
                const isMe = row.letter === currentUser;
                return (
                  <tr key={row.letter} className={`trend-row ${isMe ? 'row-me' : ''}`}>
                    <td>
                      <span className="physician-id mono" style={{ color: COLORS[letters.indexOf(row.letter) % COLORS.length] }}>
                        {displayLabel(row.letter)}
                      </span>
                      {isMe && <span className="you-tag">you</span>}
                    </td>
                    <td className="num">{row.weeksActive}</td>
                    <td className="num">{row.avgPthr}</td>
                    <td className="num">{row.bestPthr}</td>
                    <td className="num">{row.totalPts}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
