// Emoji support: :shortcode: <-> unicode mapping (Discord/JoyPixels names) and
// rendering unicode emoji as Discord-style Twemoji images.
//
// Data comes from emojibase (compact dataset + joypixels shortcodes, which match
// Discord's :sob: / :joy: naming). Images come from the jdecked/twemoji fork —
// the exact set Discord renders — via jsDelivr.

import compact from 'emojibase-data/en/compact.json'
import joypixels from 'emojibase-data/en/shortcodes/joypixels.json'
import emojibaseSc from 'emojibase-data/en/shortcodes/emojibase.json'

interface CompactEmoji {
  hexcode: string
  unicode: string
  label: string
  tags?: string[]
}

export interface EmojiEntry {
  shortcode: string // primary, e.g. "sob"
  unicode: string // 😭
  label: string
}

// --- build maps ---
const shortcodeToUnicode = new Map<string, string>()
const unicodeToShortcode = new Map<string, string>()
const entries: EmojiEntry[] = []

function asArray(v: unknown): string[] {
  if (!v) return []
  return Array.isArray(v) ? (v as string[]) : [v as string]
}

for (const e of compact as CompactEmoji[]) {
  const jp = asArray((joypixels as Record<string, unknown>)[e.hexcode])
  const eb = asArray((emojibaseSc as Record<string, unknown>)[e.hexcode])
  const codes = [...jp, ...eb]
  if (codes.length === 0) continue
  const primary = codes[0]
  if (!unicodeToShortcode.has(e.unicode)) {
    unicodeToShortcode.set(e.unicode, primary)
    entries.push({ shortcode: primary, unicode: e.unicode, label: e.label })
  }
  for (const c of codes) {
    if (!shortcodeToUnicode.has(c)) shortcodeToUnicode.set(c, e.unicode)
  }
}

/** Resolve a bare shortcode (without colons) to its unicode emoji, or null. */
export function emojiForShortcode(code: string): string | null {
  return shortcodeToUnicode.get(code.toLowerCase()) ?? null
}

/** Replace every :shortcode: in text with its unicode emoji. */
export function replaceShortcodes(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/gi, (m, name: string) => {
    return shortcodeToUnicode.get(name.toLowerCase()) ?? m
  })
}

/** The full emoji catalog (one entry per unicode emoji), for the picker. */
export const ALL_EMOJI: EmojiEntry[] = entries

/** Filter the full catalog by shortcode + label (no limit). Empty -> all. */
export function filterEmoji(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  const starts: EmojiEntry[] = []
  const includes: EmojiEntry[] = []
  for (const e of entries) {
    if (e.shortcode.startsWith(q)) starts.push(e)
    else if (e.shortcode.includes(q) || e.label.toLowerCase().includes(q))
      includes.push(e)
  }
  return [...starts, ...includes]
}

/** Search emoji by shortcode/label for the autocomplete (max `limit`). */
export function searchEmoji(query: string, limit = 8): EmojiEntry[] {
  const q = query.toLowerCase()
  if (!q) return entries.slice(0, limit)
  const starts: EmojiEntry[] = []
  const includes: EmojiEntry[] = []
  for (const e of entries) {
    if (e.shortcode.startsWith(q)) starts.push(e)
    else if (e.shortcode.includes(q)) includes.push(e)
    if (starts.length >= limit) break
  }
  return [...starts, ...includes].slice(0, limit)
}

// --- twemoji image rendering ---
const TWEMOJI_BASE =
  'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/'

// Convert a unicode emoji to its twemoji codepoint filename (Twemoji's algo:
// strips the FE0F variation selector unless it's a keycap).
export function emojiToCodepoint(emoji: string): string {
  const points: string[] = []
  let i = 0
  while (i < emoji.length) {
    const cp = emoji.codePointAt(i)!
    points.push(cp.toString(16))
    i += cp > 0xffff ? 2 : 1
  }
  // Drop variation selector FE0F unless this is a keycap sequence (has 20E3).
  const hasKeycap = points.includes('20e3')
  const filtered = hasKeycap ? points : points.filter((p) => p !== 'fe0f')
  return filtered.join('-')
}

/** Twemoji SVG image url for a unicode emoji. */
export function twemojiURL(emoji: string): string {
  return TWEMOJI_BASE + emojiToCodepoint(emoji) + '.svg'
}

// Regex matching emoji runs (broad: surrogate pairs, VS16, ZWJ sequences,
// keycaps, regional indicators). Good enough to wrap emoji for image rendering.
export const EMOJI_REGEX =
  /(\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)/gu
