import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Glass } from './Glass'
import { Avatar } from './Avatar'
import { Channel, User } from '../types'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/appStore'
import { api } from '../services/discord'
import type { MenuItem } from './ContextMenu'
import {
  IconHash,
  IconVolume,
  IconChevron,
  IconSearch,
  IconMic,
  IconHeadphones,
  IconSettings,
  IconUsers,
} from './icons'

export function ChannelSidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const me = useChatStore((s) => s.me)
  const servers = useChatStore((s) => s.servers)
  const channelsByServer = useChatStore((s) => s.channelsByServer)
  const activeServerId = useChatStore((s) => s.activeServerId)
  const activeChannelId = useChatStore((s) => s.activeChannelId)
  const setActiveChannel = useChatStore((s) => s.setActiveChannel)
  const goLive = useChatStore((s) => s.goLive)
  const openContextMenu = useAppStore((s) => s.openContextMenu)
  const setPhase = useAppStore((s) => s.setPhase)
  const showFriends = useAppStore((s) => s.showFriends)
  const setShowFriends = useAppStore((s) => s.setShowFriends)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState('')

  // Account menu: switch between saved accounts, add one, or log out.
  const openAccountMenu = async (e: React.MouseEvent) => {
    const accounts = await api.listAccounts()
    const items: MenuItem[] = accounts
      .filter((a) => a.id !== me.id)
      .map((a) => ({
        label: `Switch to ${a.globalName || a.username}`,
        onClick: async () => {
          const res = await api.switchAccount(a.id)
          if (res.ok && res.user) {
            const servers = await api.getServers()
            await goLive(res.user, servers)
          }
        },
      }))
    items.push({
      label: 'Add an account',
      onClick: async () => {
        await api.logout()
        setPhase('login')
      },
    })
    items.push({
      label: 'Log out',
      danger: true,
      onClick: async () => {
        await api.logout()
        setPhase('login')
      },
    })
    openContextMenu(e.clientX, e.clientY - items.length * 36, items)
  }

  // Right-click menu for a channel (or DM/group-DM).
  const channelMenu = (ch: Channel, e: React.MouseEvent) => {
    e.preventDefault()
    const copy = (t: string) => navigator.clipboard?.writeText(t)
    const guildId = ch.serverId
    const link =
      guildId && guildId !== '@me'
        ? `https://discord.com/channels/${guildId}/${ch.id}`
        : `https://discord.com/channels/@me/${ch.id}`

    if (ch.isDM) {
      openContextMenu(e.clientX, e.clientY, [
        { label: 'Pin', disabled: true, onClick: () => {} },
        { divider: true, label: '', onClick: () => {} },
        { label: 'Mute Conversation', submenu: true, disabled: true, onClick: () => {} },
        { label: 'Leave', danger: true, disabled: true, onClick: () => {} },
        { divider: true, label: '', onClick: () => {} },
        { label: 'Copy Channel ID', badge: 'ID', onClick: () => copy(ch.id) },
      ])
      return
    }
    openContextMenu(e.clientX, e.clientY, [
      { label: 'Invite to Channel', disabled: true, onClick: () => {} },
      { label: 'Copy Link', onClick: () => copy(link) },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Mute Channel', submenu: true, disabled: true, onClick: () => {} },
      { label: 'Notification Settings', submenu: true, disabled: true, onClick: () => {} },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Edit Channel', disabled: true, onClick: () => {} },
      { label: 'Delete Channel', danger: true, disabled: true, onClick: () => {} },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Copy Channel ID', badge: 'ID', onClick: () => copy(ch.id) },
    ])
  }

  const server = servers.find((s) => s.id === activeServerId)
  const channels = useMemo(
    () => channelsByServer[activeServerId] ?? [],
    [channelsByServer, activeServerId],
  )

  // Sidebar search: filter channels/DMs by name (or @username for DMs).
  const filteredChannels = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return channels
    return channels.filter(
      (c) =>
        c.type === 'category' || // keep categories so kept children still group
        c.name.toLowerCase().includes(q) ||
        (c.subtitle ?? '').toLowerCase().includes(q),
    )
  }, [channels, filter])

  // Group channels under their category, sorted the way Discord orders them:
  // categories by position; within a category, text/announcement channels first
  // (by position), then voice (by position); uncategorized at the top.
  const groups = useMemo(() => {
    const src = filteredChannels
    const byPos = (a: Channel, b: Channel) =>
      (a.position ?? 0) - (b.position ?? 0)

    const sortChannels = (list: Channel[]) => {
      const isVoice = (c: Channel) => c.type === 'voice'
      return [...list].sort((a, b) => {
        // Text-type channels come before voice channels.
        if (isVoice(a) !== isVoice(b)) return isVoice(a) ? 1 : -1
        return byPos(a, b)
      })
    }

    const cats = src
      .filter((c) => c.type === 'category')
      .sort(byPos)
    const result: { category: Channel | null; items: Channel[] }[] = []

    const uncategorized = sortChannels(
      src.filter((c) => c.type !== 'category' && !c.parentId),
    )
    if (uncategorized.length) result.push({ category: null, items: uncategorized })

    for (const cat of cats) {
      const items = sortChannels(src.filter((c) => c.parentId === cat.id))
      // Hide empty categories when filtering.
      if (items.length || !filter.trim()) {
        result.push({ category: cat, items })
      }
    }
    return result
  }, [filteredChannels, filter])

  return (
    <Glass className="m-2 mr-0 flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl">
      {/* Server header */}
      <div className="drag-region flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="truncate font-extrabold text-text">
          {server?.name ?? 'Server'}
        </span>
        <IconChevron width={16} height={16} className="ml-auto text-muted" />
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-crust/50 px-3 py-1.5">
          <IconSearch width={15} height={15} className="text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            className="no-drag selectable w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
        </div>
      </div>

      {/* Friends button (DM view only) */}
      {activeServerId === '@me' && (
        <div className="px-2 pt-2">
          <button
            onClick={() => setShowFriends(true)}
            className="no-drag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold transition"
            style={{
              background: showFriends ? 'rgb(var(--c-accent) / 0.18)' : 'transparent',
              color: showFriends ? 'rgb(var(--c-text))' : 'rgb(var(--c-subtext))',
            }}
          >
            <IconUsers width={18} height={18} />
            Friends
          </button>
        </div>
      )}

      {/* Channel list */}
      <div className="scroll-none mt-2 flex-1 overflow-y-auto px-3 pb-2">
        {groups.map((group, gi) => {
          const catId = group.category?.id ?? `__uncat_${gi}`
          const isCollapsed = collapsed[catId]
          return (
            <div key={catId} className="mb-1">
              {group.category && (
                <button
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [catId]: !c[catId] }))
                  }
                  className="no-drag flex w-full items-center gap-1 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted transition hover:text-subtext"
                >
                  <IconChevron
                    width={12}
                    height={12}
                    style={{
                      transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                      transition: 'transform 0.18s',
                    }}
                  />
                  {group.category.name}
                </button>
              )}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    {group.items.map((ch) => (
                      <ChannelRow
                        key={ch.id}
                        channel={ch}
                        active={ch.id === activeChannelId}
                        onClick={() => {
                          if (ch.type === 'text') {
                            setShowFriends(false)
                            setActiveChannel(ch.id)
                          }
                        }}
                        onContextMenu={(e) => channelMenu(ch, e)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* User strip */}
      <div
        className="flex items-center gap-2 border-t border-white/5 px-2 py-2"
        style={{ background: 'rgb(var(--c-crust) / 0.5)' }}
      >
        <button
          onClick={openAccountMenu}
          className="no-drag flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition hover:bg-surface1/50"
          title="Accounts"
        >
          <Avatar user={me} size={32} showStatus />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-bold text-text">
              {me.displayName}
            </span>
            <span className="truncate text-[0.7rem] text-success">Online</span>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <StripButton title="Mute">
            <IconMic width={16} height={16} />
          </StripButton>
          <StripButton title="Deafen">
            <IconHeadphones width={16} height={16} />
          </StripButton>
          <StripButton title="Settings" onClick={onOpenSettings}>
            <IconSettings width={16} height={16} />
          </StripButton>
        </div>
      </div>
    </Glass>
  )
}

// Fixed hover lift: the row springs to a static offset (and a slight scale) on
// hover and stays there — it does NOT track the cursor's position.
const hoverLift = { x: 8, scale: 1.02 }
const hoverSpring = { type: 'spring', stiffness: 400, damping: 26, mass: 0.5 } as const

function ChannelRow({
  channel,
  active,
  onClick,
  onContextMenu,
}: {
  channel: Channel
  active: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const isVoice = channel.type === 'voice'
  const isDM = channel.isDM

  // DM rows render as a user row: avatar + name + @username subtitle.
  if (isDM) {
    const dmUser: User = {
      id: channel.id,
      username: channel.subtitle?.replace(/^@/, '') ?? channel.name,
      displayName: channel.name,
      avatarUrl: channel.avatarUrl,
    }
    return (
      <motion.button
        whileHover={hoverLift}
        transition={hoverSpring}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="no-drag group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface1/40"
      >
        {active && (
          <motion.span
            layoutId="active-channel-bg"
            className="absolute inset-0 -z-10 rounded-lg"
            style={{ background: 'rgb(var(--c-accent) / 0.18)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          />
        )}
        <Avatar user={dmUser} size={34} />
        <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
          <span
            className="truncate font-semibold"
            style={{ color: active ? 'rgb(var(--c-text))' : 'rgb(var(--c-subtext))' }}
          >
            {channel.name}
          </span>
          {channel.subtitle && (
            <span className="truncate text-[0.7rem] text-muted">
              {channel.subtitle}
            </span>
          )}
        </div>
      </motion.button>
    )
  }

  return (
    <motion.button
      whileHover={hoverLift}
      transition={hoverSpring}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="no-drag group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
      style={{
        color: active ? 'rgb(var(--c-text))' : 'rgb(var(--c-subtext))',
      }}
    >
      {active && (
        <motion.span
          layoutId="active-channel-bg"
          className="absolute inset-0 -z-10 rounded-lg"
          style={{ background: 'rgb(var(--c-accent) / 0.18)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        />
      )}
      <span className="text-muted group-hover:text-subtext">
        {isVoice ? (
          <IconVolume width={16} height={16} />
        ) : (
          <IconHash width={16} height={16} />
        )}
      </span>
      <span className="truncate font-medium">{channel.name}</span>
      {channel.unread ? (
        <span
          className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.6rem] font-bold text-white"
          style={{ background: 'rgb(var(--c-accent))' }}
        >
          {channel.unread}
        </span>
      ) : null}
    </motion.button>
  )
}

function StripButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-subtext transition hover:bg-surface1 hover:text-text"
    >
      {children}
    </button>
  )
}
