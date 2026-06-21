import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createEditor, Descendant, Editor, Range, Transforms } from 'slate'
import { Editable, ReactEditor, Slate, withReact } from 'slate-react'
import { withHistory } from 'slate-history'
import { Glass } from './Glass'
import { IconSend, IconSmile, IconPaperclip, IconGif, IconClose, IconReply } from './icons'
import { useChatStore } from '../store/chatStore'
import { useComposerBridge } from '../store/composerBridge'
import { previewText } from '../store/mentionStore'
import { Avatar } from './Avatar'
import { PendingFile, readFiles } from '../utils/files'
import { EmojiEntry, searchEmoji, twemojiURL } from '../utils/emoji'
import { api, CommandOptionInput, SlashCommand } from '../services/discord'
import { ElementRenderer, withInlines, CommandProvider } from './editor/render'
import { withEmojiNormalize } from './editor/normalize'
import { emptyValue, CommandElement } from './editor/types'
import {
  deserialize,
  findCommand,
  isEmpty,
  makeCommandNode,
  makeEmojiNode,
  makeMentionNode,
  resetEditor,
  serialize,
} from './editor/serialize'
import { getTrigger, replaceTrigger } from './editor/insert'

interface Props {
  channelName: string
  onOpenPicker: (tab: 'emoji' | 'gif' | 'sticker') => void
}

interface MentionCandidate {
  id: string
  name: string
  avatarUrl?: string
  isRole?: boolean
  color?: string
}

