import type { Part } from './model';

export function Emblem({ motif, className = '' }: { motif: string; className?: string }) {
  return <svg viewBox="0 0 160 160" fill="none" className={className} aria-hidden="true">
    <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      {motif === 'mask' && <><path d="M44 29q36-22 72 0l7 48-17 43-26 21-26-21-17-43Z" fill="currentColor" fillOpacity=".1"/><path d="m43 64 27 7-12 14-13-3m72-18-27 7 12 14 13-3M80 61l-9 39h18m-28 15 19-5 19 5m-32 7h26M58 30l6 20m38-20-6 20M80 18v23"/><path d="m48 99 11 6m53-6-11 6M61 125l4 9m34-9-4 9"/></>}
      {motif === 'sun' && <><circle cx="80" cy="80" r="30" fill="currentColor" fillOpacity=".1"/><circle cx="80" cy="80" r="19"/><path d="M80 9v25m0 92v25M9 80h25m92 0h25M30 30l18 18m65 65 18 18M30 130l18-18m65-65 18-18M53 15l9 22m36 86 9 22M15 53l22 9m86 36 22 9M15 107l22-9m86-36 22-9M53 145l9-22m36-86 9-22"/><path d="m19 108 119-51-43 35-13 36-9-32-39 4Z" fill="currentColor" strokeWidth="2"/></>}
      {motif === 'star' && <><circle cx="80" cy="80" r="59"/><circle cx="80" cy="80" r="50" strokeDasharray="2 8"/><path d="m80 22 15 38 42 3-33 27 11 42-35-24-35 24 11-42-33-27 42-3Z" fill="currentColor" fillOpacity=".18"/><path d="m80 22 0 62 35 48M23 63l57 21 57-21M45 132l35-48"/><circle cx="80" cy="84" r="6" fill="currentColor"/></>}
      {motif === 'diamond' && <><path d="m19 62 28-32h66l28 32-61 78Z" fill="currentColor" fillOpacity=".14"/><path d="M19 62h122M47 30l-7 32 40 78 40-78-7-32M40 62l40-32 40 32M80 30v110M18 25v17m-9-9h18m112 80v17m-9-9h18"/></>}
      {motif === 'beetle' && <><path d="M59 51q-12-39 21-32 33-7 21 32M80 20v20"/><ellipse cx="80" cy="85" rx="39" ry="48" fill="currentColor" fillOpacity=".12"/><path d="M80 38v94M43 68l-21-9-8-18m26 45-22 5-9 17m36-1-17 16 1 20m88-75 21-9 8-18m-26 45 22 5 9 17m-36-1 17 16-1 20"/><circle cx="60" cy="68" r="9" fill="currentColor"/><circle cx="99" cy="68" r="9" fill="currentColor"/><circle cx="60" cy="100" r="7" fill="currentColor"/><circle cx="99" cy="100" r="7" fill="currentColor"/></>}
      {motif === 'butterfly' && <><path d="M76 72C35-10 0 19 22 67l26 27c-52 52 3 68 30 14m6-36c41-82 76-53 54-5l-26 27c52 52-3 68-30 14" fill="currentColor" fillOpacity=".12"/><path d="M75 57q5-10 10 0l-2 64h-6ZM76 58 63 36m21 22 13-22M24 43l51 44-37-16m99-28L85 87l37-16M48 120l28-21m36 21-28-21"/><circle cx="42" cy="51" r="7"/><circle cx="118" cy="51" r="7"/></>}
      {motif === 'horseshoe' && <><path d="M43 20h20v52q-2 39 17 39t17-39V20h20l13 50c7 48-15 72-50 72S23 118 30 70Z" fill="currentColor" fillOpacity=".12"/><path d="M41 49h14m-17 24h14m-13 23 13-3m-3 26 12-7m44-63h14m-11 24h14m-14 20 13 3m-22 16 12 7"/><path d="m80 17 7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2Z" fill="currentColor"/></>}
      {motif === 'anchor' && <><circle cx="80" cy="31" r="15"/><path d="M80 46v94M49 64h62M26 85c0 35 22 51 54 55 32-4 54-20 54-55M26 85l-13 18m13-18 19 13m89-13 13 18m-13-18-19 13"/><path d="M42 139c-12-6-23-16-30-31m106 31c12-6 23-16 30-31"/><circle cx="80" cy="31" r="5" fill="currentColor"/></>}
      {motif === 'palm' && <><path d="M65 144q30-33 16-89M76 145q25-36 12-90"/><path d="M83 54Q42-6 13 41q46-9 70 13ZM83 54Q68-2 112 13 91 23 83 54ZM83 54q46-63 65-4-34-15-65 4ZM83 54q58-19 58 38-34-29-58-38ZM83 54Q20 22 18 88q35-34 65-34Z" fill="currentColor" fillOpacity=".15"/><path d="m36 144 12-5 14 5 15-6 15 6 15-5 17 5M120 112h24m-12-12v24"/></>}
    </g>
  </svg>;
}

export function PartArtwork({ part, className = '' }: { part: Part; className?: string }) {
  return <div className={`part-art ${className}`} style={{ background: part.color, color: part.ink }}>
    <div className="art-grid" /><span className="art-ghost">{String(part.id).padStart(2, '0')}</span>
    <span className="art-label">JOESTAR<br />ARCHIVES</span><span className="art-spark">✦</span>
    <Emblem motif={part.motif} className="part-emblem" />
    <span className="art-location">{part.setting}</span><span className="art-year">{part.era}</span>
  </div>;
}

export function HeroArtwork() {
  return <div className="hero-art" aria-hidden="true">
    <span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" />
    <span className="hero-kana kana-one">ゴ</span><span className="hero-kana kana-two">ゴ</span>
    <div className="hero-poster poster-back"><span>THE JOESTAR LEGACY</span><Emblem motif="diamond" /><b>TO BE<br />CONTINUED</b></div>
    <div className="hero-poster poster-front"><span>AN ADVENTURE LIKE NO OTHER</span><Emblem motif="star" /><div className="poster-bottom"><b>JOJO</b><span>09 PARTS<br />ONE JOURNEY</span></div></div>
    <span className="hero-sticker">YOUR NEXT<br /><b>GREAT<br />ADVENTURE.</b><small>STARTS HERE ↗</small></span>
    <span className="hero-spark">✦</span><span className="hero-spark small">✧</span>
  </div>;
}
