import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Glass } from './Glass'
import { IconSearch } from './icons'
import { filterEmoji, twemojiURL } from '../utils/emoji'

interface Props {
  open: boolean
  x: number
  y: number
  /** called with the chosen unicode emoji */
  onPick: (emoji: string) => void
  onClose: () => void
}

const W = 340
const H = 380

// A standalone emoji picker for reactions: the full unicode catalog, searchable,
// rendered Discord-style (Twemoji). Anchored at (x, y), clamped to the viewport.
export function ReactionPicker({ open, x, y, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const list = useMemo(() => filterEmoji(query), [query])

  const left = Math.max(8, Math.min(x, window.innerWidth - W - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - H - 8))

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-50"
            style={{ left, top, width: W }}
          >
            <Glass refract className="flex flex-col overflow-hidden rounded-2xl">
              <div className="p-2">
                <div className="flex items-center gap-2 rounded-xl bg-crust/60 px-3 py-1.5">
                  <IconSearch width={16} height={16} className="text-muted" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search emoji"
                    className="no-drag selectable w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                  />
                </div>
              </div>
              <div
                className="scroll-thin grid grid-cols-8 content-start gap-0.5 overflow-y-auto px-2 pb-2"
                style={{ height: H - 56 }}
              >
                {list.map((e) => (
                  <button
                    key={e.shortcode}
                    onClick={() => onPick(e.unicode)}
                    title={`:${e.shortcode}:`}
                    className="no-drag flex h-9 w-9 items-center justify-center rounded-lg transition hover:scale-110 hover:bg-surface1"
                  >
                    <img
                      src={twemojiURL(e.unicode)}
                      alt={e.shortcode}
                      className="h-6 w-6"
                      loading="lazy"
                      draggable={false}
                    />
                  </button>
                ))}
                {list.length === 0 && (
                  <div className="col-span-8 py-6 text-center text-sm text-muted">
                    No emoji found
                  </div>
                )}
              </div>
            </Glass>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
