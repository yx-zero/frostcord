import { useEffect, useState } from 'react'
import { Glass } from './Glass'
import { Avatar } from './Avatar'
import { api } from '../services/discord'
import { User } from '../types'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/appStore'

interface Friend {
  id: string
  type: number // 1=friend, 3=incoming, 4=outgoing, 2=blocked
  user: User
}

type Tab = 'all' | 'online' | 'pending' | 'blocked'

export function FriendsView() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(true)
  const presence = useChatStore((s) => s.presence)
  const openProfile = useAppStore((s) => s.openProfile)

  const load = () => {
    setLoading(true)
    api
      .getFriends()
      .then((f) => setFriends(f))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = friends.filter((f) => {
    if (tab === 'all') return f.type === 1
    if (tab === 'online')
      return f.type === 1 && presence[f.user.id] && presence[f.user.id] !== 'offline'
    if (tab === 'pending') return f.type === 3 || f.type === 4
    if (tab === 'blocked') return f.type === 2
    return false
  })

  const accept = async (id: string) => {
    await api.acceptFriend(id).catch(() => {})
    load()
  }
  const remove = async (id: string) => {
    await api.removeFriend(id).catch(() => {})
    load()
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'online', label: 'Online' },
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'blocked', label: 'Blocked' },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="z-10 px-3 pt-3">
        <Glass refract className="drag-region flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="font-bold text-text">Friends</span>
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="no-drag rounded-lg px-3 py-1 text-sm font-semibold transition"
                style={{
                  background: tab === t.id ? 'rgb(var(--c-accent) / 0.25)' : 'transparent',
                  color: tab === t.id ? 'rgb(var(--c-text))' : 'rgb(var(--c-muted))',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Glass>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
        {loading && <div className="py-8 text-center text-sm text-muted">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">
            Nothing here yet.
          </div>
        )}
        {filtered.map((f) => (
          <div
            key={f.id}
            className="group flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-surface1/40"
          >
            <button
              onClick={(e) => openProfile(f.user, e.clientX, e.clientY)}
              className="no-drag flex flex-1 items-center gap-3 text-left"
            >
              <Avatar user={f.user} size={36} showStatus />
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-bold text-text">
                  {f.user.displayName}
                </span>
                <span className="truncate text-xs text-muted">
                  {f.type === 3
                    ? 'Incoming friend request'
                    : f.type === 4
                      ? 'Outgoing friend request'
                      : f.type === 2
                        ? 'Blocked'
                        : '@' + f.user.username}
                </span>
              </div>
            </button>
            <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
              {f.type === 3 && (
                <button
                  onClick={() => accept(f.user.id)}
                  className="no-drag rounded-lg px-3 py-1 text-xs font-bold"
                  style={{
                    background: 'rgb(var(--c-success))',
                    color: 'rgb(var(--c-crust))',
                  }}
                >
                  Accept
                </button>
              )}
              <button
                onClick={() => remove(f.user.id)}
                className="no-drag rounded-lg px-3 py-1 text-xs font-bold"
                style={{
                  background: 'rgb(var(--c-surface2))',
                  color: 'rgb(var(--c-danger))',
                }}
              >
                {f.type === 2 ? 'Unblock' : f.type === 1 ? 'Remove' : 'Cancel'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
