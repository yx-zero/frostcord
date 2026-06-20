import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Glass } from './Glass'
import { IconSend, IconSmile, IconPaperclip, IconGif, IconReply, IconClose } from './icons'
import { useChatStore } from '../store/chatStore'
import { useComposerBridge } from '../store/composerBridge'
import { previewText } from '../store/mentionStore'
import { Avatar } from './Avatar'
import { PendingFile, readFiles } from '../utils/files'
import { EmojiEntry, replaceShortcodes, searchEmoji, twemojiURL } from '../utils/emoji'

interface Props {
  channelName: string
  onOpenPicker: (tab: 'emoji' | 'gif' | 'sticker') => void
}

interface MentionCandidate {
  id: string
  name: string
  avatarUrl?: string
}

export function Composer({ channelName, onOpenPicker }: Props) {
  const [value, setValue] = useState('')
  const sendMessage = useChatStore((s) => s.sendMessage)
  const sendFiles = useChatStore((s) => s.sendFiles)
  const replyTarget = useChatStore((s) => s.replyTarget)
  const setReplyTarget = useChatStore((s) => s.setReplyTarget)
  const editTarget = useChatStore((s) => s.editTarget)
  const setEditTarget = useChatStore((s) => s.setEditTarget)
  const editMessage = useChatStore((s) => s.editMessage)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const insert = useComposerBridge((s) => s.insert)
  const insertSeq = useComposerBridge((s) => s.insertSeq)
  const consumeInsert = useComposerBridge((s) => s.consume)
  // Mention candidates: prefer the full guild member list (op 14), fall back to
  // this channel's chat participants. Both carry real avatars.
  const channelMessages = useChatStore(
    (s) => s.messagesByChannel[s.activeChannelId],
  )
  const guildMembers = useChatStore((s) => s.membersByGuild[s.activeServerId])
  const dmRecipients = useChatStore((s) => {
    if (s.activeServerId !== '@me') return undefined
    const ch = (s.channelsByServer['@me'] ?? []).find(
      (c) => c.id === s.activeChannelId,
    )
    return ch?.recipients
  })

  // Files staged for upload (from picker or paste).
  const [pending, setPending] = useState<PendingFile[]>([])

  // @-autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  // Tracks @name -> userid for mentions inserted via the picker, so we can
  // convert them to Discord's <@id> syntax on send (otherwise they're plain text).
  const pickedMentions = useRef<Record<string, string>>({})

  // :emoji: autocomplete state
  const [emojiQuery, setEmojiQuery] = useState<string | null>(null)
  const [emojiIndex, setEmojiIndex] = useState(0)
  const emojiCandidates: EmojiEntry[] = useMemo(
    () => (emojiQuery === null ? [] : searchEmoji(emojiQuery, 8)),
    [emojiQuery],
  )

  // Candidate members: full guild list / DM recipients, plus chat participants.
  const participants: MentionCandidate[] = useMemo(() => {
    const map = new Map<string, MentionCandidate>()
    if (guildMembers && guildMembers.length > 0) {
      for (const u of guildMembers) {
        map.set(u.id, { id: u.id, name: u.displayName, avatarUrl: u.avatarUrl })
      }
    }
    for (const u of dmRecipients ?? []) {
      map.set(u.id, { id: u.id, name: u.displayName, avatarUrl: u.avatarUrl })
    }
    // Always include chat participants too (covers recent senders).
    for (const m of channelMessages ?? []) {
      if (m.author && !map.has(m.author.id)) {
        map.set(m.author.id, {
          id: m.author.id,
          name: m.author.displayName,
          avatarUrl: m.author.avatarUrl,
        })
      }
    }
    return Array.from(map.values())
  }, [channelMessages, guildMembers, dmRecipients])

  const candidates: MentionCandidate[] = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    const filtered = q
      ? participants.filter((u) => u.name.toLowerCase().includes(q))
      : participants
    return filtered.slice(0, 8)
  }, [mentionQuery, participants])

  // Append emoji pushed from the picker, then focus the input.
  useEffect(() => {
    if (!insert) return
    setValue((v) => v + insert)
    consumeInsert()
    requestAnimationFrame(() => {
      taRef.current?.focus()
      autoGrow()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertSeq])

  // Focus the input when a reply target is set.
  useEffect(() => {
    if (replyTarget) taRef.current?.focus()
  }, [replyTarget])

  // When editing, load the message content into the input.
  useEffect(() => {
    if (editTarget) {
      setValue(editTarget.content)
      requestAnimationFrame(() => {
        taRef.current?.focus()
        autoGrow()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget])

  const autoGrow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  // Detect an in-progress @mention based on caret position.
  const updateMentionQuery = (text: string, caret: number) => {
    const upto = text.slice(0, caret)
    const m = /(?:^|\s)@(\w*)$/.exec(upto)
    if (m) {
      setMentionQuery(m[1])
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
    // :emoji: autocomplete — trigger after at least 2 chars to avoid noise.
    const em = /(?:^|\s):([a-z0-9_+-]{2,})$/i.exec(upto)
    if (em) {
      setEmojiQuery(em[1])
      setEmojiIndex(0)
    } else {
      setEmojiQuery(null)
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    autoGrow()
    updateMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length)
  }

  // Replace the in-progress :shortcode with the chosen emoji's unicode char.
  const applyEmoji = (entry: EmojiEntry) => {
    const ta = taRef.current
    const caret = ta?.selectionStart ?? value.length
    const upto = value.slice(0, caret)
    const after = value.slice(caret)
    const replaced = upto.replace(/:([a-z0-9_+-]+)$/i, entry.unicode + ' ')
    const next = replaced + after
    setValue(next)
    setEmojiQuery(null)
    requestAnimationFrame(() => {
      ta?.focus()
      const pos = replaced.length
      ta?.setSelectionRange(pos, pos)
      autoGrow()
    })
  }

  const applyMention = (cand: MentionCandidate) => {
    const ta = taRef.current
    const caret = ta?.selectionStart ?? value.length
    const upto = value.slice(0, caret)
    const after = value.slice(caret)
    const replaced = upto.replace(/@(\w*)$/, `@${cand.name} `)
    const next = replaced + after
    setValue(next)
    setMentionQuery(null)
    // Remember name -> id so submit() can emit a real <@id> mention.
    pickedMentions.current[cand.name.toLowerCase()] = cand.id
    requestAnimationFrame(() => {
      ta?.focus()
      const pos = replaced.length
      ta?.setSelectionRange(pos, pos)
      autoGrow()
    })
  }

  // Convert "@DisplayName" tokens into Discord <@id> syntax for any mentions
  // the user inserted via the autocomplete picker.
  const encodeMentions = (text: string): string => {
    let out = text
    for (const [nameLower, id] of Object.entries(pickedMentions.current)) {
      // Match @Name as a whole token (case-insensitive), not inside a word.
      const escaped = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`@${escaped}\\b`, 'gi')
      out = out.replace(re, `<@${id}>`)
    }
    // Convert :shortcode: emoji (e.g. :sob:) into their unicode characters.
    out = replaceShortcodes(out)
    return out
  }

  const submit = () => {
    const hasText = !!value.trim()

    // Edit mode: save the edit instead of sending a new message.
    if (editTarget) {
      if (hasText) editMessage(editTarget.id, encodeMentions(value))
      else setEditTarget(null)
      setValue('')
      requestAnimationFrame(() => {
        if (taRef.current) taRef.current.style.height = 'auto'
      })
      return
    }

    if (!hasText && pending.length === 0) return

    if (pending.length > 0) {
      sendFiles(pending, encodeMentions(value))
      // Revoke preview URLs after a tick so the optimistic message can show them.
      const toRevoke = pending.map((p) => p.previewUrl)
      setTimeout(() => toRevoke.forEach((u) => URL.revokeObjectURL(u)), 30000)
      setPending([])
    } else {
      sendMessage(encodeMentions(value))
    }
    setValue('')
    setReplyTarget(null)
    pickedMentions.current = {}
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto'
    })
  }

  // --- file selection / paste ---------------------------------------------
  const addFiles = async (files: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return
    try {
      const read = await readFiles(files)
      setPending((p) => [...p, ...read])
    } catch {
      /* ignore unreadable files */
    }
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void addFiles(e.target.files)
    e.target.value = '' // allow re-selecting the same file
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const it of Array.from(items)) {
      if (it.kind === 'file') {
        const f = it.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      void addFiles(files)
    }
  }

  const removePending = (idx: number) => {
    setPending((p) => {
      const copy = [...p]
      const [removed] = copy.splice(idx, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return copy
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention navigation takes priority while the popup is open.
    if (mentionQuery !== null && candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % candidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + candidates.length) % candidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applyMention(candidates[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }
    // :emoji: autocomplete navigation.
    if (emojiQuery !== null && emojiCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setEmojiIndex((i) => (i + 1) % emojiCandidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setEmojiIndex((i) => (i - 1 + emojiCandidates.length) % emojiCandidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applyEmoji(emojiCandidates[emojiIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setEmojiQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape' && replyTarget) {
      setReplyTarget(null)
    }
    if (e.key === 'Escape' && editTarget) {
      setEditTarget(null)
      setValue('')
    }
  }

  return (
    <div className="relative px-4 pb-4 pt-1">
      {/* @mention autocomplete */}
      <AnimatePresence>
        {mentionQuery !== null && candidates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-4 z-40 mb-1 w-72"
          >
            <Glass refract className="overflow-hidden rounded-2xl p-1.5">
              <div className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                Members
              </div>
              {candidates.map((c, i) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyMention(c)
                  }}
                  onMouseEnter={() => setMentionIndex(i)}
                  className="no-drag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
                  style={{
                    background:
                      i === mentionIndex ? 'rgb(var(--c-accent) / 0.22)' : 'transparent',
                    color: 'rgb(var(--c-text))',
                  }}
                >
                  <Avatar
                    user={{
                      id: c.id,
                      username: c.name,
                      displayName: c.name,
                      avatarUrl: c.avatarUrl,
                    }}
                    size={24}
                  />
                  <span className="truncate font-medium">{c.name}</span>
                </button>
              ))}
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>

      {/* :emoji: autocomplete */}
      <AnimatePresence>
        {emojiQuery !== null && emojiCandidates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-4 z-40 mb-1 w-72"
          >
            <Glass refract className="overflow-hidden rounded-2xl p-1.5">
              <div className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                Emoji
              </div>
              {emojiCandidates.map((e, i) => (
                <button
                  key={e.shortcode}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    applyEmoji(e)
                  }}
                  onMouseEnter={() => setEmojiIndex(i)}
                  className="no-drag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
                  style={{
                    background:
                      i === emojiIndex ? 'rgb(var(--c-accent) / 0.22)' : 'transparent',
                    color: 'rgb(var(--c-text))',
                  }}
                >
                  <img
                    src={twemojiURL(e.unicode)}
                    alt={e.unicode}
                    className="h-5 w-5"
                    draggable={false}
                  />
                  <span className="truncate font-medium">:{e.shortcode}:</span>
                </button>
              ))}
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editing bar */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="mb-1 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm"
              style={{ background: 'rgb(var(--c-accent) / 0.18)' }}
            >
              <span className="font-semibold text-accent">Editing message</span>
              <span className="text-muted">— escape to cancel</span>
              <button
                onClick={() => {
                  setEditTarget(null)
                  setValue('')
                }}
                className="no-drag ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface1 hover:text-text"
              >
                <IconClose width={14} height={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply bar */}
      <AnimatePresence>
        {replyTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="mb-1 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm"
              style={{ background: 'rgb(var(--c-surface0) / 0.6)' }}
            >
              <IconReply width={14} height={14} className="text-accent" />
              <span className="text-muted">Replying to</span>
              <span className="font-bold text-text">
                {replyTarget.author.displayName}
              </span>
              <span className="truncate text-subtext">
                {previewText(replyTarget.content).slice(0, 50)}
              </span>
              <button
                onClick={() => setReplyTarget(null)}
                className="no-drag ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface1 hover:text-text"
              >
                <IconClose width={14} height={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending attachment previews */}
      <AnimatePresence>
        {pending.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-1 flex flex-wrap gap-2 rounded-xl bg-surface0/50 p-2">
              {pending.map((f, i) => (
                <div
                  key={i}
                  className="relative h-20 w-20 overflow-hidden rounded-lg"
                  style={{ background: 'rgb(var(--c-crust) / 0.6)' }}
                >
                  {f.type.startsWith('image') ? (
                    <img
                      src={f.previewUrl}
                      alt={f.filename}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center">
                      <IconPaperclip width={20} height={20} className="text-subtext" />
                      <span className="mt-1 w-full truncate text-[0.6rem] text-muted">
                        {f.filename}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removePending(i)}
                    className="no-drag absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    title="Remove"
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Glass refract className="flex items-end gap-1 rounded-3xl px-2 py-1.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={onFileInput}
        />
        <IconButton title="Attach a file" onClick={() => fileInputRef.current?.click()}>
          <IconPaperclip width={20} height={20} />
        </IconButton>

        <textarea
          ref={taRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder={`Message #${channelName}`}
          className="no-drag selectable max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] leading-snug text-text outline-none placeholder:text-muted"
        />

        <IconButton title="GIF" onClick={() => onOpenPicker('gif')}>
          <IconGif width={22} height={22} />
        </IconButton>
        <IconButton title="Emoji" onClick={() => onOpenPicker('emoji')}>
          <IconSmile width={22} height={22} />
        </IconButton>

        <button
          onClick={submit}
          disabled={!value.trim() && pending.length === 0}
          title="Send"
          className="no-drag ml-1 flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
          style={{
            background:
              value.trim() || pending.length > 0
                ? 'rgb(var(--c-accent))'
                : 'rgb(var(--c-surface1))',
            color:
              value.trim() || pending.length > 0
                ? 'rgb(var(--c-bubble-mine-text))'
                : 'rgb(var(--c-muted))',
          }}
        >
          <IconSend width={18} height={18} />
        </button>
      </Glass>
    </div>
  )
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="no-drag flex h-9 w-9 items-center justify-center rounded-full text-subtext transition hover:bg-surface1 hover:text-text"
    >
      {children}
    </button>
  )
}
