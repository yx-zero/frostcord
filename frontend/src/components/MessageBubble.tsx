import { motion } from 'framer-motion'
import { Message } from '../types'
import { Avatar } from './Avatar'
import { Markdown } from './Markdown'
import { AttachmentView } from './AttachmentView'
import { EmbedView } from './EmbedView'
import { PollView } from './PollView'
import { MessageStatusIndicator } from './MessageStatusIndicator'
import { formatTime } from '../utils/format'
import { twemojiURL } from '../utils/emoji'
import { onExternalClick } from '../utils/links'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/appStore'
import { IconReply } from './icons'

interface Props {
  message: Message
  /** first in a consecutive group from this author */
  groupStart: boolean
  /** last in a group — controls the bubble tail + meta row */
  groupEnd: boolean
  highlighted?: boolean
  onJumpTo?: (id: string) => void
}

export function MessageBubble({ message, groupStart, groupEnd, highlighted, onJumpTo }: Props) {
  const toggleReaction = useChatStore((s) => s.toggleReaction)
  const retryMessage = useChatStore((s) => s.retryMessage)
  const setReplyTarget = useChatStore((s) => s.setReplyTarget)
  const setEditTarget = useChatStore((s) => s.setEditTarget)
  const votePoll = useChatStore((s) => s.votePoll)
  const openContextMenu = useAppStore((s) => s.openContextMenu)
  const openProfile = useAppStore((s) => s.openProfile)
  const openLightbox = useAppStore((s) => s.openLightbox)
  const mine = message.mine

  // Quick-reaction emoji shown as a row at the top of the message menu.
  const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥']

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const copy = (t: string) => navigator.clipboard?.writeText(t)
    const guildId = useChatStore.getState().activeServerId
    const link =
      guildId && guildId !== '@me'
        ? `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`
        : `https://discord.com/channels/@me/${message.channelId}/${message.id}`
    openContextMenu(e.clientX, e.clientY, [
      {
        label: '',
        quickReactions: QUICK.map((emoji) => ({
          emoji,
          onClick: () => toggleReaction(message.id, emoji),
        })),
        onClick: () => {},
      },
      { label: 'Add Reaction 👍', onClick: () => toggleReaction(message.id, '👍') },
      ...(mine
        ? [{ label: 'Edit Message', onClick: () => setEditTarget(message) }]
        : []),
      { label: 'Reply', onClick: () => setReplyTarget(message) },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Copy Text', onClick: () => copy(message.content) },
      { label: 'Copy Message Link', onClick: () => copy(link) },
      { label: 'Copy Message ID', onClick: () => copy(message.id) },
      ...(mine
        ? [
            { divider: true, label: '', onClick: () => {} },
            {
              label: 'Delete Message',
              danger: true,
              onClick: () => useChatStore.getState().deleteMessage(message.id),
            },
          ]
        : []),
    ])
  }

  const hasText = !!message.content

  // A lone media URL (gif/image/tenor/giphy) — render it inline as an image,
  // matching how Discord auto-embeds bare links. (Discord's own embed arrives
  // async via MESSAGE_UPDATE; this shows it immediately.)
  const loneMediaUrl = (() => {
    const c = message.content.trim()
    if (!c || /\s/.test(c) || !/^https?:\/\//.test(c)) return null
    const lower = c.toLowerCase()
    const isImageExt = /\.(gif|gifv|png|jpe?g|webp|apng)(\?|$)/.test(lower)
    const isGifHost = /(tenor\.com|giphy\.com|media\.discordapp\.net|cdn\.discordapp\.com)/.test(
      lower,
    )
    // Only treat as media if the message has no embed/attachment already
    // (avoid double-rendering once Discord's embed arrives).
    if (
      (isImageExt || isGifHost) &&
      message.embeds.length === 0 &&
      message.attachments.length === 0
    ) {
      // tenor.com/view/... pages aren't direct media; let the embed handle those.
      if (/tenor\.com\/view\//.test(lower)) return null
      return c
    }
    return null
  })()

  // When a message is media/embed-only, don't wrap it in a colored bubble box —
  // render the media on a transparent surface (Discord-style).
  const mediaOnly =
    (!hasText && (message.attachments.length > 0 || message.embeds.length > 0)) ||
    !!loneMediaUrl

  const bubbleBg = mediaOnly
    ? 'transparent'
    : mine
      ? 'rgb(var(--c-bubble-mine))'
      : 'rgb(var(--c-bubble-theirs))'
  const bubbleText = mine
    ? 'rgb(var(--c-bubble-mine-text))'
    : 'rgb(var(--c-bubble-theirs-text))'

  // Don't render anything for truly empty messages (e.g. some system events).
  if (!hasText && message.attachments.length === 0 && message.embeds.length === 0) {
    return null
  }

  // Telegram-style tail: sharpen the bottom corner on the side of the sender,
  // only on the last bubble of a group.
  const tailRadius = mine
    ? groupEnd
      ? '18px 18px 4px 18px'
      : '18px 18px 6px 18px'
    : groupEnd
      ? '18px 18px 18px 4px'
      : '18px 18px 18px 6px'

  return (
    <motion.div
      layout="position"
      data-msg-id={message.id}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`group flex w-full gap-2 px-3 transition-colors ${
        mine ? 'flex-row-reverse' : 'flex-row'
      } ${groupStart ? 'mt-3' : 'mt-0.5'} ${
        highlighted ? 'rounded-lg bg-accent/10' : ''
      }`}
    >
      {/* Avatar gutter (left for others, hidden for mine). Reserve space so
          grouped messages align even when avatar is hidden. */}
      {!mine && (
        <div className="w-9 shrink-0 self-end">
          {groupEnd && (
            <button
              className="no-drag"
              onClick={(e) => openProfile(message.author, e.clientX, e.clientY)}
              title={message.author.displayName}
            >
              <Avatar user={message.author} size={36} />
            </button>
          )}
        </div>
      )}

      <div
        className={`flex max-w-[min(560px,72%)] flex-col ${
          mine ? 'items-end' : 'items-start'
        }`}
      >
        {/* "X used /command" header on a bot's slash-command reply */}
        {message.interaction && (
          <div
            className={`mb-0.5 ml-1 flex items-center gap-1 text-[0.7rem] ${
              mine ? 'flex-row-reverse' : ''
            }`}
            style={{ color: 'rgb(var(--c-subtext))' }}
          >
            <span>{message.interaction.userName} used</span>
            <span
              className="rounded px-1 font-semibold"
              style={{
                background: 'rgb(var(--c-accent) / 0.15)',
                color: 'rgb(var(--c-accent2))',
              }}
            >
              /{message.interaction.name}
            </span>
          </div>
        )}

        {/* Author name for others, only at group start */}
        {!mine && groupStart && (
          <button
            className="no-drag mb-0.5 ml-1 text-xs font-bold hover:underline"
            style={{ color: message.author.color ?? 'rgb(var(--c-accent2))' }}
            onClick={(e) => openProfile(message.author, e.clientX, e.clientY)}
          >
            {message.author.displayName}
          </button>
        )}

        <div
          className={mediaOnly ? 'relative' : 'relative shadow-sm'}
          onContextMenu={onContextMenu}
          style={{
            background: bubbleBg,
            color: bubbleText,
            borderRadius: mediaOnly ? 0 : tailRadius,
          }}
        >
          {/* Reply preview — click to jump to the referenced message */}
          {message.replyTo && (
            <button
              onClick={() => message.replyTo && onJumpTo?.(message.replyTo.id)}
              className="no-drag mx-2 mt-2 flex items-center gap-1 rounded-md border-l-2 px-2 py-1 text-xs transition hover:brightness-125"
              style={{
                borderColor: 'rgb(var(--c-accent) / 0.8)',
                background: 'rgb(0 0 0 / 0.12)',
              }}
            >
              <IconReply width={12} height={12} className="opacity-70" />
              <span className="font-semibold opacity-90">
                {message.replyTo.authorName}
              </span>
              <span className="truncate opacity-70">{message.replyTo.preview}</span>
            </button>
          )}

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className="flex flex-col gap-1 p-1.5">
              {message.attachments.map((a) => (
                <AttachmentView key={a.id} attachment={a} />
              ))}
            </div>
          )}

          {/* Lone media URL -> inline image (Discord-style auto-embed) */}
          {loneMediaUrl && (
            <div className="p-1.5">
              <img
                src={loneMediaUrl}
                alt="gif"
                className="max-h-80 max-w-full cursor-pointer rounded-lg object-contain transition hover:brightness-95"
                loading="lazy"
                onClick={() => openLightbox(loneMediaUrl)}
              />
            </div>
          )}

          {/* Text content + inline meta */}
          {message.content && !loneMediaUrl && (
            <div className="selectable px-3 py-1.5 text-[0.95rem] leading-snug">
              <span className="whitespace-pre-wrap break-words">
                <Markdown content={message.content} onAccent={mine} />
              </span>
              {/* meta floated to end of last line, Telegram-style */}
              <span
                className="float-right ml-2 mt-1 inline-flex translate-y-0.5 items-center gap-1 text-[0.65rem]"
                style={{
                  color: mine
                    ? 'rgb(var(--c-bubble-mine-text) / 0.7)'
                    : 'rgb(var(--c-subtext))',
                }}
              >
                {message.editedTimestamp && <span className="italic">edited</span>}
                {formatTime(message.timestamp)}
                {mine && (
                  <MessageStatusIndicator
                    status={message.status}
                    tone="onAccent"
                    onRetry={() => retryMessage(message.id)}
                  />
                )}
              </span>
            </div>
          )}
          {/* Rich embeds */}
          {message.embeds.length > 0 && (
            <div className={hasText ? 'px-1.5 pb-1.5' : ''}>
              {message.embeds.map((e, i) => (
                <EmbedView key={i} embed={e} />
              ))}
            </div>
          )}

          {/* Media-only meta row (time/status) since there's no text line.
              Suppressed when bot buttons exist — the meta then renders after the
              buttons (below) so it doesn't sit between the embed and buttons. */}
          {mediaOnly && !(message.buttons && message.buttons.length > 0) && (
            <div
              className={`flex items-center gap-1 px-1 pt-0.5 text-[0.65rem] ${
                mine ? 'justify-end' : ''
              }`}
              style={{ color: 'rgb(var(--c-subtext))' }}
            >
              {formatTime(message.timestamp)}
              {mine && (
                <MessageStatusIndicator
                  status={message.status}
                  tone="onSurface"
                  onRetry={() => retryMessage(message.id)}
                />
              )}
            </div>
          )}
        </div>

        {/* Poll */}
        {message.poll && (
          <PollView
            poll={message.poll}
            onVote={(optId) => votePoll(message.id, optId)}
          />
        )}

        {/* Bot buttons */}
        {message.buttons && message.buttons.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1.5 ${mine ? 'justify-end' : ''}`}>
            {message.buttons.map((b, i) => {
              const styleColors: Record<number, string> = {
                1: 'rgb(88 101 242)', // primary/blurple
                2: 'rgb(var(--c-surface2))', // secondary
                3: 'rgb(59 165 93)', // success/green
                4: 'rgb(237 66 69)', // danger/red
                5: 'rgb(var(--c-surface2))', // link
              }
              const inner = (
                <>
                  {b.emojiUrl ? (
                    <img src={b.emojiUrl} alt="" className="h-4 w-4" />
                  ) : (
                    b.emoji && <span>{b.emoji}</span>
                  )}
                  {b.label && <span>{b.label}</span>}
                </>
              )
              const cls =
                'no-drag flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50'
              const style = { background: styleColors[b.style] ?? styleColors[2] }
              return b.style === 5 && b.url ? (
                <a key={i} href={b.url} onClick={onExternalClick(b.url)} className={cls} style={style}>
                  {inner}
                </a>
              ) : (
                <button key={i} disabled={b.disabled} className={cls} style={style}>
                  {inner}
                </button>
              )
            })}
          </div>
        )}

        {/* Media-only meta row, placed after bot buttons so the time/status sits
            below the buttons (matching the official client) rather than between
            the embed and the buttons. */}
        {mediaOnly && message.buttons && message.buttons.length > 0 && (
          <div
            className={`mt-1 flex items-center gap-1 px-1 text-[0.65rem] ${
              mine ? 'justify-end' : ''
            }`}
            style={{ color: 'rgb(var(--c-subtext))' }}
          >
            {formatTime(message.timestamp)}
            {mine && (
              <MessageStatusIndicator
                status={message.status}
                tone="onSurface"
                onRetry={() => retryMessage(message.id)}
              />
            )}
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
            {message.reactions.map((rx) => (
              <button
                key={rx.emoji}
                onClick={() => toggleReaction(message.id, rx.emoji)}
                className="no-drag flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition"
                style={{
                  background: rx.me
                    ? 'rgb(var(--c-accent) / 0.25)'
                    : 'rgb(var(--c-surface0) / 0.7)',
                  border: rx.me
                    ? '1px solid rgb(var(--c-accent) / 0.6)'
                    : '1px solid transparent',
                }}
              >
                {rx.emojiUrl ? (
                  <img src={rx.emojiUrl} alt={rx.emoji} className="h-4 w-4" />
                ) : (
                  <img
                    src={twemojiURL(rx.emoji)}
                    alt={rx.emoji}
                    className="h-4 w-4"
                    onError={(e) => {
                      // fall back to raw text if not a unicode emoji
                      ;(e.currentTarget as HTMLImageElement).replaceWith(
                        document.createTextNode(rx.emoji),
                      )
                    }}
                  />
                )}
                <span className="font-semibold text-subtext">{rx.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
