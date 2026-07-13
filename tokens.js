// Design tokens da identidade Lizard Intelligence: paleta, raios e sombras.
// Espelha as CSS variables (formato shadcn) definidas em lizard.css; é consumido
// pelos estilos inline dos componentes/telas como fonte única de cor.

export const TOKENS = {
  // Fundo e superfícies
  bg: '#F5F8FC',
  surface: '#FFFFFF',
  panel: '#FAFBFE',
  panelAlt: '#F2F5FA',
  panelSoft: '#F7F9FC',

  // Bordas
  border: '#E4EAF2',
  borderStrong: '#DDE5F0',

  // Texto
  title: '#101A33',
  text: '#1B2335',
  textBody: '#141B2E',
  textMuted: '#5F6F89',
  textSubtle: '#8A99B4',
  textFaint: '#A6B2C8',

  // Marca / primária
  primary: '#2454D9',
  primaryHover: '#1F4FE0',
  primaryFg: '#1F4FE0',
  primarySoft: '#EAF0FE',
  primarySoftBorder: '#D4E0FB',
  brand: '#102A73',
  brandLight: '#1B3A8C',

  // Semânticos
  success: '#1B7F4B',
  successStrong: '#27A567',
  successSoft: '#E6F6EE',
  warning: '#B7791F',
  warningStrong: '#946312',
  warningSoft: '#FBF6E9',
  warningSoftAlt: '#FBF1DE',
  warningBorder: '#F1E4C2',
  danger: '#C13238',
  dangerStrong: '#E5484D',
  dangerSoft: '#FBE9EA',
  purple: '#5B53C9',
  purpleSoft: '#ECEBFA',
};

export const RADII = {
  base: 9,
  card: 12,
  control: 10,
  modal: 14,
  pill: 999,
};

export const SHADOWS = {
  primary: '0 2px 6px rgba(36,84,217,.28)',
  brand: '0 1px 2px rgba(16,42,115,.18)',
  modal: '0 24px 60px rgba(16,26,51,.28)',
  slideOver: '-12px 0 40px rgba(16,26,51,.18)',
};

export const I = {
  chevLeft:    'M15 18l-6-6 6-6',
  chevRight:   'M9 18l6-6-6-6',
  chevDown:    'M6 9l6 6 6-6',
  download:    'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  doc:         'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  x:           'M18 6L6 18M6 6l12 12',
  wallet:      'M19 7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2zM16 11h.01',
  refresh:     'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  shieldCheck: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  alert:       'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  link:        'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  history:     'M3 3v5h5M3.05 13A9 9 0 1021 12M12 7v5l3 3',
  send:        'M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z',
  chart:       'M18 20V10M12 20V4M6 20v-6',
  check:       'M20 6L9 17l-5-5',
  info:        'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01',
  arrowLeft:   'M19 12H5M12 19l-7-7 7-7',
  home:        'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
  users:       'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  list:        'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  cpu:         'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  fileText:    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  settings:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  flask:       'M9 3h6l3 9H6L9 3zM6.5 21a5.5 5.5 0 1011 0H6.5z',
  grid:        'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  box:         'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
  bars:        'M18 20V10M12 20V4M6 20v-6',
  search:      'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  bell:        'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
};
