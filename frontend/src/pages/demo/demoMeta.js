/** Shared metadata for landing-page A/B/C demos (friends pick a winner). */
export const DEMO_PAGES = [
  {
    id: 'atelier',
    slug: 'atelier',
    path: '/demos/atelier',
    number: '01',
    title: 'Atelier',
    subtitle: 'Cinematic black & gold',
    blurb:
      'Scroll-choreographed React landing with live Gold 24K / Silver 999 ticker, gold/silver buy (AED↔grams), peer rate compare, fee math, and direct booking.',
    tags: ['React', 'Live ticker', 'Live buy'],
  },
  {
    id: 'atelier-theme',
    slug: 'atelier-theme',
    path: '/demos/atelier-theme',
    number: '01b',
    title: 'Atelier Theme',
    subtitle: 'UI/UX system sheet v3.1',
    blurb:
      'Bilingual (EN/AR) component inventory: live ticker, buttons, badges, vault cards, rate chart, system states, ledger table, flags & icons.',
    tags: ['Design system', 'EN/AR RTL', 'Components'],
  },
  {
    id: 'canvas-scroll',
    slug: 'canvas-scroll',
    path: '/demos/canvas-scroll',
    htmlSrc: '/demos/canvas-scroll.html',
    number: '02',
    title: 'Canvas Scroll',
    subtitle: '3D bar · full-page scroller',
    blurb:
      'Interactive Three.js gold bar that moves with scroll and drag — section-by-section storytelling.',
    tags: ['Three.js', 'Scroll 3D', 'Drag'],
  },
  {
    id: 'ingot-3d',
    slug: 'ingot-3d',
    path: '/demos/ingot-3d',
    htmlSrc: '/demos/ingot-3d.html',
    number: '03',
    title: 'Ingot 3D',
    subtitle: 'Hero canvas · glass UI',
    blurb:
      'Floating 3D ingot hero with particle field, live tickers, and crisp marketing sections.',
    tags: ['Three.js', 'Hero canvas', 'Glass'],
  },
]
