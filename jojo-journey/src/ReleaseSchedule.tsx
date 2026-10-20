import { CalendarDays, ChevronRight, Clock3, Film, BookOpen, Pause, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { PARTS, nextScheduledDate, releaseFor, todayKey, validDate, type ScheduleKey, type State } from './model';

export const formatReleaseDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function ReleaseCards({ state, onEdit }: { state: State; onEdit: () => void }) {
  return <section className="release-section" aria-label="Upcoming releases"><div className="release-section-header"><span><span className="live-dot" />THE ADVENTURE CONTINUES</span><button onClick={onEdit}>Manage schedule <ChevronRight size={13} /></button></div><div className="release-cards">
    {(['sbr', 'jojolands'] as const).map(key => {
      const schedule = state.schedules[key], part = PARTS[key === 'sbr' ? 6 : 8], release = releaseFor(state, part);
      const count = key === 'sbr' ? release.episodes : release.chapters;
      return <button key={key} className={`release-card ${key}`} onClick={onEdit} aria-label={`Manage ${part.title} release schedule`}><span className="release-icon">{key === 'sbr' ? <Film size={21} /> : <BookOpen size={21} />}</span><div className="release-info"><span>{part.title}<span className="release-cadence">{key === 'sbr' ? 'EVERY FRIDAY' : 'MONTHLY'}</span></span><b>{schedule.enabled ? `${key === 'sbr' ? 'Episode' : 'Chapter'} ${count + 1}` : 'Updates paused'}<small>{schedule.enabled ? <><CalendarDays size={11} />{formatReleaseDate(schedule.nextRelease)}</> : <><Pause size={11} />Resume anytime</>}</small></b></div><ChevronRight size={15} /></button>;
    })}
  </div><p className="release-disclaimer">Scheduled estimates · counts update automatically; breaks may need an adjustment.</p></section>;
}

export function ScheduleForm({ state, onSave, onClose }: { state: State; onSave: (next: State) => void; onClose: () => void }) {
  const [schedules, setSchedules] = useState(structuredClone(state.schedules));
  const [counts, setCounts] = useState({ sbr: releaseFor(state, PARTS[6]).episodes, jojolands: releaseFor(state, PARTS[8]).chapters });
  const [error, setError] = useState('');
  const today = todayKey();
  function change(key: ScheduleKey, field: string, value: string | boolean | number) { setSchedules({ ...schedules, [key]: { ...schedules[key], [field]: value } }); }
  return <div className="modal-body schedule-modal"><span className="eyebrow purple">ALWAYS ANOTHER CHAPTER</span><h2>Keep the adventure going.</h2><p className="muted">Your release catalog grows on a schedule. Watched and read progress changes only when you log it.</p>
    <form onSubmit={e => {
      e.preventDefault();
      for (const key of ['sbr', 'jojolands'] as const) {
        const s = schedules[key];
        if (!validDate(s.nextRelease) || (s.enabled && s.nextRelease <= today)) { setError('Choose a future date for the next automatic release. Set the current count to include everything released so far.'); return; }
        if (key === 'sbr' && new Date(`${s.nextRelease}T12:00:00Z`).getUTCDay() !== 5) { setError('Choose a Friday for the next Steel Ball Run episode.'); return; }
      }
      const next = { ...state, schedules, releases: { ...state.releases }, progress: { ...state.progress } };
      for (const key of ['sbr', 'jojolands'] as const) {
        const part = PARTS[key === 'sbr' ? 6 : 8], field = key === 'sbr' ? 'episodes' : 'chapters', medium = key === 'sbr' ? 'anime' : 'manga';
        const old = releaseFor(state, part);
        next.releases[part.id] = { ...old, [field]: counts[key], adapted: field === 'chapters' ? Math.min(old.adapted, counts[key]) : counts[key] === 0 ? 0 : old.adapted };
        if (next.progress[part.id]) next.progress[part.id] = { ...next.progress[part.id], [medium]: Math.min(next.progress[part.id][medium], counts[key]) };
      }
      onSave(next);
    }}>
      {(['sbr', 'jojolands'] as const).map(key => { const s = schedules[key]; return <div key={key} className="schedule-editor"><div className="schedule-editor-heading"><span className={`release-icon ${key}`}>{key === 'sbr' ? <Film size={20} /> : <BookOpen size={20} />}</span><div><h3>{key === 'sbr' ? 'Steel Ball Run' : 'The JOJOLands'}</h3><span>{key === 'sbr' ? 'One new episode every Friday' : 'One new chapter every month'}</span></div><label className="switch"><input type="checkbox" aria-label={`${key === 'sbr' ? 'Steel Ball Run' : 'JOJOLands'} automatic updates`} checked={s.enabled} onChange={e => { const enabled = e.target.checked; setSchedules({ ...schedules, [key]: { ...s, enabled, nextRelease: enabled && s.nextRelease <= today ? nextScheduledDate(today, s.cadence, s.day) : s.nextRelease } }); }} /><span /></label></div><div className="schedule-fields"><label>Current {key === 'sbr' ? 'episode' : 'chapter'}<input type="number" required min={0} max={10000} aria-label={`Current ${key === 'sbr' ? 'Steel Ball Run episode' : 'JOJOLands chapter'}`} value={counts[key]} onChange={e => setCounts({ ...counts, [key]: Number(e.target.value) })} /></label><label>Next release<input type="date" required min={s.enabled ? nextDay(today) : undefined} aria-label={`${key === 'sbr' ? 'Steel Ball Run' : 'JOJOLands'} next release`} value={s.nextRelease} onChange={e => change(key, 'nextRelease', e.target.value)} /></label>{key === 'jojolands' && <label>Monthly day<input type="number" min={1} max={31} required aria-label="JOJOLands monthly release day" value={s.day} onChange={e => { const day = Number(e.target.value); setSchedules({ ...schedules, [key]: { ...s, day, nextRelease: day >= 1 && day <= 31 ? nextScheduledDate(today, 'monthly', day) : s.nextRelease } }); }} /></label>}</div></div>; })}
      <div className="info-box schedule-info"><Clock3 size={18} /><p>Dates use your device's local calendar, starting at midnight. The app catches up on opening, when you return to the tab, and every minute while open. This schedule follows your counts of <b>SBR episode 6</b> and <b>JOJOLands chapter 41</b> on October 19, 2026; it does not verify publisher releases. Pause for hiatuses or move the next date for a delay.</p></div><p className="small muted">Lowering a release count also lowers any personal progress above it. Longer breaks do not add releases while paused. Adapted manga chapter counts remain manual because episodes don't cover a fixed number of chapters.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Save schedule <RefreshCw size={15} /></button></div>
    </form>
  </div>;
}
function nextDay(today: string) { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
