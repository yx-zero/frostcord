import { motion } from 'framer-motion'
import { Server } from '../types'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/appStore'
import { IconPlus, IconSettings } from './icons'
import { colorFromString } from '../utils/format'

const DM_SERVER_ID = '@me'

export function ServerRail({ onOpenSettings }: { onOpenSettings: () => void }) {
  const servers = useChatStore((s) => s.servers)
  const activeServerId = useChatStore((s) => s.activeServerId)
  const setActiveServer = useChatStore((s) => s.setActiveServer)
  const live = useChatStore((s) => s.live)
  const openContextMenu = useAppStore((s) => s.openContextMenu)

  const serverMenu = (server: Server, e: React.MouseEvent) => {
    e.preventDefault()
    const copy = (t: string) => navigator.clipboard?.writeText(t)
    openContextMenu(e.clientX, e.clientY, [
      { label: 'Invite to Server', disabled: true, onClick: () => {} },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Mute Server', submenu: true, disabled: true, onClick: () => {} },
      { label: 'Notification Settings', submenu: true, disabled: true, onClick: () => {} },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Server Settings', submenu: true, disabled: true, onClick: () => {} },
      { label: 'Privacy Settings', disabled: true, onClick: () => {} },
      { label: 'Edit Per-server Profile', disabled: true, onClick: () => {} },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Create Channel', disabled: true, onClick: () => {} },
      { label: 'Create Category', disabled: true, onClick: () => {} },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Leave Server', danger: true, disabled: true, onClick: () => {} },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Copy Server ID', badge: 'ID', onClick: () => copy(server.id) },
    ])
  }

  // In live mode, surface a dedicated DM button at the top (like the real app).
  const dmActive = activeServerId === DM_SERVER_ID

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center py-3">
      {/* DM / Home button (pinned top) */}
      {live && (
        <div className="relative mb-1 flex w-full items-center justify-center">
          {dmActive && (
            <motion.span
              layoutId="active-server-pill"
              className="absolute left-0 w-1 rounded-r-full"
              style={{ height: 28, background: 'rgb(var(--c-accent))' }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            />
          )}
          <button
            onClick={() => setActiveServer(DM_SERVER_ID)}
            title="Direct Messages"
            className="no-drag flex h-12 w-12 items-center justify-center transition-all duration-200"
            style={{
              borderRadius: dmActive ? 16 : 24,
              background: dmActive ? 'rgb(var(--c-accent))' : 'rgb(var(--c-surface0) / 0.7)',
              color: dmActive ? 'rgb(var(--c-bubble-mine-text))' : 'rgb(var(--c-text))',
            }}
          >
            {/* Discord-ish home glyph */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.3 4.3a17 17 0 0 0-4.2-1.3l-.2.4a14 14 0 0 1 3.7 1.2 13 13 0 0 0-11.4 0A14 14 0 0 1 12 3.4l-.2-.4A17 17 0 0 0 3.6 4.3 17.5 17.5 0 0 0 .7 16.1a16 16 0 0 0 5 2.5l.4-.7a11 11 0 0 1-1.7-.8l.4-.3a12 12 0 0 0 10.4 0l.4.3a11 11 0 0 1-1.7.8l.4.7a16 16 0 0 0 5-2.5 17.5 17.5 0 0 0-3-11.8ZM8.3 13.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Divider */}
      {live && (
        <div
          className="mb-2 h-0.5 w-8 rounded-full"
          style={{ background: 'rgb(var(--c-overlay) / 0.5)' }}
        />
      )}

      {/* Scrollable server list */}
      <div className="scroll-none flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto overflow-x-hidden py-0.5">
        {servers
          .filter((s) => s.id !== DM_SERVER_ID)
          .map((server) => (
            <ServerIcon
              key={server.id}
              server={server}
              active={server.id === activeServerId}
              onClick={() => setActiveServer(server.id)}
              onContextMenu={(e) => serverMenu(server, e)}
            />
          ))}

        <button
          title="Add a server"
          className="no-drag flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-success transition hover:rounded-xl"
          style={{ background: 'rgb(var(--c-surface0) / 0.6)' }}
        >
          <IconPlus width={22} height={22} />
        </button>
      </div>

      {/* Settings (pinned bottom) */}
      <button
        onClick={onOpenSettings}
        title="Settings"
        className="no-drag mt-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-subtext transition hover:rounded-xl hover:text-text"
        style={{ background: 'rgb(var(--c-surface0) / 0.6)' }}
      >
        <IconSettings width={22} height={22} />
      </button>
    </div>
  )
}

function ServerIcon({
  server,
  active,
  onClick,
  onContextMenu,
}: {
  server: Server
  active: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  return (
    <div className="relative flex w-full items-center justify-center">
      {/* Morphing active/unread pill (Telegram-ish) */}
      {(active || server.unread) && (
        <motion.span
          layoutId={active ? 'active-server-pill' : undefined}
          className="absolute left-0 w-1 rounded-r-full"
          style={{
            height: active ? 28 : 8,
            background: 'rgb(var(--c-accent))',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      )}

      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        title={server.name}
        className="no-drag group relative flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          borderRadius: active ? 16 : 24,
          background: server.iconUrl
            ? undefined
            : (server.color ?? colorFromString(server.id)),
        }}
      >
        {server.iconUrl ? (
          <img src={server.iconUrl} alt={server.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-white">{server.acronym}</span>
        )}

        {/* mention badge */}
        {server.mentionCount ? (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.65rem] font-bold text-white"
            style={{ background: 'rgb(var(--c-danger))', border: '2px solid rgb(var(--c-crust))' }}
          >
            {server.mentionCount}
          </span>
        ) : null}
      </button>
    </div>
  )
}
