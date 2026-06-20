import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Glass } from './Glass'

export interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  divider?: boolean
  /** when set, renders a row of quick-reaction emoji buttons instead of a label */
  quickReactions?: { emoji: string; onClick: () => void }[]
  /** disable + grey out (for not-yet-implemented actions) */
  disabled?: boolean
  /** small text badge on the right (e.g. "ID") */
  badge?: string
  /** show a › to indicate a submenu (cosmetic) */
  submenu?: boolean
}

interface Pos {
  x: number
  y: number
}

interface Props {
  open: boolean
  pos: Pos
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ open, pos, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [adjusted, setAdjusted] = useState<Pos>(pos)

  // Keep the menu on-screen.
  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) {
      setAdjusted(pos)
      return
    }
    const rect = el.getBoundingClientRect()
    let x = pos.x
    let y = pos.y
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8
    setAdjusted({ x: Math.max(8, x), y: Math.max(8, y) })
  }, [open, pos])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[61]"
            style={{ left: adjusted.x, top: adjusted.y, transformOrigin: 'top left' }}
          >
            <Glass refract className="min-w-[200px] overflow-hidden rounded-xl p-1.5">
              {items.map((item, i) =>
                item.divider ? (
                  <div
                    key={i}
                    className="my-1 h-px"
                    style={{ background: 'rgb(var(--c-overlay) / 0.4)' }}
                  />
                ) : item.quickReactions ? (
                  <div key={i} className="mb-1 flex items-center gap-1 px-1.5 py-1">
                    {item.quickReactions.map((qr) => (
                      <button
                        key={qr.emoji}
                        onClick={() => {
                          qr.onClick()
                          onClose()
                        }}
                        className="no-drag flex h-8 w-8 items-center justify-center rounded-md text-lg transition hover:bg-surface1"
                      >
                        {qr.emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    key={i}
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return
                      item.onClick()
                      onClose()
                    }}
                    className="no-drag flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm font-medium transition disabled:opacity-40"
                    style={{
                      color: item.danger ? 'rgb(var(--c-danger))' : 'rgb(var(--c-text))',
                    }}
                    onMouseEnter={(e) => {
                      if (!item.disabled)
                        e.currentTarget.style.background = item.danger
                          ? 'rgb(var(--c-danger) / 0.18)'
                          : 'rgb(var(--c-accent) / 0.2)'
                    }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.submenu && <span className="text-muted">›</span>}
                    {item.badge && (
                      <span
                        className="rounded px-1 text-[0.6rem] font-bold"
                        style={{ background: 'rgb(var(--c-surface2))', color: 'rgb(var(--c-subtext))' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                ),
              )}
            </Glass>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
