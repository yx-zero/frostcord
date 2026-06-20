// Theme system: every color is an "R G B" triple string so it can drop into
// CSS custom properties consumed by Tailwind's rgb(var(--x) / <alpha>) syntax.

export interface ThemeColors {
  base: string // app background
  mantle: string // slightly darker panels
  crust: string // darkest (rail)
  surface0: string // glass / cards
  surface1: string // hovered surfaces
  surface2: string // active surfaces
  overlay: string // borders, scrollbars
  text: string // primary text
  subtext: string // secondary text
  muted: string // tertiary / timestamps
  accent: string // brand accent
  accent2: string // secondary accent (gradients)
  bubbleMine: string // my message bubble bg
  bubbleMineText: string // my message bubble text
  bubbleTheirs: string // others' bubble bg
  bubbleTheirsText: string // others' bubble text
  success: string
  danger: string
  warning: string
}

export interface Theme {
  id: string
  name: string
  /** 'dark' | 'light' — affects a few contrast decisions */
  mode: 'dark' | 'light'
  colors: ThemeColors
  /** default glass tuning for this theme (user can override) */
  glass: {
    blur: number // px
    opacity: number // 0..1 background opacity of glass
    refraction: number // 0..1 strength of SVG displacement layer
  }
}

const r = (hex: string): string => {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

// ---- Catppuccin Mocha (default) -------------------------------------------
export const catppuccinMocha: Theme = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  mode: 'dark',
  colors: {
    base: r('#1e1e2e'),
    mantle: r('#181825'),
    crust: r('#11111b'),
    surface0: r('#313244'),
    surface1: r('#45475a'),
    surface2: r('#585b70'),
    overlay: r('#6c7086'),
    text: r('#cdd6f4'),
    subtext: r('#bac2de'),
    muted: r('#7f849c'),
    accent: r('#cba6f7'), // mauve
    accent2: r('#89b4fa'), // blue
    bubbleMine: r('#cba6f7'),
    bubbleMineText: r('#1e1e2e'),
    bubbleTheirs: r('#313244'),
    bubbleTheirsText: r('#cdd6f4'),
    success: r('#a6e3a1'),
    danger: r('#f38ba8'),
    warning: r('#f9e2af'),
  },
  glass: { blur: 20, opacity: 0.5, refraction: 0.55 },
}

// ---- Catppuccin Latte (light) ---------------------------------------------
export const catppuccinLatte: Theme = {
  id: 'catppuccin-latte',
  name: 'Catppuccin Latte',
  mode: 'light',
  colors: {
    base: r('#eff1f5'),
    mantle: r('#e6e9ef'),
    crust: r('#dce0e8'),
    surface0: r('#ccd0da'),
    surface1: r('#bcc0cc'),
    surface2: r('#acb0be'),
    overlay: r('#9ca0b0'),
    text: r('#4c4f69'),
    subtext: r('#5c5f77'),
    muted: r('#8c8fa1'),
    accent: r('#8839ef'), // mauve
    accent2: r('#1e66f5'), // blue
    bubbleMine: r('#8839ef'),
    bubbleMineText: r('#eff1f5'),
    bubbleTheirs: r('#ffffff'),
    bubbleTheirsText: r('#4c4f69'),
    success: r('#40a02b'),
    danger: r('#d20f39'),
    warning: r('#df8e1d'),
  },
  glass: { blur: 22, opacity: 0.55, refraction: 0.45 },
}

// ---- Discord Dark ----------------------------------------------------------
export const discordDark: Theme = {
  id: 'discord-dark',
  name: 'Discord Dark',
  mode: 'dark',
  colors: {
    base: r('#313338'),
    mantle: r('#2b2d31'),
    crust: r('#1e1f22'),
    surface0: r('#383a40'),
    surface1: r('#404249'),
    surface2: r('#4e5058'),
    overlay: r('#6d6f78'),
    text: r('#dbdee1'),
    subtext: r('#b5bac1'),
    muted: r('#949ba4'),
    accent: r('#5865f2'), // blurple
    accent2: r('#3ba55d'),
    bubbleMine: r('#5865f2'),
    bubbleMineText: r('#ffffff'),
    bubbleTheirs: r('#383a40'),
    bubbleTheirsText: r('#dbdee1'),
    success: r('#3ba55d'),
    danger: r('#ed4245'),
    warning: r('#faa81a'),
  },
  glass: { blur: 16, opacity: 0.6, refraction: 0.4 },
}

