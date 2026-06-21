import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Server, ServerFolder } from '../types'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/appStore'
import { IconPlus, IconSettings, IconFolder } from './icons'
import { colorFromString } from '../utils/format'

const DM_SERVER_ID = '@me'

export function ServerRail({ onOpenSettings }: { onOpenSettings: () => void }) {
  const servers = useChatStore((s) => s.servers)
  const serverFolders = useChatStore((s) => s.serverFolders)
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

  // Build the rail render list, grouping guilds into their folders. Guilds not
  // referenced by any folder (or before folders load) render standalone.
  type RailItem =
    | { kind: 'folder'; folder: ServerFolder; guilds: Server[] }
    | { kind: 'guild'; guild: Server }
  const guildServers = servers.filter((s) => s.id !== DM_SERVER_ID)
  const byId = new Map(guildServers.map((s) => [s.id, s]))
  const covered = new Set<string>()
  const railItems: RailItem[] = []
  for (const folder of serverFolders) {
    const guilds = folder.guildIds
      .map((id) => byId.get(id))
      .filter((g): g is Server => !!g)
    if (guilds.length === 0) continue
    guilds.forEach((g) => covered.add(g.id))
    if (folder.id) railItems.push({ kind: 'folder', folder, guilds })
    else railItems.push({ kind: 'guild', guild: guilds[0] })
  }
  for (const s of guildServers) {
    if (!covered.has(s.id)) railItems.push({ kind: 'guild', guild: s })
  }

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
            {/* Discord logo glyph */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
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
        {railItems.map((item) =>
          item.kind === 'folder' ? (
            <ServerFolderGroup
              key={`folder-${item.folder.id}`}
              folder={item.folder}
              guilds={item.guilds}
              activeServerId={activeServerId}
              onSelect={setActiveServer}
              onMenu={serverMenu}
            />
          ) : (
            <ServerIcon
              key={item.guild.id}
              server={item.guild}
              active={item.guild.id === activeServerId}
              onClick={() => setActiveServer(item.guild.id)}
              onContextMenu={(e) => serverMenu(item.guild, e)}
            />
          ),
        )}

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

// A collapsible folder of servers. Collapsed: a tinted tile with a 2x2 grid of
// member icons. Expanded: a tinted column holding the full-size server icons.
function ServerFolderGroup({
  folder,
  guilds,
  activeServerId,
  onSelect,
  onMenu,
}: {
  folder: ServerFolder
  guilds: Server[]
  activeServerId: string
  onSelect: (id: string) => void
  onMenu: (server: Server, e: React.MouseEvent) => void
}) {
  const hasActive = guilds.some((g) => g.id === activeServerId)
  const [open, setOpen] = useState(hasActive)
  const tint = folder.color ? `${folder.color}33` : 'rgb(var(--c-accent) / 0.22)'
  const glyph = folder.color ?? 'rgb(var(--c-accent))'

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative flex w-full items-center justify-center">
        {!open && hasActive && (
          <motion.span
            layoutId="active-server-pill"
            className="absolute left-0 w-1 rounded-r-full"
            style={{ height: 28, background: 'rgb(var(--c-accent))' }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          />
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          title={folder.name || 'Folder'}
          className="no-drag flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl transition-all duration-200 hover:rounded-xl"
          style={{ background: tint }}
        >
          {open ? (
            <IconFolder width={24} height={24} style={{ color: glyph }} />
          ) : (
            <div className="grid grid-cols-2 gap-0.5 p-1.5">
              {guilds.slice(0, 4).map((g) => (
                <MiniGuild key={g.id} server={g} />
              ))}
            </div>
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-14 flex-col items-center gap-2 overflow-hidden rounded-2xl py-2"
            style={{
              background: folder.color
                ? `${folder.color}1f`
                : 'rgb(var(--c-surface0) / 0.5)',
            }}
          >
            {guilds.map((g) => (
              <ServerIcon
                key={g.id}
                server={g}
                active={g.id === activeServerId}
                onClick={() => onSelect(g.id)}
                onContextMenu={(e) => onMenu(g, e)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// A 16px guild icon used inside the collapsed folder grid.
function MiniGuild({ server }: { server: Server }) {
  if (server.iconUrl) {
    return (
      <img
        src={server.iconUrl}
        alt=""
        draggable={false}
        className="h-4 w-4 rounded-[4px] object-cover"
      />
    )
  }
  return (
    <span
      className="flex h-4 w-4 items-center justify-center rounded-[4px] text-[0.5rem] font-bold text-white"
      style={{ background: server.color ?? colorFromString(server.id) }}
    >
      {server.acronym?.charAt(0) ?? '?'}
    </span>
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
