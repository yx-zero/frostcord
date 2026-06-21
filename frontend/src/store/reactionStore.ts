import { create } from 'zustand'

// Tracks recently-used reaction emoji (most-recent-first), persisted across
// sessions. The message quick-reaction row is built from these, falling back to
// a default set — so using an emoji (from the row or the full picker) promotes
// it to the front, like Discord's frequently-used row.

const KEY = 'cd.reactions.recent.v1'
const MAX = 24

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore quota errors */
  }
}

interface ReactionState {
  recent: string[]
  /** record a use: move the emoji to the front. */
  use: (emoji: string) => void
}

export const useReactionStore = create<ReactionState>((set) => ({
  recent: load(),
  use: (emoji) =>
    set((s) => {
      const next = [emoji, ...s.recent.filter((e) => e !== emoji)].slice(0, MAX)
      save(next)
      return { recent: next }
    }),
}))

/** Build the quick-reaction row: recents first, then defaults, capped at `max`. */
export function quickReactionList(defaults: string[], recent: string[], max = 6): string[] {
  const out: string[] = []
  for (const e of recent) {
    if (out.length >= max) break
    if (!out.includes(e)) out.push(e)
  }
  for (const e of defaults) {
    if (out.length >= max) break
    if (!out.includes(e)) out.push(e)
  }
  return out
}
