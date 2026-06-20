import { MessageStatus } from '../types'

interface Props {
  status: MessageStatus
  /** color tuned for the bubble it sits in */
  tone?: 'onAccent' | 'onSurface'
  onRetry?: () => void
}

/**
 * Telegram-style send-state indicator:
 *  - sending   -> a spinning ring (message is in flight; e.g. wifi blip)
 *  - sent      -> single check (server received it)
 *  - delivered -> double check (confirmed in channel)
 *  - failed    -> red alert, click to retry
 */
export function MessageStatusIndicator({ status, tone = 'onAccent', onRetry }: Props) {
  const color =
    tone === 'onAccent'
      ? 'rgb(var(--c-bubble-mine-text) / 0.75)'
      : 'rgb(var(--c-subtext))'

  if (status === 'sending') {
    return (
      <span
        aria-label="Sending"
        title="Sending…"
        className="inline-block"
        style={{ width: 13, height: 13 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          {/* faint full ring */}
          <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.35" strokeWidth="2.5" />
          {/* spinning arc */}
          <path
            d="M12 3a9 9 0 0 1 9 9"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </span>
    )
  }

  if (status === 'sent') {
    return (
      <span aria-label="Sent" title="Sent" className="inline-flex">
        <svg width="14" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    )
  }

  if (status === 'delivered') {
    return (
      <span aria-label="Delivered" title="Delivered" className="inline-flex">
        <svg width="18" height="13" viewBox="0 0 28 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 6 7 17 3 13" />
          <polyline points="24 6 15 17 14.4 16.4" />
        </svg>
      </span>
    )
  }

  // failed
  return (
    <button
      onClick={onRetry}
      aria-label="Failed to send. Click to retry."
      title="Failed — click to retry"
      className="inline-flex no-drag"
      style={{ color: 'rgb(var(--c-danger))' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </button>
  )
}
