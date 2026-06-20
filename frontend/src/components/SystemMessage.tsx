import { Message } from '../types'
import { formatTime } from '../utils/format'

// Renders Discord system messages (joins, boosts, pins, etc.) as a centered,
// subtle line instead of a chat bubble.
const SYSTEM_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

export function isSystemMessage(m: Message): boolean {
  return m.type !== undefined && SYSTEM_TYPES.has(m.type)
}

function systemText(m: Message): string {
  const name = m.author.displayName
  switch (m.type) {
    case 1:
      return `${name} added someone to the group.`
    case 2:
      return `${name} left the group.`
    case 3:
      return `${name} started a call.`
    case 4:
      return `${name} changed the channel name.`
    case 5:
      return `${name} changed the channel icon.`
    case 6:
      return `${name} pinned a message to this channel.`
    case 7:
      return `${name} joined the server.`
    case 8:
    case 9:
    case 10:
    case 11:
      return `${name} just boosted the server!`
    case 12:
      return `${name} followed a channel.`
    default:
      return m.content || 'System message'
  }
}

export function SystemMessage({ message }: { message: Message }) {
  return (
    <div className="my-1 flex items-center justify-center gap-2 px-4">
      <span className="text-xs text-muted">
        <span className="font-semibold text-subtext">{message.author.displayName}</span>
        {' '}
        {systemText(message).replace(message.author.displayName, '').trim()}
      </span>
      <span className="text-[0.65rem] text-muted/70">
        {formatTime(message.timestamp)}
      </span>
    </div>
  )
}
