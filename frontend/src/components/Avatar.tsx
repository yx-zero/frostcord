import { User } from '../types'
import { initials, colorFromString } from '../utils/format'
import { useChatStore } from '../store/chatStore'

interface AvatarProps {
  user: User
  size?: number
  showStatus?: boolean
}

const statusColor: Record<NonNullable<User['status']>, string> = {
  online: 'rgb(var(--c-success))',
  idle: 'rgb(var(--c-warning))',
  dnd: 'rgb(var(--c-danger))',
  offline: 'rgb(var(--c-muted))',
}

export function Avatar({ user, size = 40, showStatus = false }: AvatarProps) {
  const bg = user.color ?? colorFromString(user.id)
  const dot = size * 0.32
  // Prefer live presence from the gateway; fall back to the user's own status.
  const livePresence = useChatStore((s) => s.presence[user.id]) as
    | User['status']
    | undefined
  const status = livePresence ?? user.status

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full font-bold text-white select-none"
          style={{
            width: size,
            height: size,
            background: bg,
            fontSize: size * 0.4,
          }}
        >
          {initials(user.displayName)}
        </div>
      )}
      {showStatus && status && (
        <span
          className="absolute rounded-full border-2 border-mantle"
          style={{
            width: dot,
            height: dot,
            right: -1,
            bottom: -1,
            background: statusColor[status],
          }}
        />
      )}
    </div>
  )
}
