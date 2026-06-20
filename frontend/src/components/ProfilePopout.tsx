import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Glass } from './Glass'
import { Avatar } from './Avatar'
import { User, UserProfile } from '../types'
import { api, isWails } from '../services/discord'
import { Markdown } from './Markdown'

interface Props {
  open: boolean
  user: User | null
  x: number
  y: number
  onClose: () => void
}

// Discord-style profile popout: banner, big avatar, name + @username, badges,
// pronouns, and About Me (bio). Fetches the full profile from Discord on open.
export function ProfilePopout({ open, user, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch the rich profile when opened (live mode only).
  useEffect(() => {
    if (!open || !user) return
    setProfile(null)
    if (!isWails()) return
    let cancelled = false
    setLoading(true)
    api
      .getUserProfile(user.id)
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, user])

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) {
      setPos({ x, y })
      return
    }
    const rect = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (nx + rect.width > window.innerWidth - 8) nx = x - rect.width
    if (ny + rect.height > window.innerHeight - 8)
      ny = window.innerHeight - rect.height - 8
    setPos({ x: Math.max(8, nx), y: Math.max(8, ny) })
  }, [open, x, y, profile])

  // Merge fetched profile over the basic user for display.
  const displayName = profile?.displayName || user?.displayName || ''
  const username = profile?.username || user?.username || ''
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl
  const accent = profile?.accentColor || 'rgb(var(--c-accent))'
  const bannerUrl = profile?.bannerUrl

  return createPortal(
    <AnimatePresence>
      {open && user && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={onClose} />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[71] w-80"
            style={{ left: pos.x, top: pos.y }}
          >
            <Glass refract className="overflow-hidden rounded-2xl">
              {/* Banner */}
              <div
                className="h-24 w-full bg-cover bg-center"
                style={{
                  background: bannerUrl
                    ? `center / cover no-repeat url(${bannerUrl})`
                    : accent.startsWith('#')
                      ? accent
                      : 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent2)))',
                }}
              />
              <div className="px-4 pb-4">
                <div className="-mt-10 mb-2">
                  <div
                    className="inline-block rounded-full p-1.5"
                    style={{ background: 'rgb(var(--c-base))' }}
                  >
                    <Avatar
                      user={{ ...user, avatarUrl }}
                      size={72}
                      showStatus
                    />
                  </div>
                </div>

                <div
                  className="rounded-xl p-3"
                  style={{ background: 'rgb(var(--c-crust) / 0.55)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-extrabold text-text">
                      {displayName}
                    </span>
                    {user.bot && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[0.6rem] font-bold text-white"
                        style={{ background: 'rgb(var(--c-accent))' }}
                      >
                        BOT
                      </span>
                    )}
                  </div>

                  {/* username • pronouns • badges row */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-subtext">
                    <span>{username}</span>
                    {profile?.pronouns && (
                      <>
                        <span className="text-muted">•</span>
                        <span>{profile.pronouns}</span>
                      </>
                    )}
                    {profile?.badgeIcons && profile.badgeIcons.length > 0 && (
                      <span className="ml-1 flex items-center gap-1">
                        {profile.badgeIcons.map((b, i) => (
                          <img key={i} src={b} alt="badge" className="h-4 w-4" />
                        ))}
                      </span>
                    )}
                  </div>

                  {/* About me / bio */}
                  {profile?.bio && (
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                        About Me
                      </div>
                      <div className="selectable whitespace-pre-wrap break-words text-sm text-subtext">
                        <Markdown content={profile.bio} />
                      </div>
                    </div>
                  )}

                  {loading && !profile && (
                    <div className="mt-2 text-xs text-muted">Loading profile…</div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      className="no-drag flex-1 rounded-lg py-1.5 text-sm font-bold transition"
                      style={{
                        background: 'rgb(var(--c-accent))',
                        color: 'rgb(var(--c-bubble-mine-text))',
                      }}
                      onClick={onClose}
                    >
                      Message
                    </button>
                    <button
                      className="no-drag rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:brightness-110"
                      style={{
                        background: 'rgb(var(--c-surface1))',
                        color: 'rgb(var(--c-text))',
                      }}
                      onClick={() => {
                        navigator.clipboard?.writeText(user.id)
                        onClose()
                      }}
                    >
                      Copy ID
                    </button>
                  </div>
                </div>
              </div>
            </Glass>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
