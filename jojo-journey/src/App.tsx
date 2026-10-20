import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { CalendarDays, ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Compass, Download, Film, Flag, Heart, LayoutDashboard, Library, MapPin, Menu, Minus, Play, Plus, Search, Settings2, Sparkles, Star, Upload, X } from 'lucide-react';
import { PARTS, STORAGE_KEY, clamp, completion, freshState, percent, progressFor, releaseFor, statusFor, updateProgress, validateImport, syncSchedules, type Medium, type Part, type Progress, type State } from './model';
import { HeroArtwork, PartArtwork } from './Artwork';
import { ReleaseCards, ScheduleForm } from './ReleaseSchedule';

type View = 'overview' | 'library' | 'timeline' | 'adaptation' | 'favorites';
type Filter = 'all' | 'active' | 'complete' | 'new';
type Sort = 'publication' | 'most' | 'least';
type Toast = { message: string; previous?: State } | null;
const LABELS: Record<View, string> = { overview: 'Overview', library: 'My library', timeline: 'Story timeline', adaptation: 'Adaptation', favorites: 'Favorites' };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { state: raw ? validateImport(JSON.parse(raw)) : freshState(), error: '' };
  } catch {
    return { state: freshState(), error: 'Saved progress could not be loaded. Your original save is preserved. Export any new progress to keep it, or import a valid backup to restore saving.' };
  }
}

