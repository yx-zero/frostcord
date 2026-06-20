import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Glass } from './Glass'
import { IconSearch, IconClose } from './icons'
import { mockEmoji, mockGifs, mockStickers } from '../data/mock'
import { twemojiURL } from '../utils/emoji'
import { Emoji, Gif, Sticker } from '../types'

export type PickerTab = 'emoji' | 'gif' | 'sticker'

interface Props {
  open: boolean
  tab: PickerTab
  onTab: (t: PickerTab) => void
  onClose: () => void
  onPickEmoji: (e: Emoji) => void
  onPickGif: (g: Gif) => void
  onPickSticker: (s: Sticker) => void
  /** when provided (live mode), GIFs come from Discord/Tenor */
  searchGifs?: (query: string) => Promise<Gif[]>
  /** account-synced favorite GIFs (shown by default when not searching) */
  favoriteGifs?: () => Promise<Gif[]>
}

const TABS: { id: PickerTab; label: string }[] = [
  { id: 'emoji', label: 'Emoji' },
  { id: 'gif', label: 'GIF' },
  { id: 'sticker', label: 'Stickers' },
]

export function EmojiPicker({
  open,
  tab,
  onTab,
  onClose,
  onPickEmoji,
  onPickGif,
  onPickSticker,
  searchGifs,
  favoriteGifs,
}: Props) {
  const [query, setQuery] = useState('')
  const [liveGifs, setLiveGifs] = useState<Gif[] | null>(null)
  const [gifLoading, setGifLoading] = useState(false)
  const [showingFavorites, setShowingFavorites] = useState(false)

  // GIF tab: empty query -> show account favorites (fall back to trending if
  // none); non-empty query -> search. Debounced.
  useEffect(() => {
    if (!searchGifs || tab !== 'gif' || !open) return
    let cancelled = false
    setGifLoading(true)
    const t = setTimeout(async () => {
      try {
        if (!query.trim()) {
          // Default view: favorites, then trending fallback.
          let favs: Gif[] = []
          if (favoriteGifs) {
            try {
              favs = await favoriteGifs()
            } catch {
              favs = []
            }
          }
          if (favs.length > 0) {
            if (!cancelled) {
              setShowingFavorites(true)
              setLiveGifs(favs)
            }
          } else {
            const trend = await searchGifs('')
            if (!cancelled) {
              setShowingFavorites(false)
              setLiveGifs(trend)
            }
          }
        } else {
          const results = await searchGifs(query)
          if (!cancelled) {
            setShowingFavorites(false)
            setLiveGifs(results)
          }
        }
      } catch {
        if (!cancelled) setLiveGifs([])
      } finally {
        if (!cancelled) setGifLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, tab, open, searchGifs, favoriteGifs])

  const gifs = searchGifs ? (liveGifs ?? []) : mockGifs

  const filteredEmoji = useMemo(() => {
    if (!query) return mockEmoji
    // Filter by name; unicode emoji have synthetic names so this mostly
    // demonstrates the search wiring (real impl maps shortcodes).
    return mockEmoji.filter((e) =>
      e.name.toLowerCase().includes(query.toLowerCase()),
    )
  }, [query])

  return (
    <>
      {/* click-away catcher — plain conditional (not animated) so it always
          unmounts immediately on close and never traps pointer events. */}
      {open && <div className="fixed inset-0 z-30" onClick={onClose} />}
      <AnimatePresence>
        {open && (
          <motion.div
            key="emoji-picker"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-20 right-4 z-40 w-[360px]"
            style={{ transformOrigin: 'bottom right' }}
          >
            <Glass
              refract
              className="flex h-[420px] flex-col overflow-hidden rounded-2xl"
            >
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-white/5 p-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTab(t.id)}
                    className="no-drag relative rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                    style={{
                      color:
                        tab === t.id
                          ? 'rgb(var(--c-text))'
                          : 'rgb(var(--c-muted))',
                    }}
                  >
                    {tab === t.id && (
                      <motion.span
                        layoutId="picker-tab"
                        className="absolute inset-0 -z-10 rounded-lg"
                        style={{ background: 'rgb(var(--c-accent) / 0.25)' }}
                      />
                    )}
                    {t.label}
                  </button>
                ))}
                <button
                  onClick={onClose}
                  className="no-drag ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface1 hover:text-text"
                  title="Close"
                >
                  <IconClose width={16} height={16} />
                </button>
              </div>

              {/* Search */}
              <div className="px-2 pt-2">
                <div className="flex items-center gap-2 rounded-xl bg-crust/60 px-3 py-1.5">
                  <IconSearch width={16} height={16} className="text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      tab === 'emoji'
                        ? 'Search emoji'
                        : tab === 'gif'
                          ? 'Search Tenor'
                          : 'Search stickers'
                    }
                    className="no-drag selectable w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="scroll-thin flex-1 overflow-y-auto p-2">
                {tab === 'emoji' && (
                  <div className="grid grid-cols-8 gap-0.5">
                    {filteredEmoji.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => onPickEmoji(e)}
                        className="no-drag flex h-9 w-9 items-center justify-center rounded-lg transition hover:scale-110 hover:bg-surface1"
                        title={e.name}
                      >
                        {e.char ? (
                          <img
                            src={twemojiURL(e.char)}
                            alt={e.char}
                            className="h-6 w-6"
                            draggable={false}
                          />
                        ) : (
                          <img src={e.url} alt={e.name} className="h-6 w-6" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {tab === 'gif' && (
                  <>
                    {!gifLoading && !query.trim() && gifs.length > 0 && (
                      <div className="px-1 pb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                        {showingFavorites ? '★ Favorites' : 'Trending'}
                      </div>
                    )}
                    {gifLoading && (
                      <div className="py-6 text-center text-sm text-muted">
                        Searching…
                      </div>
                    )}
                    <div className="columns-2 gap-2">
                      {gifs.map((g) => {
                        const isVideo = /\.(mp4|webm)(\?|$)/i.test(g.previewUrl)
                        return (
                          <button
                            key={g.id}
                            onClick={() => onPickGif(g)}
                            className="no-drag mb-2 block w-full overflow-hidden rounded-lg transition hover:opacity-80"
                          >
                            {isVideo ? (
                              <video
                                src={g.previewUrl}
                                className="w-full"
                                autoPlay
                                loop
                                muted
                                playsInline
                              />
                            ) : (
                              <img
                                src={g.previewUrl}
                                alt={g.title}
                                className="w-full"
                                loading="lazy"
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {!gifLoading && gifs.length === 0 && (
                      <div className="py-6 text-center text-sm text-muted">
                        No GIFs found
                      </div>
                    )}
                  </>
                )}

                {tab === 'sticker' && (
                  <div className="grid grid-cols-3 gap-2">
                    {mockStickers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onPickSticker(s)}
                        className="no-drag aspect-square overflow-hidden rounded-xl transition hover:scale-105 hover:bg-surface1"
                        title={s.name}
                      >
                        <img
                          src={s.url}
                          alt={s.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
