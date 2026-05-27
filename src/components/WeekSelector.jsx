import './WeekSelector.css';

export default function WeekSelector({ weeks, selectedIdx, onSelect, onChange }) {
  const handler = onSelect || onChange;
  if (!weeks || weeks.length === 0) return null;
  return (
    <div className="week-selector">
      <label className="week-label">Week</label>
      <div className="week-tabs">
        {weeks.map((week, idx) => (
          <button key={week.id} className={`week-tab ${idx === selectedIdx ? 'active' : ''}`} onClick={() => handler(idx)}>
            {week.label}
          </button>
        ))}
      </div>
    </div>
  );
}
