export interface Part {
  id: number;
  title: string;
  protagonist: string;
  years: string;
  era: string;
  setting: string;
  chapters: number;
  episodes: number;
  adapted: number;
  color: string;
  ink: string;
  motif: string;
  description: string;
}

// Stable catalog baseline. Later/ongoing releases are intentionally user-maintained.
export const PARTS: Part[] = [
  { id: 1, title: 'Phantom Blood', protagonist: 'Jonathan Joestar', years: '1987', era: '1880s', setting: 'England', chapters: 44, episodes: 9, adapted: 44, color: '#c8bcf3', ink: '#413074', motif: 'mask', description: 'An ancient stone mask. Two intertwined destinies. The beginning of the Joestar legacy.' },
  { id: 2, title: 'Battle Tendency', protagonist: 'Joseph Joestar', years: '1987–1989', era: '1938–1939', setting: 'New York · Europe', chapters: 69, episodes: 17, adapted: 69, color: '#e4b56f', ink: '#735022', motif: 'sun', description: 'A new generation, an ancient threat, and a Joestar who always has one more trick up his sleeve.' },
  { id: 3, title: 'Stardust Crusaders', protagonist: 'Jotaro Kujo', years: '1989–1992', era: '1988–1989', setting: 'Japan → Egypt', chapters: 152, episodes: 48, adapted: 152, color: '#93b9db', ink: '#244b72', motif: 'star', description: 'A journey across the world introduces Stands and an unforgettable band of traveling companions.' },
  { id: 4, title: 'Diamond Is Unbreakable', protagonist: 'Josuke Higashikata', years: '1992–1995', era: '1999', setting: 'Morioh, Japan', chapters: 174, episodes: 39, adapted: 174, color: '#e8adca', ink: '#783c5b', motif: 'diamond', description: 'There is something strange about this quiet town. Welcome to the colorful streets of Morioh.' },
  { id: 5, title: 'Golden Wind', protagonist: 'Giorno Giovanna', years: '1995–1999', era: '2001', setting: 'Italy', chapters: 155, episodes: 39, adapted: 155, color: '#e8cf6b', ink: '#776322', motif: 'beetle', description: 'A golden dream takes shape in Italy, where ambition and loyalty meet on a dangerous road.' },
  { id: 6, title: 'Stone Ocean', protagonist: 'Jolyne Cujoh', years: '1999–2003', era: '2011–2012', setting: 'Florida, USA', chapters: 158, episodes: 38, adapted: 158, color: '#a9ccad', ink: '#3c6452', motif: 'butterfly', description: 'A thread of hope runs through Green Dolphin Street Prison. A new Joestar takes her stand.' },
  { id: 7, title: 'Steel Ball Run', protagonist: 'Johnny Joestar', years: '2004–2011', era: '1890', setting: 'Across the USA', chapters: 95, episodes: 6, adapted: 0, color: '#d4b595', ink: '#6b4936', motif: 'horseshoe', description: 'A cross-country race opens a new continuity. Every mile brings a different kind of adventure.' },
  { id: 8, title: 'JoJolion', protagonist: 'Josuke Higashikata', years: '2011–2021', era: '2011', setting: 'Morioh, Japan', chapters: 110, episodes: 0, adapted: 0, color: '#9ccccc', ink: '#35616e', motif: 'anchor', description: 'Back in Morioh, an unfamiliar face sets out to untangle a mystery of identity and family.' },
  { id: 9, title: 'The JOJOLands', protagonist: 'Jodio Joestar', years: '2023–ongoing', era: '2020s', setting: 'Hawaii, USA', chapters: 41, episodes: 0, adapted: 0, color: '#d4b8e2', ink: '#6d4786', motif: 'palm', description: 'The adventure continues in Hawaii. A new generation sets its sights on a different kind of fortune.' },
];

export interface Progress { anime: number; manga: number; favorite: boolean; notes: string }
export interface Release { episodes: number; chapters: number; adapted: number }
export interface Schedule { enabled: boolean; cadence: 'weekly' | 'monthly'; day: number; nextRelease: string }
export type ScheduleKey = 'sbr' | 'jojolands';
export interface State {
  version: 1;
  progress: Record<number, Progress>;
  releases: Record<number, Release>;
  schedules: Record<ScheduleKey, Schedule>;
}
export type Medium = 'both' | 'anime' | 'manga';
export const STORAGE_KEY = 'jojo-journey-v1';
export const EMPTY_PROGRESS: Progress = { anime: 0, manga: 0, favorite: false, notes: '' };
export const freshState = (): State => ({ version: 1, progress: {}, releases: {}, schedules: {
  sbr: { enabled: true, cadence: 'weekly', day: 5, nextRelease: '2026-10-23' },
  jojolands: { enabled: true, cadence: 'monthly', day: 19, nextRelease: '2026-11-19' },
} });
export const progressFor = (state: State, id: number): Progress => state.progress[id] ?? { ...EMPTY_PROGRESS };
export const releaseFor = (state: State, part: Part): Release => state.releases[part.id] ?? { episodes: part.episodes, chapters: part.chapters, adapted: part.adapted };
export const clamp = (n: number, total: number) => Math.min(Math.max(0, Math.trunc(Number.isFinite(n) ? n : 0)), total);
export const percent = (current: number, total: number) => total > 0 ? Math.round(current / total * 100) : 0;

