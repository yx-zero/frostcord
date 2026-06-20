import { Gif } from '../types'

// Discord stores GIF favorites client-side only (no server endpoint), so we do
// the same: persist favorited GIFs in localStorage.
const KEY = 'cd.gifFavorites.v1'

export function loadFavorites(): Gif[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Gif[]) : []
  } catch {
    return []
  }
}

export function saveFavorites(gifs: Gif[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(gifs))
  } catch {
    /* ignore quota */
  }
}

export function isFavorite(id: string): boolean {
  return loadFavorites().some((g) => g.id === id)
}

export function toggleFavorite(gif: Gif): Gif[] {
  const favs = loadFavorites()
  const idx = favs.findIndex((g) => g.id === gif.id)
  if (idx >= 0) favs.splice(idx, 1)
  else favs.unshift(gif)
  saveFavorites(favs)
  return favs
}
