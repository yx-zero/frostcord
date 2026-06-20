import { create } from 'zustand'
import {
  DEFAULT_THEME,
  PRESET_THEMES,
  Theme,
  ThemeColors,
  buildCustomTheme,
} from './themes'

interface GlassSettings {
  blur: number
  opacity: number
  refraction: number
}

interface CustomThemeInput {
  mode: 'dark' | 'light'
  base: string
  accent: string
  accent2: string
}

interface ThemeState {
  theme: Theme
  /** glass override (defaults pulled from theme, then user-tunable) */
  glass: GlassSettings
  reduceMotion: boolean
  animatedWallpaper: boolean
  customInput: CustomThemeInput
  /** all selectable themes (presets + current custom) */
  available: Theme[]
  setTheme: (id: string) => void
  setGlass: (partial: Partial<GlassSettings>) => void
  setReduceMotion: (v: boolean) => void
  setAnimatedWallpaper: (v: boolean) => void
  setCustomInput: (partial: Partial<CustomThemeInput>) => void
  applyCustom: () => void
}

const STORAGE_KEY = 'cd.theme.v1'

interface Persisted {
  themeId: string
  glass: GlassSettings
  reduceMotion: boolean
  animatedWallpaper: boolean
  customInput: CustomThemeInput
  customTheme?: Theme
}

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : {}
  } catch {
    return {}
  }
}

function persist(state: ThemeState) {
  const custom = state.available.find((t) => t.id === 'custom')
  const data: Persisted = {
    themeId: state.theme.id,
    glass: state.glass,
    reduceMotion: state.reduceMotion,
    animatedWallpaper: state.animatedWallpaper,
    customInput: state.customInput,
    customTheme: custom,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota errors */
  }
}

/** Write all theme colors + glass vars onto :root. */
export function applyThemeToDOM(
  colors: ThemeColors,
  glass: GlassSettings,
  mode: 'dark' | 'light',
  reduceMotion: boolean,
) {
  const root = document.documentElement
  const set = (k: string, v: string) => root.style.setProperty(k, v)
  set('--c-base', colors.base)
  set('--c-mantle', colors.mantle)
  set('--c-crust', colors.crust)
  set('--c-surface0', colors.surface0)
  set('--c-surface1', colors.surface1)
  set('--c-surface2', colors.surface2)
  set('--c-overlay', colors.overlay)
  set('--c-text', colors.text)
  set('--c-subtext', colors.subtext)
  set('--c-muted', colors.muted)
  set('--c-accent', colors.accent)
  set('--c-accent2', colors.accent2)
  set('--c-bubble-mine', colors.bubbleMine)
  set('--c-bubble-mine-text', colors.bubbleMineText)
  set('--c-bubble-theirs', colors.bubbleTheirs)
  set('--c-bubble-theirs-text', colors.bubbleTheirsText)
  set('--c-success', colors.success)
  set('--c-danger', colors.danger)
  set('--c-warning', colors.warning)
  set('--glass-blur', `${glass.blur}px`)
  set('--glass-opacity', `${glass.opacity}`)
  set('--glass-refraction', `${glass.refraction}`)
  root.dataset.mode = mode
  root.classList.toggle('reduce-motion', reduceMotion)
  root.style.colorScheme = mode
}

const persisted = loadPersisted()

// Resolve initial theme
const initialAvailable: Theme[] = [...PRESET_THEMES]
if (persisted.customTheme) initialAvailable.push(persisted.customTheme)
const initialTheme =
  initialAvailable.find((t) => t.id === persisted.themeId) ?? DEFAULT_THEME
const initialGlass: GlassSettings = persisted.glass ?? initialTheme.glass

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  glass: initialGlass,
  reduceMotion: persisted.reduceMotion ?? false,
  animatedWallpaper: persisted.animatedWallpaper ?? true,
  customInput:
    persisted.customInput ??
    { mode: 'dark', base: '#1a1b26', accent: '#7aa2f7', accent2: '#bb9af7' },
  available: initialAvailable,

  setTheme: (id) => {
    const theme = get().available.find((t) => t.id === id)
    if (!theme) return
    // When switching themes, adopt that theme's default glass tuning.
    set({ theme, glass: theme.glass })
    const s = get()
    applyThemeToDOM(theme.colors, theme.glass, theme.mode, s.reduceMotion)
    persist(get())
  },

  setGlass: (partial) => {
    const glass = { ...get().glass, ...partial }
    set({ glass })
    const s = get()
    applyThemeToDOM(s.theme.colors, glass, s.theme.mode, s.reduceMotion)
    persist(get())
  },

  setReduceMotion: (v) => {
    set({ reduceMotion: v })
    const s = get()
    applyThemeToDOM(s.theme.colors, s.glass, s.theme.mode, v)
    persist(get())
  },

  setAnimatedWallpaper: (v) => {
    set({ animatedWallpaper: v })
    persist(get())
  },

  setCustomInput: (partial) => {
    set({ customInput: { ...get().customInput, ...partial } })
    persist(get())
  },

  applyCustom: () => {
    const input = get().customInput
    const custom = buildCustomTheme({
      mode: input.mode,
      base: input.base,
      accent: input.accent,
      accent2: input.accent2,
    })
    const available = get().available.filter((t) => t.id !== 'custom')
    available.push(custom)
    set({ available, theme: custom, glass: custom.glass })
    const s = get()
    applyThemeToDOM(custom.colors, custom.glass, custom.mode, s.reduceMotion)
    persist(get())
  },
}))

/** Call once at startup to paint the initial theme. */
export function initTheme() {
  const s = useThemeStore.getState()
  applyThemeToDOM(s.theme.colors, s.glass, s.theme.mode, s.reduceMotion)
}