export function Composer({ channelName, onOpenPicker }: Props) {
  // One Slate editor instance for the component's lifetime.
  const editor = useMemo(
    () => withEmojiNormalize(withInlines(withHistory(withReact(createEditor())))),
    [],
  )
  const [value, setValue] = useState<Descendant[]>(emptyValue)

  const sendMessage = useChatStore((s) => s.sendMessage)
  const sendFiles = useChatStore((s) => s.sendFiles)
  const executeCommand = useChatStore((s) => s.executeCommand)
  const replyTarget = useChatStore((s) => s.replyTarget)
  const setReplyTarget = useChatStore((s) => s.setReplyTarget)
  const editTarget = useChatStore((s) => s.editTarget)
  const setEditTarget = useChatStore((s) => s.setEditTarget)
  const editMessage = useChatStore((s) => s.editMessage)
  const live = useChatStore((s) => s.live)
  const activeServerId = useChatStore((s) => s.activeServerId)
  const activeChannelId = useChatStore((s) => s.activeChannelId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  // Cache of the full slash-command index per channel, so we fetch it once when
  // the picker opens and filter client-side as the user types (instead of
  // re-fetching all ~hundreds of commands on every keystroke).
  const commandCache = useRef<{ channelId: string; commands: SlashCommand[] } | null>(null)
  const insert = useComposerBridge((s) => s.insert)
  const insertSeq = useComposerBridge((s) => s.insertSeq)
  const consumeInsert = useComposerBridge((s) => s.consume)

  // Candidate members for @-autocomplete (full guild list / DM recipients +
  // chat participants), same sourcing as before.
  const channelMessages = useChatStore((s) => s.messagesByChannel[s.activeChannelId])
  const guildMembers = useChatStore((s) => s.membersByGuild[s.activeServerId])
  const guildRoles = useChatStore((s) => s.rolesByGuild[s.activeServerId])
  const dmRecipients = useChatStore((s) => {
    if (s.activeServerId !== '@me') return undefined
    const ch = (s.channelsByServer['@me'] ?? []).find((c) => c.id === s.activeChannelId)
    return ch?.recipients
  })

  const [pending, setPending] = useState<PendingFile[]>([])

  // --- autocomplete popup state (@ mentions and :emoji:) ---
  const [trigger, setTrigger] = useState<{
    kind: '@' | ':'
    query: string
    range: Range
  } | null>(null)
  const [acIndex, setAcIndex] = useState(0)

  // --- slash command state ---
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([])
  const [slashLoading, setSlashLoading] = useState(false)
  const [slashError, setSlashError] = useState<string | null>(null)
  const [slashBot, setSlashBot] = useState<string | null>(null)
  // True while a command node is present in the editor (suppresses the slash
  // picker / @ triggers; the command lives inline in the box).
  const [hasCommand, setHasCommand] = useState(false)

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

  const mentionCandidates: MentionCandidate[] = useMemo(() => {
    if (!trigger || trigger.kind !== '@') return []
    const q = trigger.query.toLowerCase()
    // Roles first (matching Discord's @ menu ordering), then members.
    const roleCands: MentionCandidate[] = (guildRoles ?? [])
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true))
      .map((r) => ({ id: r.id, name: r.name, isRole: true, color: r.color }))
    const memberCands = q
      ? participants.filter((u) => u.name.toLowerCase().includes(q))
      : participants
    return [...roleCands, ...memberCands].slice(0, 8)
  }, [trigger, participants, guildRoles])

  const emojiCandidates: EmojiEntry[] = useMemo(() => {
    if (!trigger || trigger.kind !== ':' || trigger.query.length < 2) return []
    return searchEmoji(trigger.query, 8)
  }, [trigger])

  // --- bridge: emoji pushed from the picker ---
  useEffect(() => {
    if (!insert) return
    ReactEditor.focus(editor)
    // Insert the raw text; the normalizer converts emoji into image nodes.
    Transforms.insertText(editor, insert)
    consumeInsert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertSeq])

  // --- load edit content into the editor ---
  useEffect(() => {
    if (editTarget) {
      // Deserialize is async-unfriendly with Slate's controlled value; we replace
      // children directly.
      const nodes = serializeToNodes(editTarget.content)
      Transforms.delete(editor, {
        at: { anchor: Editor.start(editor, []), focus: Editor.end(editor, []) },
      })
      Transforms.removeNodes(editor, { at: [0] })
      Transforms.insertNodes(editor, nodes, { at: [0] })
      setValue(editor.children)
      requestAnimationFrame(() => ReactEditor.focus(editor))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget])

  // --- slash search: fetch the index once per channel, filter client-side ---
  useEffect(() => {
    if (slashQuery === null || !live || hasCommand) {
      setSlashCommands([])
      return
    }
    const guild = activeServerId === '@me' ? '' : activeServerId
    const q = slashQuery.toLowerCase()
    const applyFilter = (all: SlashCommand[]) => {
      const filtered = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all
      setSlashCommands(filtered)
      setSlashIndex(0)
      setSlashLoading(false)
    }

    // Use the cache if it's for the current channel.
    if (commandCache.current && commandCache.current.channelId === activeChannelId) {
      applyFilter(commandCache.current.commands)
      return
    }

    // Otherwise fetch the full index once (empty query) and cache it.
    let cancelled = false
    setSlashLoading(true)
    setSlashError(null)
    api
      .searchCommands(guild, activeChannelId, '')
      .then((all) => {
        if (cancelled) return
        commandCache.current = { channelId: activeChannelId, commands: all }
        applyFilter(all)
      })
      .catch((err) => {
        if (cancelled) return
        setSlashCommands([])
        setSlashError(String(err?.message ?? err))
        setSlashLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slashQuery, activeServerId, activeChannelId, live, hasCommand])

  // Group commands by bot for the rail.
  const slashGroups = useMemo(() => {
    const groups: { botName: string; botIconUrl: string; commands: SlashCommand[] }[] = []
    const byBot = new Map<string, number>()
    for (const c of slashCommands) {
      const key = c.botName || 'Commands'
      let gi = byBot.get(key)
      if (gi === undefined) {
        gi = groups.length
        byBot.set(key, gi)
        groups.push({ botName: key, botIconUrl: c.botIconUrl, commands: [] })
      }
      groups[gi].commands.push(c)
    }
    return groups
  }, [slashCommands])

  const visibleGroups = useMemo(
    () => (slashBot === null ? slashGroups : slashGroups.filter((g) => g.botName === slashBot)),
    [slashGroups, slashBot],
  )
  const slashFlat = useMemo(() => visibleGroups.flatMap((g) => g.commands), [visibleGroups])

  useEffect(() => setSlashIndex(0), [slashBot])

  // --- editor change handler: detect triggers + leading slash ---
  const onChange = (next: Descendant[]) => {
    setValue(next)

    // Track whether a command node is present (it lives inline in the editor).
    const cmd = findCommand(editor)
    setHasCommand(!!cmd)

    // Slash picker: only when there's no command yet and the editor's text
    // starts with "/". (Once a command node exists, "/" is just text.)
    const fullText = Editor.string(editor, [])
    if (!cmd && live) {
      const sm = /^\/([\w-]*)$/.exec(fullText)
      if (sm) {
        setSlashQuery(sm[1])
        setTrigger(null)
        return
      }
      setSlashQuery(null)
    } else if (cmd) {
      setSlashQuery(null)
    }

    // @ and :emoji: triggers based on caret context.
    const t = getTrigger(editor, ['@', ':'])
    if (t) {
      setTrigger({ kind: t.trigger as '@' | ':', query: t.query, range: t.range })
      setAcIndex(0)
    } else {
      setTrigger(null)
    }
  }

  const applyMention = (cand: MentionCandidate) => {
    if (!trigger) return
    replaceTrigger(
      editor,
      trigger.range,
      makeMentionNode(cand.id, cand.name, { isRole: cand.isRole, color: cand.color }),
    )
    setTrigger(null)
    ReactEditor.focus(editor)
  }

  const applyEmoji = (entry: EmojiEntry) => {
    if (!trigger) return
    replaceTrigger(
      editor,
      trigger.range,
      makeEmojiNode({ name: entry.shortcode, unicode: entry.unicode }),
    )
    setTrigger(null)
    ReactEditor.focus(editor)
  }

  const clearEditor = () => {
    resetEditor(editor)
    setValue(editor.children)
    setHasCommand(false)
  }

  // Run the command stored in the editor's command node: build its option tree
  // + attachments and fire the interaction, then clear the editor.
  const runCommand = (el: CommandElement) => {
    // Resolve leaf options at the node's current sub-path.
    let levelOpts = el.command.options ?? []
    for (const name of el.subPath) {
      levelOpts = levelOpts.find((o) => o.name === name)?.options ?? []
    }
    const leaves = levelOpts
      .filter((o) => o.type !== 1 && o.type !== 2)
      .map((o) => ({ type: o.type, name: o.name, value: el.values[o.name] ?? '' }))
    let options: CommandOptionInput[] = leaves
    for (let i = el.subPath.length - 1; i >= 0; i--) {
      options = [{ type: 1, name: el.subPath[i], options }]
    }
    const attachments = Object.entries(el.files).map(([optionName, f]) => ({
      optionName,
      filename: f.filename,
      data: f.data,
    }))
    const cmd: SlashCommand = {
      id: el.command.id,
      appId: el.command.appId,
      version: el.command.version,
      type: el.command.type,
      name: el.command.name,
      description: el.command.description,
      botName: el.command.botName,
      botIconUrl: el.command.botIconUrl,
      options: el.command.options,
    }
    clearEditor()
    void executeCommand(cmd, options, attachments)
  }

  const submit = () => {
    if (editTarget) {
      const content = serialize(editor.children)
      if (content.trim()) editMessage(editTarget.id, content)
      else setEditTarget(null)
      clearEditor()
      return
    }

    // If a command is in the box, run it instead of sending a message.
    const cmd = findCommand(editor)
    if (cmd) {
      runCommand(cmd[0])
      return
    }

    const content = serialize(editor.children)
    const hasContent = !isEmpty(editor)

    if (!hasContent && pending.length === 0) return

    if (pending.length > 0) {
      sendFiles(pending, content)
      const toRevoke = pending.map((p) => p.previewUrl)
      setTimeout(() => toRevoke.forEach((u) => URL.revokeObjectURL(u)), 30000)
      setPending([])
    } else {
      sendMessage(content)
    }
    clearEditor()
    setReplyTarget(null)
  }

  // --- file selection / paste ---
  const addFiles = async (files: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return
    try {
      const read = await readFiles(files)
      setPending((p) => [...p, ...read])
    } catch {
      /* ignore */
    }
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void addFiles(e.target.files)
    e.target.value = ''
  }

  const removePending = (idx: number) => {
    setPending((p) => {
      const copy = [...p]
      const [removed] = copy.splice(idx, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return copy
    })
  }

  // Remove the command node from the editor (returns to normal typing).
  const cancelCommand = () => {
    const cmd = findCommand(editor)
    if (cmd) {
      Transforms.removeNodes(editor, { at: cmd[1] })
    }
    setHasCommand(false)
    setValue(editor.children)
    requestAnimationFrame(() => ReactEditor.focus(editor))
  }

  // Choose a command from the picker: clear the editor and insert a command node
  // at the start. It lives inline; the user can still type after it.
  const chooseCommand = (cmd: SlashCommand) => {
    setSlashQuery(null)
    setSlashCommands([])
    setSlashBot(null)
    resetEditor(editor)
    Transforms.insertNodes(editor, makeCommandNode({
      id: cmd.id,
      appId: cmd.appId,
      version: cmd.version,
      type: cmd.type,
      name: cmd.name,
      description: cmd.description,
      botName: cmd.botName,
      botIconUrl: cmd.botIconUrl,
      options: cmd.options,
    }), { at: [0, 0] })
    // Move the caret to the end (after the command node).
    Transforms.select(editor, Editor.end(editor, []))
    setHasCommand(true)
    setValue(editor.children)
    requestAnimationFrame(() => ReactEditor.focus(editor))
  }

  // --- keyboard handling on the editor ---
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Slash picker nav.
    if (slashQuery !== null && slashFlat.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex((i) => (i + 1) % slashFlat.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex((i) => (i - 1 + slashFlat.length) % slashFlat.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        chooseCommand(slashFlat[slashIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashQuery(null)
        return
      }
    }

    // @ / emoji popup nav.
    const list = trigger?.kind === '@' ? mentionCandidates : emojiCandidates
    if (trigger && list.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAcIndex((i) => (i + 1) % list.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAcIndex((i) => (i - 1 + list.length) % list.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (trigger.kind === '@') applyMention(mentionCandidates[acIndex])
        else applyEmoji(emojiCandidates[acIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setTrigger(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') {
      if (replyTarget) setReplyTarget(null)
      if (editTarget) {
        setEditTarget(null)
        clearEditor()
      }
    }
  }

  const renderElement = useCallback((props: Parameters<typeof ElementRenderer>[0]) => {
    return <ElementRenderer {...props} />
  }, [])

  const showMentionPopup = trigger?.kind === '@' && mentionCandidates.length > 0
  const showEmojiPopup = trigger?.kind === ':' && emojiCandidates.length > 0

  return (
    <div className="relative px-4 pb-4 pt-1">
      {/* /slash command picker (bot rail + list) */}
      <AnimatePresence>
        {slashQuery !== null && !hasCommand && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-4 right-4 z-40 mb-1 max-w-md"
          >
            <Glass refract className="flex max-h-80 overflow-hidden rounded-2xl">
              {slashGroups.length > 0 && (
                <div className="scroll-none flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-white/5 py-2">
                  <BotRailButton label="All" active={slashBot === null} onSelect={() => setSlashBot(null)}>
                    <span className="text-[0.7rem] font-bold">All</span>
                  </BotRailButton>
                  {slashGroups.map((g) => (
                    <BotRailButton
                      key={g.botName}
                      label={g.botName}
                      active={slashBot === g.botName}
                      onSelect={() => setSlashBot(g.botName)}
                    >
                      {g.botIconUrl ? (
                        <img src={g.botIconUrl} alt={g.botName} className="h-7 w-7 rounded-full" draggable={false} />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface1 text-sm font-bold text-accent">
                          {g.botName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </BotRailButton>
                  ))}
                </div>
              )}
              <div className="scroll-none flex-1 overflow-y-auto p-1.5">
                <div className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                  {slashBot ?? 'Commands'}
                </div>
                {slashLoading && <div className="px-2 py-2 text-sm text-muted">Searching…</div>}
                {!slashLoading && slashError && (
                  <div className="px-2 py-2 text-sm text-red-400">Couldn’t load commands: {slashError}</div>
                )}
                {!slashLoading && !slashError && slashFlat.length === 0 && (
                  <div className="px-2 py-2 text-sm text-muted">No commands available in this channel.</div>
                )}
                {visibleGroups.map((g) => (
                  <div key={g.botName}>
                    {slashBot === null && (
                      <div className="flex items-center gap-2 px-2 pb-1 pt-2">
                        {g.botIconUrl ? (
                          <img src={g.botIconUrl} alt={g.botName} className="h-4 w-4 shrink-0 rounded-full" draggable={false} />
                        ) : (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface1 text-[0.6rem] font-bold text-accent">/</span>
                        )}
                        <span className="truncate text-xs font-bold text-text">{g.botName}</span>
                      </div>
                    )}
                    {g.commands.map((c) => {
                      const flatIndex = slashFlat.indexOf(c)
                      return (
                        <button
                          key={c.id}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            chooseCommand(c)
                          }}
                          onMouseEnter={() => setSlashIndex(flatIndex)}
                          className="no-drag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
                          style={{
                            background: flatIndex === slashIndex ? 'rgb(var(--c-accent) / 0.22)' : 'transparent',
                            color: 'rgb(var(--c-text))',
                          }}
                        >
                          <span className="shrink-0 font-semibold text-accent">/{c.name}</span>
                          <span className="truncate text-muted">{c.description}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>

      {/* @mention autocomplete */}
      <AnimatePresence>
        {showMentionPopup && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-4 z-40 mb-1 w-72"
          >
            <Glass refract className="overflow-hidden rounded-2xl p-1.5">
              <div className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted">Members & Roles</div>
              {mentionCandidates.map((c, i) => (
                <button
                  key={(c.isRole ? 'r' : 'u') + c.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyMention(c)
                  }}
                  onMouseEnter={() => setAcIndex(i)}
                  className="no-drag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
                  style={{
                    background: i === acIndex ? 'rgb(var(--c-accent) / 0.22)' : 'transparent',
                    color: 'rgb(var(--c-text))',
                  }}
                >
                  {c.isRole ? (
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
                      style={{
                        background: c.color ? `${c.color}33` : 'rgb(var(--c-accent) / 0.22)',
                        color: c.color ?? 'rgb(var(--c-accent))',
                      }}
                    >
                      @
                    </span>
                  ) : (
                    <Avatar user={{ id: c.id, username: c.name, displayName: c.name, avatarUrl: c.avatarUrl }} size={24} />
                  )}
                  <span
                    className="truncate font-medium"
                    style={c.isRole && c.color ? { color: c.color } : undefined}
                  >
                    {c.isRole ? '@' : ''}{c.name}
                  </span>
                </button>
              ))}
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>

      {/* :emoji: autocomplete */}
      <AnimatePresence>
        {showEmojiPopup && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-4 z-40 mb-1 w-72"
          >
            <Glass refract className="overflow-hidden rounded-2xl p-1.5">
              <div className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted">Emoji</div>
              {emojiCandidates.map((e, i) => (
                <button
                  key={e.shortcode}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    applyEmoji(e)
                  }}
                  onMouseEnter={() => setAcIndex(i)}
                  className="no-drag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
                  style={{
                    background: i === acIndex ? 'rgb(var(--c-accent) / 0.22)' : 'transparent',
                    color: 'rgb(var(--c-text))',
                  }}
                >
                  <img src={emojiImg(e.unicode)} alt={e.unicode} className="h-5 w-5" draggable={false} />
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
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-1 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm" style={{ background: 'rgb(var(--c-accent) / 0.18)' }}>
              <span className="font-semibold text-accent">Editing message</span>
              <span className="text-muted">— escape to cancel</span>
              <button
                onClick={() => {
                  setEditTarget(null)
                  clearEditor()
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
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-1 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm" style={{ background: 'rgb(var(--c-surface0) / 0.6)' }}>
              <IconReply width={14} height={14} className="text-accent" />
              <span className="text-muted">Replying to</span>
              <span className="font-bold text-text">{replyTarget.author.displayName}</span>
              <span className="truncate text-subtext">{previewText(replyTarget.content).slice(0, 50)}</span>
              <button onClick={() => setReplyTarget(null)} className="no-drag ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface1 hover:text-text">
                <IconClose width={14} height={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending attachment previews */}
      <AnimatePresence>
        {pending.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-1 flex flex-wrap gap-2 rounded-xl bg-surface0/50 p-2">
              {pending.map((f, i) => (
                <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg" style={{ background: 'rgb(var(--c-crust) / 0.6)' }}>
                  {f.type.startsWith('image') ? (
                    <img src={f.previewUrl} alt={f.filename} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center">
                      <IconPaperclip width={20} height={20} className="text-subtext" />
                      <span className="mt-1 w-full truncate text-[0.6rem] text-muted">{f.filename}</span>
                    </div>
                  )}
                  <button onClick={() => removePending(i)} className="no-drag absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80" title="Remove">
                    <IconClose width={12} height={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Glass refract className="flex items-end gap-1 rounded-3xl px-2 py-1.5">
        <input ref={fileInputRef} type="file" multiple hidden onChange={onFileInput} />
        <IconButton title="Attach a file" onClick={() => fileInputRef.current?.click()}>
          <IconPaperclip width={20} height={20} />
        </IconButton>

        {/* The message editor — the command (when chosen) renders inline as a
            node inside it, so the box never "locks". */}
        <CommandProvider
          value={{
            guildId: activeServerId === '@me' ? '' : activeServerId,
            channelId: activeChannelId,
            onRun: runCommand,
            onCancel: cancelCommand,
          }}
        >
          <Slate editor={editor} initialValue={value} onChange={onChange}>
            <Editable
              renderElement={renderElement}
              onKeyDown={onKeyDown}
              renderPlaceholder={({ children, attributes }) => (
                <span
                  {...attributes}
                  style={{
                    ...attributes.style,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 1,
                  }}
                  className="pointer-events-none select-none text-muted"
                >
                  {children}
                </span>
              )}
              onPaste={(e) => {
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
              }}
              placeholder={`Message #${channelName}`}
              className="no-drag selectable max-h-40 min-h-[1.5rem] flex-1 self-center overflow-y-auto overflow-x-hidden break-words px-2 text-[0.95rem] leading-snug text-text outline-none"
              style={{ minWidth: 0, flex: 1 }}
            />
          </Slate>
        </CommandProvider>

        <IconButton title="GIF" onClick={() => onOpenPicker('gif')}>
          <IconGif width={22} height={22} />
        </IconButton>
        <IconButton title="Emoji" onClick={() => onOpenPicker('emoji')}>
          <IconSmile width={22} height={22} />
        </IconButton>

        <button
          onClick={submit}
          title={hasCommand ? 'Run command' : 'Send'}
          className="no-drag ml-1 flex h-9 w-9 items-center justify-center rounded-full transition"
          style={{ background: 'rgb(var(--c-accent))', color: 'rgb(var(--c-bubble-mine-text))' }}
        >
          <IconSend width={18} height={18} />
        </button>
      </Glass>
    </div>
  )
}

// Build editor nodes from a Discord wire string (for the edit flow).
function serializeToNodes(content: string): Descendant[] {
  return deserialize(content)
}

function emojiImg(unicode: string): string {
  return twemojiURL(unicode)
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} title={title} className="no-drag flex h-9 w-9 items-center justify-center rounded-full text-subtext transition hover:bg-surface1 hover:text-text">
      {children}
    </button>
  )
}

function BotRailButton({ children, label, active, onSelect }: { children: React.ReactNode; label: string; active: boolean; onSelect: () => void }) {
  return (
    <div className="group relative">
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          onSelect()
        }}
        className="no-drag flex h-9 w-9 items-center justify-center rounded-full transition"
        style={{
          background: active ? 'rgb(var(--c-accent) / 0.28)' : 'transparent',
          color: 'rgb(var(--c-text))',
          boxShadow: active ? 'inset 0 0 0 2px rgb(var(--c-accent))' : 'none',
        }}
      >
        {children}
      </button>
      <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-1 -translate-y-1/2 whitespace-nowrap rounded-md bg-crust px-2 py-1 text-xs font-semibold text-text opacity-0 shadow-lg transition group-hover:opacity-100">
        {label}
      </div>
    </div>
  )
}
