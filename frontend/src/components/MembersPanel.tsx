import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Glass } from './Glass'
import { Avatar } from './Avatar'
import { Message, User } from '../types'
import { useAppStore } from '../store/appStore'
import { useChatStore } from '../store/chatStore'

// Members panel:
//  - DM/group-DM: the channel recipients + you.
//  - Guild: the full member list (gateway op 14 / REST search), falling back to
//    the authors seen in this channel's messages.
export function MembersPanel({
  open,
  messages,
}: {
  open: boolean
  messages: Message[]
}) {
  const openProfile = useAppStore((s) => s.openProfile)
  const activeServerId = useChatStore((s) => s.activeServerId)
  const activeChannelId = useChatStore((s) => s.activeChannelId)
  const channelsByServer = useChatStore((s) => s.channelsByServer)
  const guildMembers = useChatStore((s) => s.membersByGuild[s.activeServerId])
  const me = useChatStore((s) => s.me)

  const members = useMemo(() => {
    // DM / group DM: use the channel recipients + me.
    if (activeServerId === '@me') {
      const ch = (channelsByServer['@me'] ?? []).find(
        (c) => c.id === activeChannelId,
      )
      const map = new Map<string, User>()
      map.set(me.id, me)
      for (const r of ch?.recipients ?? []) map.set(r.id, r)
      // Also fold in any message authors (covers edge cases).
      for (const m of messages) if (!map.has(m.author.id)) map.set(m.author.id, m.author)
      return Array.from(map.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      )
    }
    // Full guild member list if we have it.
    if (guildMembers && guildMembers.length > 0) {
      return [...guildMembers].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      )
    }
    // Fallback: participants from messages.
    const map = new Map<string, User>()
    for (const m of messages) {
      if (!map.has(m.author.id)) map.set(m.author.id, m.author)
    }
    return Array.from(map.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    )
  }, [activeServerId, activeChannelId, channelsByServer, guildMembers, me, messages])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 240, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden py-3 pr-3"
        >
          <Glass className="flex h-full w-[228px] flex-col overflow-hidden rounded-2xl">
            <div className="border-b border-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted">
              Members — {members.length}
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto p-2">
              {members.map((u) => (
                <button
                  key={u.id}
                  onClick={(e) => openProfile(u, e.clientX - 250, e.clientY)}
                  className="no-drag flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface1/50"
                >
                  <Avatar user={u} size={32} showStatus />
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium text-subtext">
                      {u.displayName}
                    </span>
                    {u.username && (
                      <span className="truncate text-[0.7rem] text-muted">
                        @{u.username}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {members.length === 0 && (
                <div className="py-6 text-center text-sm text-muted">
                  No participants yet
                </div>
              )}
            </div>
          </Glass>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