// Calendar-only arithmetic avoids daylight-saving shifts. Releases become due at
// midnight in the user's local calendar; no background service is required.
export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && isoDate(d) === value && value >= '2020-01-01' && value <= '2100-12-31';
}
export function nextScheduledDate(after: string, cadence: Schedule['cadence'], day: number): string {
  const d = new Date(`${after}T12:00:00Z`);
  if (cadence === 'weekly') {
    d.setUTCDate(d.getUTCDate() + ((day - d.getUTCDay() + 7) % 7 || 7));
    return isoDate(d);
  }
  let year = d.getUTCFullYear(), month = d.getUTCMonth();
  const candidate = () => new Date(Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), 12));
  if (isoDate(candidate()) <= after) { month++; if (month === 12) { year++; month = 0; } }
  return isoDate(candidate());
}

export function syncSchedules(state: State, today = todayKey()): { state: State; added: number } {
  let next = state, added = 0;
  for (const key of ['sbr', 'jojolands'] as const) {
    const schedule = state.schedules[key];
    if (!schedule.enabled || schedule.nextRelease > today) continue;
    const part = PARTS[key === 'sbr' ? 6 : 8];
    const field = key === 'sbr' ? 'episodes' : 'chapters';
    const release = releaseFor(next, part);
    let date = schedule.nextRelease, count = 0;
    while (date <= today) { count++; date = nextScheduledDate(date, schedule.cadence, schedule.day); }
    const actual = Math.min(count, 10000 - release[field]);
    next = { ...next, releases: { ...next.releases, [part.id]: { ...release, [field]: release[field] + actual } }, schedules: { ...next.schedules, [key]: { ...schedule, nextRelease: date } } };
    added += actual;
  }
  return { state: next, added };
}

export function completion(state: State, part: Part, medium: Medium = 'both'): number {
  const p = progressFor(state, part.id), r = releaseFor(state, part);
  const ratios: number[] = [];
  if (medium !== 'manga' && r.episodes) ratios.push(p.anime / r.episodes);
  if (medium !== 'anime' && r.chapters) ratios.push(p.manga / r.chapters);
  return ratios.length ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length * 100) : 0;
}
export function statusFor(state: State, part: Part, medium: Medium = 'both') {
  const p = progressFor(state, part.id), r = releaseFor(state, part);
  const values: [number, number][] = [];
  if (medium !== 'manga' && r.episodes) values.push([p.anime, r.episodes]);
  if (medium !== 'anime' && r.chapters) values.push([p.manga, r.chapters]);
  if (!values.length) return 'uncataloged';
  if (values.every(([done, total]) => done === total)) return 'complete';
  if (values.some(([done]) => done > 0)) return 'active';
  return 'new';
}

export function updateProgress(state: State, part: Part, medium: 'anime' | 'manga', count: number): State {
  const total = releaseFor(state, part)[medium === 'anime' ? 'episodes' : 'chapters'];
  return { ...state, progress: { ...state.progress, [part.id]: { ...progressFor(state, part.id), [medium]: clamp(count, total) } } };
}

export function validateImport(value: unknown): State {
  if (!value || typeof value !== 'object') throw new Error('Choose a JoJo Journey JSON backup.');
  const s = value as Partial<State>;
  if (s.version !== 1 || !s.progress || !s.releases || typeof s.progress !== 'object' || typeof s.releases !== 'object' || Array.isArray(s.progress) || Array.isArray(s.releases)) throw new Error('This backup format is not supported.');
  const next = freshState();
  const validNumber = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10000;
  if (s.schedules) {
    for (const key of ['sbr', 'jojolands'] as const) {
      const schedule = s.schedules[key];
      const cadence = key === 'sbr' ? 'weekly' : 'monthly';
      if (!schedule || typeof schedule.enabled !== 'boolean' || schedule.cadence !== cadence || !Number.isInteger(schedule.day) || (key === 'sbr' ? schedule.day !== 5 : schedule.day < 1 || schedule.day > 31) || !validDate(schedule.nextRelease)) throw new Error('This backup contains an invalid release schedule.');
      if (key === 'sbr' && new Date(`${schedule.nextRelease}T12:00:00Z`).getUTCDay() !== 5) throw new Error('Steel Ball Run releases must be scheduled on a Friday.');
      next.schedules[key] = { enabled: schedule.enabled, cadence, day: schedule.day, nextRelease: schedule.nextRelease };
    }
  } else {
    // Legacy backups have no scheduling baseline: never invent catch-up releases.
    next.schedules.sbr.enabled = false;
    next.schedules.jojolands.enabled = false;
  }
  for (const part of PARTS) {
    const r = s.releases[part.id];
    if (r !== undefined) {
      if (!r || typeof r !== 'object' || Array.isArray(r) || ![r.episodes, r.chapters, r.adapted].every(validNumber) || r.adapted > r.chapters || (r.episodes === 0 && r.adapted > 0)) throw new Error(`Invalid release counts for ${part.title}.`);
      next.releases[part.id] = { episodes: r.episodes, chapters: r.chapters, adapted: r.adapted };
    }
    const p = s.progress[part.id];
    if (p !== undefined) {
      if (!p || typeof p !== 'object' || Array.isArray(p) || !validNumber(p.anime) || !validNumber(p.manga) || typeof p.favorite !== 'boolean' || typeof p.notes !== 'string' || p.notes.length > 2000) throw new Error(`Invalid progress for ${part.title}.`);
      const totals = releaseFor(next, part);
      if (p.anime > totals.episodes || p.manga > totals.chapters) throw new Error(`Progress exceeds the catalog for ${part.title}.`);
      next.progress[part.id] = { anime: p.anime, manga: p.manga, favorite: p.favorite, notes: p.notes };
    }
  }
  return next;
}
