import { User } from '../types'
import { Avatar } from './Avatar'

export function TypingIndicator({ users }: { users: User[] }) {
  if (users.length === 0) return null
  const label =
    users.length === 1
      ? `${users[0].displayName} is typing`
      : users.length === 2
        ? `${users[0].displayName} and ${users[1].displayName} are typing`
        : `${users.length} people are typing`

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="w-9 shrink-0">
        <Avatar user={users[0]} size={28} />
      </div>
      <div
        className="flex items-center gap-1 rounded-bubble px-3 py-2"
        style={{ background: 'rgb(var(--c-bubble-theirs))' }}
      >
        <Dot delay={0} />
        <Dot delay={0.15} />
        <Dot delay={0.3} />
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full animate-dot-pulse"
      style={{
        background: 'rgb(var(--c-subtext))',
        animationDelay: `${delay}s`,
      }}
    />
  )
}
