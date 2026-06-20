import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Glass } from './Glass'
import { Channel, Message } from '../types'
import { IconHash, IconVolume, IconSearch, IconPin, IconUsers, IconSettings } from './icons'
import { WindowControls } from './WindowControls'
import { useChatStore } from '../store/chatStore'
import { api } from '../services/discord'
import { Markdown } from './Markdown'
import { formatTime } from '../utils/format'

interface Props {
  channel: Channel | undefined
  onOpenSettings: () => void
}

export function ChatTopBar({ channel, onOpenSettings }: Props) {
  const toggleMembers = useChatStore((s) => s.toggleMembers)
  const toggleSearch = useChatStore((s) => s.toggleSearch)
  const showMembers = useChatStore((s) => s.showMembers)
  const searchOpen = useChatStore((s) => s.searchOpen)
  const live = useChatStore((s) => s.live)

  const [pinsOpen, setPinsOpen] = useState(false)
  const [pins, setPins] = useState<Message[]>([])
  const [pinsLoading, setPinsLoading] = useState(false)

  const openPins = async () => {
    setPinsOpen((v) => !v)
    if (!pinsOpen && channel && live) {
      setPinsLoading(true)
      try {
        setPins(await api.getPinnedMessages(channel.id))
      } catch {
        setPins([])
      } finally {
        setPinsLoading(false)
      }
    }
  }

  return (
    <div className="z-10 px-3 pt-3">
      <Glass
        refract
        className="drag-region flex items-center gap-2 rounded-2xl px-4 py-2.5"
      >
        {!channel?.isDM && (
          <span className="text-muted">
            {channel?.type === 'voice' ? (
              <IconVolume width={20} height={20} />
            ) : (
              <IconHash width={20} height={20} />
            )}
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-bold leading-tight text-text">
            {channel?.name ?? 'Select a channel'}
          </span>
          {channel?.topic && (
            <span className="truncate text-xs text-muted">{channel.topic}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <TopButton title="Pinned" onClick={openPins} active={pinsOpen}>
              <IconPin width={18} height={18} />
            </TopButton>
            <PinnedPopover
              open={pinsOpen}
              loading={pinsLoading}
              pins={pins}
              onClose={() => setPinsOpen(false)}
            />
          </div>
          <TopButton title="Members" onClick={toggleMembers} active={showMembers}>
            <IconUsers width={18} height={18} />
          </TopButton>
          <TopButton title="Search" onClick={toggleSearch} active={searchOpen}>
            <IconSearch width={18} height={18} />
          </TopButton>
          <TopButton title="Settings" onClick={onOpenSettings}>
            <IconSettings width={18} height={18} />
          </TopButton>
          {/* Window frame controls (frameless window) */}
          <div className="ml-1 border-l border-white/10 pl-1">
            <WindowControls />
          </div>
        </div>
      </Glass>
    </div>
  )
}

function TopButton({
  children,
  title,
  onClick,
  active,
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="no-drag flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-surface1 hover:text-text"
      style={{
        background: active ? 'rgb(var(--c-accent) / 0.25)' : undefined,
        color: active ? 'rgb(var(--c-accent))' : 'rgb(var(--c-subtext))',
      }}
    >
      {children}
    </button>
  )
}

function PinnedPopover({
  open,
  loading,
  pins,
  onClose,
}: {
  open: boolean
  loading: boolean
  pins: Message[]
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-10 z-50 w-80"
            style={{ transformOrigin: 'top right' }}
          >
            <Glass refract className="overflow-hidden rounded-2xl">
              <div className="border-b border-white/5 px-4 py-2.5 text-sm font-bold text-text">
                Pinned Messages
              </div>
              <div className="scroll-thin max-h-96 overflow-y-auto p-2">
                {loading && (
                  <div className="py-6 text-center text-sm text-muted">Loading…</div>
                )}
                {!loading && pins.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted">
                    No pinned messages
                  </div>
                )}
                {pins.map((m) => (
                  <div
                    key={m.id}
                    className="mb-1 rounded-lg p-2"
                    style={{ background: 'rgb(var(--c-surface0) / 0.5)' }}
                  >
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span
                        className="text-xs font-bold"
                        style={{ color: 'rgb(var(--c-accent2))' }}
                      >
                        {m.author.displayName}
                      </span>
                      <span className="text-[0.65rem] text-muted">
                        {formatTime(m.timestamp)}
                      </span>
                    </div>
                    <div className="selectable text-sm text-subtext">
                      <Markdown content={m.content || '(attachment)'} />
                    </div>
                  </div>
                ))}
              </div>
            </Glass>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