// ---- Telegram (signature blue) --------------------------------------------
export const telegram: Theme = {
  id: 'telegram',
  name: 'Telegram',
  mode: 'dark',
  colors: {
    base: r('#17212b'),
    mantle: r('#0e1621'),
    crust: r('#0a121a'),
    surface0: r('#1f2c3a'),
    surface1: r('#243447'),
    surface2: r('#2b5278'),
    overlay: r('#3d4a5c'),
    text: r('#ffffff'),
    subtext: r('#aebfcf'),
    muted: r('#6d7f8f'),
    accent: r('#5288c1'), // telegram blue
    accent2: r('#64b5ef'),
    bubbleMine: r('#2b5278'), // telegram outgoing bubble
    bubbleMineText: r('#ffffff'),
    bubbleTheirs: r('#182533'), // telegram incoming bubble
    bubbleTheirsText: r('#ffffff'),
    success: r('#4dcd5e'),
    danger: r('#ec3942'),
    warning: r('#f5bd5c'),
  },
  glass: { blur: 18, opacity: 0.55, refraction: 0.5 },
}

// ---- AMOLED black ----------------------------------------------------------
export const amoled: Theme = {
  id: 'amoled',
  name: 'AMOLED Black',
  mode: 'dark',
  colors: {
    base: r('#000000'),
    mantle: r('#050505'),
    crust: r('#000000'),
    surface0: r('#0e0e0e'),
    surface1: r('#1a1a1a'),
    surface2: r('#262626'),
    overlay: r('#3a3a3a'),
    text: r('#f5f5f5'),
    subtext: r('#b0b0b0'),
    muted: r('#6e6e6e'),
    accent: r('#cba6f7'),
    accent2: r('#7aa2f7'),
    bubbleMine: r('#cba6f7'),
    bubbleMineText: r('#000000'),
    bubbleTheirs: r('#161616'),
    bubbleTheirsText: r('#f5f5f5'),
    success: r('#3ad07a'),
    danger: r('#ff5c6c'),
    warning: r('#ffcc66'),
  },
  glass: { blur: 14, opacity: 0.4, refraction: 0.35 },
}

export const PRESET_THEMES: Theme[] = [
  catppuccinMocha,
  telegram,
  discordDark,
  amoled,
  catppuccinLatte,
]

export const DEFAULT_THEME = catppuccinMocha

/** Build a custom theme from an accent + base, deriving the rest. */
export function buildCustomTheme(opts: {
  name?: string
  mode: 'dark' | 'light'
  base: string // hex
  accent: string // hex
  accent2?: string // hex
}): Theme {
  const isDark = opts.mode === 'dark'
  const baseRgb = hexToRgbTuple(opts.base)
  const lift = (amount: number) => shiftTuple(baseRgb, isDark ? amount : -amount)
  const text = isDark ? r('#e8e8ef') : r('#2a2a35')
  return {
    id: 'custom',
    name: opts.name ?? 'Custom',
    mode: opts.mode,
    colors: {
      base: tupleStr(baseRgb),
      mantle: tupleStr(shiftTuple(baseRgb, isDark ? -8 : -6)),
      crust: tupleStr(shiftTuple(baseRgb, isDark ? -16 : -12)),
      surface0: tupleStr(lift(18)),
      surface1: tupleStr(lift(30)),
      surface2: tupleStr(lift(44)),
      overlay: tupleStr(lift(64)),
      text,
      subtext: isDark ? r('#b8b8c6') : r('#52525e'),
      muted: isDark ? r('#7c7c8a') : r('#8a8a96'),
      accent: r(opts.accent),
      accent2: r(opts.accent2 ?? opts.accent),
      bubbleMine: r(opts.accent),
      bubbleMineText: pickContrast(opts.accent),
      bubbleTheirs: tupleStr(lift(18)),
      bubbleTheirsText: text,
      success: r('#3ad07a'),
      danger: r('#ff5c6c'),
      warning: r('#ffcc66'),
    },
    glass: { blur: 18, opacity: 0.5, refraction: 0.5 },
  }
}

// --- small color helpers ---------------------------------------------------
function hexToRgbTuple(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function shiftTuple(
  t: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    clamp(t[0] + amount),
    clamp(t[1] + amount),
    clamp(t[2] + amount),
  ]
}
function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}
function tupleStr(t: [number, number, number]): string {
  return `${t[0]} ${t[1]} ${t[2]}`
}
/** Choose black/white text for best contrast against a hex bg. */
function pickContrast(hex: string): string {
  const [rr, gg, bb] = hexToRgbTuple(hex)
  const luminance = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255
  return luminance > 0.6 ? '17 17 17' : '255 255 255'
}
