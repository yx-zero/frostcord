import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Message, User } from '../types'
import { MessageBubble } from './MessageBubble'
import { SystemMessage, isSystemMessage } from './SystemMessage'
import { DayDivider } from './DayDivider'
import { TypingIndicator } from './TypingIndicator'
import { dayKey, formatDayLabel, shouldGroup } from '../utils/format'
import { useChatStore } from '../store/chatStore'
import { IconChevron } from './icons'

interface Props {
  messages: Message[]
  typing: User[]
}

export function MessageList({ messages, typing }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showJump, setShowJump] = useState(false)
  const lastCount = useRef(messages.length)
  const pendingAnchor = useRef<number | null>(null)
  const prevOldestId = useRef<string | undefined>(messages[0]?.id)
  const loadMoreHistory = useChatStore((s) => s.loadMoreHistory)
  const loadingMore = useChatStore((s) => s.loadingMore)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const isNearBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    })
  }

  // Jump to (and briefly highlight) a message by id, if it's loaded.
  const jumpTo = (id: string) => {
    const el = scrollRef.current?.querySelector(`[data-msg-id="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(id)
      setTimeout(() => setHighlightId(null), 1600)
    }
  }

  // On new messages, auto-scroll only if user is already near the bottom.
  useEffect(() => {
    const grew = messages.length > lastCount.current
    const prevCount = lastCount.current
    lastCount.current = messages.length
    const newest = messages[messages.length - 1]
    const mineJustSent = grew && newest?.mine
    // Only treat small growth at the BOTTOM as an append. Large growth or a new
    // oldest message means a history prepend (handled by the layout effect).
    const oldestId = messages[0]?.id
    const isPrepend = grew && oldestId !== prevOldestId.current
    const appended = grew && !isPrepend && messages.length - prevCount <= 2
    if (appended && (mineJustSent || isNearBottom())) {
      requestAnimationFrame(() => scrollToBottom(true))
    }
    prevOldestId.current = oldestId
  }, [messages.length])

  // Preserve scroll position when older messages are prepended (pagination).
  // Captured before the DOM grows; restored synchronously after, in a layout
  // effect, so the viewport doesn't jump to the top.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || pendingAnchor.current == null) return
    const delta = el.scrollHeight - pendingAnchor.current
    el.scrollTop += delta
    pendingAnchor.current = null
  }, [messages.length])

  // Initial scroll on channel change.
  useEffect(() => {
    scrollToBottom(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages[0]?.channelId])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setShowJump(!isNearBottom())
    // Near the top -> load older history. Capture the current scroll height so
    // the layout effect can restore position once the messages prepend.
    if (el.scrollTop < 120 && !loadingMore) {
      pendingAnchor.current = el.scrollHeight
      loadMoreHistory()
    }
  }

  // Build render items with grouping + day dividers.
  const items: JSX.Element[] = []
  let lastDay = ''
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1]
    const next = messages[i + 1]

    const dk = dayKey(msg.timestamp)
    if (dk !== lastDay) {
      lastDay = dk
      items.push(<DayDivider key={`day_${dk}`} label={formatDayLabel(msg.timestamp)} />)
    }

    if (isSystemMessage(msg)) {
      items.push(<SystemMessage key={msg.id} message={msg} />)
      continue
    }

    const groupStart =
      !prev ||
      prev.author.id !== msg.author.id ||
      dayKey(prev.timestamp) !== dk ||
      !shouldGroup(prev.timestamp, msg.timestamp) ||
      // A slash-command reply always starts its own group so the
      // "X used /command" header + avatar are shown.
      !!msg.interaction
    const groupEnd =
      !next ||
      next.author.id !== msg.author.id ||
      dayKey(next.timestamp) !== dk ||
      !shouldGroup(msg.timestamp, next.timestamp) ||
      !!next.interaction

    items.push(
      <MessageBubble
        key={msg.id}
        message={msg}
        groupStart={groupStart}
        groupEnd={groupEnd}
        highlighted={highlightId === msg.id}
        onJumpTo={jumpTo}
      />,
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-thin h-full overflow-y-auto overflow-x-hidden pb-2 pt-2"
      >
        {items}
        <TypingIndicator users={typing} />
        <div ref={bottomRef} />
      </div>

      {/* Jump to bottom pill */}
      <AnimatePresence>
        {showJump && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={() => scrollToBottom(true)}
            // Force absolute: the `.glass` rule (loaded after Tailwind utilities)
            // sets position:relative, which would otherwise override `absolute`.
            style={{ position: 'absolute' }}
            className="glass glass-sheen no-drag bottom-4 right-6 flex h-10 w-10 items-center justify-center rounded-full text-text"
            title="Jump to latest"
          >
            <IconChevron width={20} height={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
