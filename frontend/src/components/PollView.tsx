import { Poll } from '../types'

// Renders a Discord poll: question, answer bars with vote %, click to vote.
export function PollView({
  poll,
  onVote,
}: {
  poll: Poll
  onVote: (optionId: number) => void
}) {
  const total = poll.totalVotes || 0
  return (
    <div
      className="my-1 w-[320px] max-w-full rounded-xl p-3"
      style={{ background: 'rgb(var(--c-crust) / 0.5)' }}
    >
      <div className="mb-2 font-bold text-text">{poll.question}</div>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((o) => {
          const pct = total > 0 ? Math.round((o.count / total) * 100) : 0
          return (
            <button
              key={o.id}
              onClick={() => !poll.finalized && onVote(o.id)}
              disabled={poll.finalized}
              className="no-drag relative w-full overflow-hidden rounded-lg px-3 py-2 text-left text-sm transition"
              style={{
                background: 'rgb(var(--c-surface0) / 0.8)',
                border: o.me
                  ? '1px solid rgb(var(--c-accent))'
                  : '1px solid transparent',
              }}
            >
              {/* fill bar */}
              <div
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: `${pct}%`,
                  background: o.me
                    ? 'rgb(var(--c-accent) / 0.35)'
                    : 'rgb(var(--c-accent) / 0.18)',
                }}
              />
              <div className="relative flex items-center justify-between">
                <span className="font-medium text-text">
                  {o.me && '✓ '}
                  {o.text}
                </span>
                <span className="text-xs text-subtext">
                  {o.count} · {pct}%
                </span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-xs text-muted">
        {total} vote{total === 1 ? '' : 's'}
        {poll.finalized && ' · final results'}
      </div>
    </div>
  )
}