function trapFocus(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>, container: HTMLElement | null) {
  if (event.key !== 'Tab' || !container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
  const first = focusable[0], last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function Modal({ children, onClose, title, wide = false }: { children: ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (opener.current?.isConnected && !opener.current.closest('[inert]')) opener.current.focus();
      else document.querySelector<HTMLButtonElement>('.mobile-menu')?.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-label={title} onKeyDown={e => trapFocus(e, ref.current)} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-inner"><button autoFocus className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>{children}</div></dialog>;
}

function ProgressBar({ value, variant = '', label }: { value: number; variant?: string; label: string }) {
  return <div className={`progress-bar ${variant}`} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%` }} /></div>;
}

function PartEditor({ part, state, onSave, onClose, onCatalog }: { part: Part; state: State; onSave: (p: Progress) => void; onClose: () => void; onCatalog: () => void }) {
  const [draft, setDraft] = useState({ ...progressFor(state, part.id) });
  const r = releaseFor(state, part);
  return <Modal onClose={onClose} title={`Track ${part.title}`}>
    <PartArtwork part={part} className="modal-art" />
    <div className="modal-body"><span className="eyebrow purple">PART {String(part.id).padStart(2, '0')} · {part.years}</span><h2>{part.title}</h2><p className="muted">{part.description}</p>
      <form onSubmit={e => { e.preventDefault(); onSave({ ...draft, anime: clamp(draft.anime, r.episodes), manga: clamp(draft.manga, r.chapters) }); }}>
        {(['anime', 'manga'] as const).map(m => {
          const total = m === 'anime' ? r.episodes : r.chapters;
          return <div className="editor-progress" key={m}><div className="editor-label">{m === 'anime' ? <Film size={18} /> : <BookOpen size={18} />}<b>{m === 'anime' ? 'Anime' : 'Manga'}</b><span>{total ? `${total} ${m === 'anime' ? 'episodes' : 'chapters'}` : 'Release count not set'}</span></div>
            {total > 0 ? <><div className="stepper"><button type="button" aria-label={`Decrease ${m} progress`} disabled={draft[m] === 0} onClick={() => setDraft({ ...draft, [m]: Math.max(0, draft[m] - 1) })}><Minus size={18} /></button><input aria-label={`${m === 'anime' ? 'Episodes watched' : 'Chapters read'}`} type="number" min="0" max={total} value={draft[m]} onChange={e => setDraft({ ...draft, [m]: e.target.value === '' ? 0 : Number(e.target.value) })} /><span>/ {total}</span><button type="button" aria-label={`Increase ${m} progress`} disabled={draft[m] >= total} onClick={() => setDraft({ ...draft, [m]: Math.min(total, draft[m] + 1) })}><Plus size={18} /></button></div><button type="button" className="text-button complete-link" onClick={() => setDraft({ ...draft, [m]: total })}><CheckCheck size={14} />{part.id === 9 || (part.id === 7 && m === 'anime') ? 'Mark caught up' : 'Mark complete'}</button></> : <button type="button" className="text-button" onClick={onCatalog}>Set release count <ArrowUpRight size={14} /></button>}
          </div>;
        })}
        <label className="notes-label" htmlFor="part-notes">Your notes <span>Optional · spoiler-safe, just for you</span></label><textarea id="part-notes" value={draft.notes} maxLength={2000} placeholder="A favorite moment, a theory, or where you left off…" onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={3} />
        <div className="modal-actions"><button className={`favorite-button ${draft.favorite ? 'saved' : ''}`} type="button" onClick={() => setDraft({ ...draft, favorite: !draft.favorite })}><Heart size={18} fill={draft.favorite ? 'currentColor' : 'none'} />{draft.favorite ? 'Favorited' : 'Favorite'}</button><button type="submit" className="primary-button">Save progress <Check size={17} /></button></div>
      </form>
    </div>
  </Modal>;
}

function CatalogEditor({ state, onSave, onClose }: { state: State; onSave: (next: State) => void; onClose: () => void }) {
  const [releases, setReleases] = useState(Object.fromEntries(PARTS.map(p => [p.id, { ...releaseFor(state, p) }])));
  const [error, setError] = useState('');
  return <Modal onClose={onClose} title="Release catalog" wide><div className="modal-body catalog-modal"><span className="eyebrow purple">KEEP YOUR JOURNEY CURRENT</span><h2>Release catalog</h2><p className="muted">Update released episodes, manga chapters, and chapters covered by the anime. These totals describe the franchise, not your personal progress.</p><div className="info-box"><CircleHelp size={19} /><p>The baseline includes the complete Parts 1–6 TV anime and Parts 1–8 manga, plus your counts of 6 Steel Ball Run episodes and 41 JOJOLands chapters. Scheduled releases update those two totals. A zero means <b>not cataloged</b>, not “unreleased.” No live publisher feed is connected. Set the Steel Ball Run adapted chapter count separately.</p></div>
    <form onSubmit={e => {
      e.preventDefault();
      for (const p of PARTS) {
        const r = releases[p.id];
        if (r.adapted > r.chapters || (r.episodes === 0 && r.adapted > 0)) { setError(`${p.title}: adapted chapters must fit within the manga total and require released anime episodes.`); return; }
      }
      const next: State = { ...state, releases, progress: { ...state.progress } };
      for (const p of PARTS) { const old = progressFor(state, p.id); next.progress[p.id] = { ...old, anime: clamp(old.anime, releases[p.id].episodes), manga: clamp(old.manga, releases[p.id].chapters) }; }
      onSave(next);
    }}>
      <div className="catalog-table"><div className="catalog-table-head"><span>Part</span><span>Episodes</span><span>Chapters</span><span>Adapted ch.</span></div>{PARTS.map(p => <div className="catalog-row" key={p.id}><label><span>{String(p.id).padStart(2, '0')}</span>{p.title}</label>{(['episodes', 'chapters', 'adapted'] as const).map(field => <input key={field} aria-label={`${p.title} ${field}`} type="number" min="0" max="10000" required value={releases[p.id][field]} onChange={e => setReleases({ ...releases, [p.id]: { ...releases[p.id], [field]: e.target.value === '' ? 0 : Number(e.target.value) } })} />)}</div>)}</div>
      <p className="small muted">Lowering a release total also lowers any personal progress above that total. You can undo a catalog update immediately after saving.</p>{error && <p className="form-error" role="alert">{error}</p>}
      <div className="source-links"><a href="https://jojo-portal.com/" target="_blank" rel="noreferrer">Official anime news <ArrowUpRight size={13} /></a><a href="https://jojowiki.com/JoJo%27s_Bizarre_Adventure" target="_blank" rel="noreferrer">Franchise reference <ArrowUpRight size={13} /></a></div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Update catalog <Check size={16} /></button></div>
    </form>
  </div></Modal>;
}

export default function App() {
  const [initial] = useState(load);
  const [state, setState] = useState<State>(initial.state);
  const [storageError, setStorageError] = useState(initial.error);
  const [saveBlocked, setSaveBlocked] = useState(!!initial.error);
  const [view, setView] = useState<View>('overview');
  const [medium, setMedium] = useState<Medium>('both');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('publication');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Part | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [toast, setToast] = useState<Toast>(null);
  const [pendingImport, setPendingImport] = useState<State | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const changed = () => { setIsMobile(media.matches); if (!media.matches) setMobileNav(false); };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!isMobile || !mobileNav) return;
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setMobileNav(false); }
      else trapFocus(e, sidebarRef.current);
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; menuRef.current?.focus(); };
  }, [isMobile, mobileNav]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !document.querySelector('dialog[open]') && !document.querySelector('.sidebar.is-open')) { e.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 7000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const catchUp = () => {
      if (document.visibilityState === 'hidden') return;
      const result = syncSchedules(state);
      if (result.state === state) return;
      setState(result.state);
      if (!saveBlocked) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result.state)); }
        catch { setStorageError('Automatic release counts updated for this session. Export a backup to keep them.'); }
      }
      if (result.added) setToast({ message: `${result.added} scheduled release${result.added === 1 ? '' : 's'} added to your catalog. Your personal progress is unchanged.` });
    };
    catchUp();
    const timer = window.setInterval(catchUp, 60000);
    window.addEventListener('focus', catchUp);
    document.addEventListener('visibilitychange', catchUp);
    return () => { clearInterval(timer); window.removeEventListener('focus', catchUp); document.removeEventListener('visibilitychange', catchUp); };
  }, [state, saveBlocked]);
  function persist(next: State, message: string, allowRecovery = false) {
    const previous = state;
    next = syncSchedules(next).state;
    setState(next);
    if (!saveBlocked || allowRecovery) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageError(''); setSaveBlocked(false); }
      catch { setStorageError('This browser could not save your progress. Export a backup before closing this tab.'); }
    }
    setToast({ message, previous });
  }
  function navigate(next: View) { setView(next); setQuery(''); setFilter('all'); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `jojo-journey-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setToast({ message: 'Your journey backup has been downloaded.' });
  }
  const totals = PARTS.reduce((acc, p) => { const r = releaseFor(state, p), s = progressFor(state, p.id); return { episodes: acc.episodes + r.episodes, watched: acc.watched + s.anime, chapters: acc.chapters + r.chapters, read: acc.read + s.manga, adapted: acc.adapted + r.adapted }; }, { episodes: 0, watched: 0, chapters: 0, read: 0, adapted: 0 });
  const coverageIncomplete = PARTS.some(p => { const r = releaseFor(state, p); return r.episodes > 0 && r.adapted === 0; });
  const coveragePrefix = coverageIncomplete ? '≥' : '';
  const coveragePercent = totals.chapters ? Math.floor(totals.adapted / totals.chapters * 100) : 0;
  const completedParts = PARTS.filter(p => statusFor(state, p, medium) === 'complete').length;
  const eligibleParts = PARTS.filter(p => statusFor(state, p, medium) !== 'uncataloged');
  const journey = eligibleParts.length ? Math.round(eligibleParts.reduce((a, p) => a + completion(state, p, medium), 0) / eligibleParts.length) : 0;
  const visibleParts = PARTS.filter(p => (view !== 'favorites' || progressFor(state, p.id).favorite) && (filter === 'all' || statusFor(state, p, medium) === filter) && `${p.title} ${p.protagonist} ${p.id} ${p.setting}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'publication' ? a.id - b.id : (completion(state, a, medium) - completion(state, b, medium)) * (sort === 'most' ? -1 : 1) || a.id - b.id);
  const nextPart = PARTS.find(p => statusFor(state, p, medium) === 'active') ?? PARTS.find(p => statusFor(state, p, medium) === 'new');
  const favoriteCount = PARTS.filter(p => progressFor(state, p.id).favorite).length;
  const anyProgress = totals.watched + totals.read > 0;

  function partCard(p: Part) {
    const progress = progressFor(state, p.id), r = releaseFor(state, p), status = statusFor(state, p, medium);
    const quickMedium = medium === 'both' ? (!r.episodes || progress.anime === r.episodes ? 'manga' : 'anime') : medium;
    const quickTotal = quickMedium === 'anime' ? r.episodes : r.chapters;
    return <article className="part-card" key={p.id}>
      <button className="art-open" onClick={() => setSelected(p)} aria-label={`Open ${p.title}`}><PartArtwork part={p} /><span className="art-open-label">Explore part <ArrowUpRight size={16} /></span></button>
      <div className="card-body"><div className="card-topline"><span className="eyebrow">PART {String(p.id).padStart(2, '0')}</span><span className={`status status-${status}`}>{status === 'complete' ? <Check size={11} /> : <span />}{status === 'complete' ? (p.id === 9 || (p.id === 7 && medium !== 'manga') ? 'Caught up' : 'Completed') : status === 'active' ? 'In progress' : status === 'uncataloged' ? 'Set release count' : 'Not started'}</span></div>
        <h3><button onClick={() => setSelected(p)}>{p.title}</button></h3><p className="protagonist">{p.protagonist}<span>·</span>{p.years}</p>
        <div className="card-progress">{medium !== 'manga' && <div><div className="progress-label"><span><Film size={13} /> Anime</span><b>{r.episodes ? <>{progress.anime}<span> / {r.episodes} ep</span></> : <span>Not cataloged</span>}</b></div><ProgressBar value={percent(progress.anime, r.episodes)} label={`${p.title} anime progress`} /></div>}{medium !== 'anime' && <div><div className="progress-label"><span><BookOpen size={13} /> Manga</span><b>{r.chapters ? <>{progress.manga}<span> / {r.chapters} ch</span></> : <span>Ongoing · set total</span>}</b></div><ProgressBar value={percent(progress.manga, r.chapters)} variant="manga" label={`${p.title} manga progress`} /></div>}</div>
        <div className="card-actions"><button className="quick-add" onClick={() => { if (quickTotal && progress[quickMedium] < quickTotal) persist(updateProgress(state, p, quickMedium, progress[quickMedium] + 1), `${p.title}: ${quickMedium === 'anime' ? 'episode' : 'chapter'} logged.`); else setSelected(p); }}>{quickTotal && progress[quickMedium] < quickTotal ? <><Plus size={15} />{quickMedium === 'anime' ? 'Log episode' : 'Log chapter'}</> : <><Settings2 size={14} />Edit progress</>}</button><button className={`card-heart ${progress.favorite ? 'is-favorite' : ''}`} aria-label={`${progress.favorite ? 'Unfavorite' : 'Favorite'} ${p.title}`} aria-pressed={progress.favorite} onClick={() => persist({ ...state, progress: { ...state.progress, [p.id]: { ...progress, favorite: !progress.favorite } } }, progress.favorite ? 'Removed from favorites.' : 'Added to your favorites.')}><Heart size={17} fill={progress.favorite ? 'currentColor' : 'none'} /></button><button className="card-details" aria-label={`Edit ${p.title} progress`} onClick={() => setSelected(p)}><ArrowUpRight size={18} /></button></div>
      </div>
    </article>;
  }

  return <div className="app-shell">
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside ref={sidebarRef} id="main-sidebar" className={`sidebar ${mobileNav ? 'is-open' : ''}`} inert={isMobile && !mobileNav} role={isMobile && mobileNav ? 'dialog' : undefined} aria-modal={isMobile && mobileNav ? true : undefined} aria-label={isMobile && mobileNav ? 'Navigation' : undefined}>
      <button className="brand" onClick={() => navigate('overview')} aria-label="JoJo Journey home"><span className="brand-symbol">✦</span><span>JOJO<span className="brand-sub">JOURNEY</span></span></button>
      <div className="workspace-label">YOUR PERSONAL ADVENTURE</div>
      <nav aria-label="Main navigation">{([{ id: 'overview', icon: LayoutDashboard }, { id: 'library', icon: Library }, { id: 'timeline', icon: Compass }, { id: 'adaptation', icon: Film }] as const).map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.icon size={19} /><span>{LABELS[item.id]}</span>{view === item.id && <span className="nav-active-dot" />}</button>)}<div className="nav-divider" /><button className={`nav-item ${view === 'favorites' ? 'active' : ''}`} onClick={() => navigate('favorites')}><Heart size={19} /><span>Favorites</span><span className="nav-count">{favoriteCount}</span></button></nav>
      <div className="sidebar-journey"><span className="tiny-label">THE JOESTAR SPIRIT</span><span className="journey-star">✧</span><p>It's a long journey.<br /><b>Make it your own.</b></p><div className="journey-percent"><span>Your journey</span><b>{journey}%</b></div><ProgressBar value={journey} label="Overall personal journey" /><span className="journey-caption">{medium === 'both' ? 'Anime + manga' : medium === 'anime' ? 'Anime journey' : 'Manga journey'}</span></div>
      <div className="sidebar-bottom"><button onClick={() => { setScheduleOpen(true); setMobileNav(false); }}><CalendarDays size={17} />Release schedule</button><button onClick={() => { setCatalogOpen(true); setMobileNav(false); }}><Settings2 size={17} />Release catalog</button><button onClick={() => { setHelpOpen(true); setMobileNav(false); }}><CircleHelp size={17} />How it works</button><div className="local-profile"><span className="avatar">J<span>✦</span></span><div><b>Your bizarre adventure</b><span><i />{storageError ? 'Session only' : 'Saved on this device'}</span></div></div></div>
    </aside>
    <div className="main-shell" inert={isMobile && mobileNav}>
      <header className="topbar"><div className="breadcrumb"><button ref={menuRef} className="mobile-menu icon-button" aria-expanded={mobileNav} aria-controls="main-sidebar" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button><span>My space</span><ChevronRight size={13} /><b>{LABELS[view]}</b></div><div className="topbar-actions"><div className="search"><Search size={16} /><input ref={searchRef} aria-label="Search parts" placeholder="Find your next adventure…" value={query} onChange={e => { setQuery(e.target.value); if (view === 'adaptation') setView('library'); }} /><kbd>⌘ K</kbd>{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={13} /></button>}</div><button className="icon-button export-button" aria-label="Export progress backup" title="Export progress backup" onClick={exportBackup}><Download size={18} /></button><button className="header-avatar" aria-label="About your local profile" onClick={() => { setHelpOpen(true); setMobileNav(false); }}>J</button></div></header>
      <main>
        {storageError && <div role="alert" className="storage-alert">{storageError}<button onClick={exportBackup}>Export backup</button></div>}
        <div className="page-heading"><div><span className="eyebrow">THE STORY IS LEGENDARY. THE JOURNEY IS YOURS.</span><h1>{view === 'overview' ? 'Your bizarre adventure' : view === 'library' ? 'A collection of adventures' : view === 'timeline' ? 'Through the generations' : view === 'favorites' ? 'The parts you love' : 'From page to screen'}<span className="heading-dot">.</span></h1></div><button className="secondary-button compact" aria-label="Import progress" onClick={() => { importRef.current?.click(); }}><Upload size={15} /><span>Import progress</span></button></div>
        {view === 'overview' && <section className="hero"><div className="hero-copy"><span className="hero-tag"><span />9 PARTS. ONE BIZARRE LEGACY.</span><h2>Every generation.<br />Your adventure.</h2><p>From the first ripple to the latest chapter.<br />Track the story. Find your next obsession.</p><button className="lime-button" onClick={() => nextPart ? setSelected(nextPart) : navigate('library')}>{anyProgress ? 'Continue your journey' : 'Start your journey'}<ArrowRight size={18} /></button><div className="hero-footnote"><BookOpen size={13} /><span>Manga reader, anime watcher, or a little of both.</span></div></div><HeroArtwork /></section>}
        {view !== 'favorites' && <section className="stats-grid" aria-label="Your progress at a glance"><div className="stat-card"><span className="stat-icon purple-icon"><Flag size={18} /></span><div><span className="stat-label">Parts completed</span><div className="stat-value">{completedParts}<span>/ {eligibleParts.length}</span><span className="stat-detail">{medium === 'both' ? 'anime + manga' : medium}</span></div><ProgressBar value={percent(completedParts, eligibleParts.length)} label="Parts completed" /></div></div><div className="stat-card"><span className="stat-icon blue-icon"><Film size={18} /></span><div><span className="stat-label">Episodes watched</span><div className="stat-value">{totals.watched}<span>/ {totals.episodes}</span><span className="stat-detail">{percent(totals.watched, totals.episodes)}%</span></div><ProgressBar value={percent(totals.watched, totals.episodes)} variant="blue" label="Total episodes watched" /></div></div><div className="stat-card"><span className="stat-icon pink-icon"><BookOpen size={18} /></span><div><span className="stat-label">Chapters read</span><div className="stat-value">{totals.read}<span>/ {totals.chapters.toLocaleString()}</span><span className="stat-detail">{percent(totals.read, totals.chapters)}%</span></div><ProgressBar value={percent(totals.read, totals.chapters)} variant="manga" label="Total chapters read" /></div></div><button className="stat-card adaptation-stat" onClick={() => navigate('adaptation')}><span className="stat-icon green-icon"><Sparkles size={18} /></span><div><span className="stat-label">Known adaptation <ArrowUpRight size={13} /></span><div className="stat-value">{coveragePrefix}{coveragePercent}<span>%</span><span className="stat-detail">of cataloged chapters</span></div><ProgressBar value={percent(totals.adapted, totals.chapters)} variant="green" label="Manga adaptation coverage" /></div></button></section>}

        {view === 'overview' && <ReleaseCards state={state} onEdit={() => setScheduleOpen(true)} />}
        {(view === 'overview' || view === 'timeline') && <section className="timeline-panel"><div className="section-heading"><div><span className="eyebrow">THE JOESTAR CHRONICLE</span><h2>{view === 'timeline' ? 'A legacy across two continuities' : 'One legacy. Nine chapters.'}</h2></div><span className="timeline-key"><span />Original continuity<i />Alternate continuity</span></div><div className="timeline-track">{PARTS.map(p => { const done = statusFor(state, p, medium) === 'complete', active = statusFor(state, p, medium) === 'active'; return <button key={p.id} className={`timeline-stop ${done ? 'done' : ''} ${active ? 'started' : ''} ${p.id > 6 ? 'alternate' : ''}`} onClick={() => setSelected(p)} aria-label={`Part ${p.id}: ${p.title}, ${p.era}`}><span className="timeline-era">{p.era}</span><span className="timeline-node">{done ? <Check size={16} /> : String(p.id).padStart(2, '0')}</span><b>{p.title}</b><span className="timeline-publication">{p.years}</span></button>; })}</div><div className="timeline-caption"><span><Compass size={13} /> Story years above · publication years below</span><span>Follow the parts in publication order <ArrowRight size={13} /></span></div></section>}

        {view === 'adaptation' ? <section className="adaptation-view"><div className="adaptation-feature"><div><span className="eyebrow purple">THE BIGGER PICTURE</span><h2>A story that keeps<br />coming to life.</h2><p>Watch the gap between manga and anime close.<br />This is adaptation coverage, independent of what you've watched.</p><button className="secondary-button" onClick={() => { setCatalogOpen(true); setMobileNav(false); }}><Settings2 size={16} />Update release catalog</button></div><div className="coverage-ring" style={{ '--coverage': `${percent(totals.adapted, totals.chapters)}%` } as CSSProperties}><div><Sparkles size={23} /><b>{coveragePrefix}{coveragePercent}<span>%</span></b><span>KNOWN COVERAGE</span><small>{totals.adapted} / {totals.chapters} chapters</small></div></div></div><div className="section-heading"><h2>Every part, side by side</h2><div className="legend"><span className="purple-dot" />Adapted<span className="gray-dot" />Remaining</div></div><div className="adaptation-list">{PARTS.map(p => { const r = releaseFor(state, p), coverage = r.chapters ? Math.floor(r.adapted / r.chapters * 100) : 0; return <div className="adaptation-row" key={p.id}><button className="adaptation-part" onClick={() => setSelected(p)}><span style={{ background: p.color, color: p.ink }}>{String(p.id).padStart(2, '0')}</span><div><b>{p.title}</b><small>{r.episodes ? `${r.episodes} anime episodes · ${r.chapters} manga chapters` : `${r.chapters || 'Ongoing'} manga chapters · anime not cataloged`}</small></div></button><div className="coverage-bar"><ProgressBar value={coverage} label={`${p.title} adaptation coverage`} /><span>{r.chapters ? `${r.adapted} / ${r.chapters} ch.` : 'Set chapter count'}</span></div><span className={`coverage-status ${coverage === 100 ? 'covered' : ''}`}>{coverage === 100 ? <><Check size={13} />Fully adapted</> : r.adapted > 0 ? `${coverage}% adapted` : r.episodes ? 'Coverage not set' : 'Not cataloged'}</span></div>; })}</div><div className="catalog-note"><CircleHelp size={18} /><p><b>A snapshot, not a live release feed.</b> Coverage reflects the adapted manga chapters in your release catalog. {coverageIncomplete ? 'Some anime chapter coverage is unset, so the overall percentage is a lower bound. ' : ''}Scheduled episodes and chapters follow your release settings; adapted chapter counts are entered separately. Coverage compares chapters, not runtime or scene-by-scene fidelity.</p><button className="text-button" onClick={() => { setCatalogOpen(true); setMobileNav(false); }}>Edit catalog <ArrowUpRight size={14} /></button></div></section> : <section className="library-section"><div className="section-heading library-heading"><div><span className="eyebrow">{view === 'favorites' ? 'CLOSE TO YOUR HEART' : 'EVERY PART IS A NEW BEGINNING'}</span><h2>{view === 'favorites' ? 'Your favorites' : 'Explore the parts'}<span className="count-badge">{visibleParts.length}</span></h2></div><div className="medium-toggle" aria-label="Tracking format">{(['both', 'anime', 'manga'] as const).map(m => <button key={m} className={medium === m ? 'selected' : ''} onClick={() => setMedium(m)} aria-pressed={medium === m}>{m === 'both' ? 'All formats' : m === 'anime' ? <><Film size={14} />Anime</> : <><BookOpen size={14} />Manga</>}</button>)}</div></div><div className="filter-bar"><div className="filters" aria-label="Filter parts">{([{ value: 'all', label: 'All parts' }, { value: 'active', label: 'In progress' }, { value: 'complete', label: 'Completed' }, { value: 'new', label: 'Not started' }] as const).map(f => <button key={f.value} className={filter === f.value ? 'selected' : ''} onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}>{f.label}{f.value === 'all' && <span>{view === 'favorites' ? favoriteCount : 9}</span>}</button>)}</div><label className="order-label"><select aria-label="Sort parts" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="publication">Publication order</option><option value="most">Most progress</option><option value="least">Least progress</option></select><ChevronDown size={14} /></label></div>{visibleParts.length ? <div className="parts-grid">{visibleParts.map(partCard)}</div> : <div className="empty-state"><Star size={32} /><h3>{query ? 'No adventure by that name.' : view === 'favorites' ? 'Keep your favorites close.' : 'A new chapter is waiting.'}</h3><p>{query ? 'Try a part title, protagonist, or location.' : view === 'favorites' ? 'Tap the heart on a part to add it to your collection.' : 'Log your progress or try a different filter.'}</p><button className="secondary-button" onClick={() => { if (view === 'favorites') navigate('library'); setQuery(''); setFilter('all'); }}>Explore all parts <ArrowRight size={15} /></button></div>}</section>}

        <footer><span className="footer-brand">✦ <b>JOJO JOURNEY</b><span>Every chapter counts.</span></span><span>Made for the adventure. Unofficial & unaffiliated.</span></footer>
      </main>
    </div>
    <input type="file" ref={importRef} accept="application/json,.json" hidden onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; try { if (file.size > 1000000) throw new Error('Please choose a backup smaller than 1 MB.'); const parsed = validateImport(JSON.parse(await file.text())); setPendingImport(parsed); } catch (error) { setToast({ message: error instanceof SyntaxError ? 'This file is not valid JSON. Choose a JoJo Journey backup.' : error instanceof Error ? error.message : 'Could not import this backup.' }); } }} />
    {selected && <PartEditor key={selected.id} part={selected} state={state} onClose={() => setSelected(null)} onCatalog={() => { setSelected(null); setCatalogOpen(true); }} onSave={p => { persist({ ...state, progress: { ...state.progress, [selected.id]: p } }, `${selected.title}: progress saved.`); setSelected(null); }} />}
    {scheduleOpen && <Modal title="Automatic release schedule" onClose={() => setScheduleOpen(false)}><ScheduleForm state={state} onClose={() => setScheduleOpen(false)} onSave={next => { persist(next, 'Release schedule saved.'); setScheduleOpen(false); }} /></Modal>}
    {catalogOpen && <CatalogEditor state={state} onClose={() => setCatalogOpen(false)} onSave={next => { persist(next, 'Release catalog updated.'); setCatalogOpen(false); }} />}
    {pendingImport && <Modal title="Import your journey" onClose={() => setPendingImport(null)}><div className="modal-body confirmation-modal"><span className="eyebrow purple">PICK UP WHERE YOU LEFT OFF</span><h2>Import your journey?</h2><p className="muted">This will replace progress, favorites, notes, release schedules, and release totals on this device with your backup. Export your current journey first if you want to keep both.</p><div className="modal-actions"><button className="secondary-button" onClick={exportBackup}><ArrowDownToLine size={15} />Export current</button><button className="primary-button" onClick={() => { persist(pendingImport, 'Your journey has been restored.', true); setPendingImport(null); }}>Import backup <Check size={16} /></button></div></div></Modal>}
    {helpOpen && <Modal title="About your journey" onClose={() => setHelpOpen(false)}><div className="modal-body help-modal"><span className="eyebrow purple">A LITTLE GUIDANCE GOES A LONG WAY</span><h2>Your adventure, your pace.</h2><div className="help-item"><Film /><div><h3>Two ways to follow the story</h3><p>Log episodes and chapters separately. Switch between Anime, Manga, or All formats to see your completion for that format. With both selected, a part is complete when every cataloged format is finished.</p></div></div><div className="help-item"><Compass /><div><h3>Nine parts, two continuities</h3><p>Follow publication order for your first journey. Parts 1–6 share the original continuity; Parts 7–9 start an alternate one. The timeline shows both story and publication years.</p></div></div><div className="help-item"><Sparkles /><div><h3>Progress ≠ adaptation</h3><p>Your journey averages each cataloged part's completion, weighting its available formats equally. Adaptation is the share of cataloged manga chapters covered by anime, regardless of your own progress. Ongoing parts show “caught up” at their current total.</p></div></div><div className="help-item"><Download /><div><h3>A local home for your journey</h3><p>Scheduled release counts catch up when you open or return to the app. Pause schedules for hiatuses. Your progress stays in this browser on this device. Export a JSON backup to keep it safe or move it elsewhere. There is no account or automatic cloud sync. This tracker covers the nine main manga parts and modern TV anime, excluding OVAs, films, and spin-offs.</p></div></div><p className="attribution">An unofficial fan project. JoJo's Bizarre Adventure and its characters belong to Hirohiko Araki, Shueisha, and their respective rights holders. All decorative artwork here is original.</p><button className="primary-button" onClick={() => setHelpOpen(false)}>Back to the adventure <ArrowRight size={16} /></button></div></Modal>}
    {toast && <div className="toast" role="status"><span className="toast-check"><Check size={16} /></span><span>{toast.message}</span>{toast.previous && <button onClick={() => { const old = toast.previous!; setState(old); try { if (!saveBlocked) localStorage.setItem(STORAGE_KEY, JSON.stringify(old)); } catch { setStorageError('Could not save the undo. Export your progress before leaving.'); } setToast({ message: 'Last change undone.' }); }}>Undo</button>}<button className="toast-dismiss" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>;
}
