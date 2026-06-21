import { create } from 'zustand'
import { Attachment, Channel, Message, Role, Server, ServerFolder, User } from '../types'
import {
  me as mockMe,
  mockChannels,
  mockMessages,
  mockServers,
} from '../data/mock'
import { api, events } from '../services/discord'
import { useReactionStore } from './reactionStore'

interface ChatState {
  /** false = mock data, true = real Discord backend */
  live: boolean
  me: User
  servers: Server[]
  /** sidebar folder grouping (empty => no folders, render flat) */
  serverFolders: ServerFolder[]
  /** pending DM message requests (from non-friends) */
  messageRequests: Channel[]
  /** pending spam message requests (separate folder) */
  spamRequests: Channel[]
  /** the message request currently previewed as a temporary chat, if any */
  activeRequestChannel: Channel | null
  channelsByServer: Record<string, Channel[]>
  activeServerId: string
  activeChannelId: string
  messagesByChannel: Record<string, Message[]>
  typing: string[]
  /** userId -> timeout id for typing auto-expiry, keyed by channel */
  connectionStatus: string
  loadingMessages: boolean
  loadingMore: boolean
  noMoreHistory: Record<string, boolean>
  replyTarget: Message | null
  editTarget: Message | null
  showMembers: boolean
  searchOpen: boolean
  searchQuery: string
  /** members fetched per guild via the gateway lazy member list (op 14) */
  membersByGuild: Record<string, User[]>
  /** mentionable roles fetched per guild (for @ autocomplete) */
  rolesByGuild: Record<string, Role[]>
  /** userId -> presence status (online/idle/dnd/offline) */
  presence: Record<string, string>

  // mock-mode setup
  initMock: () => void
  // live-mode setup (after successful login)
  goLive: (me: User, servers: Server[]) => Promise<void>

  setActiveServer: (id: string) => void
  setActiveServerAsync: (id: string) => Promise<void>
  loadChannelMessages: (channelId: string) => Promise<void>
  setActiveChannel: (id: string) => void
  loadMessageRequests: () => Promise<void>
  openMessageRequest: (channel: Channel) => void
  acceptMessageRequest: (channelId: string) => Promise<void>
  declineMessageRequest: (channelId: string) => Promise<void>
  sendMessage: (content: string, attachments?: Attachment[]) => void
  executeCommand: (
    cmd: import('../services/discord').SlashCommand,
    options: import('../services/discord').CommandOptionInput[],
    attachments?: import('../services/discord').CommandAttachmentInput[],
  ) => Promise<void>
  sendAttachment: (attachment: Attachment) => void
  sendFiles: (
    files: { filename: string; data: string; type: string; previewUrl: string }[],
    content?: string,
  ) => void
  retryMessage: (id: string) => void
  deleteMessage: (id: string) => void
  setReplyTarget: (m: Message | null) => void
  setEditTarget: (m: Message | null) => void
  editMessage: (id: string, content: string) => void
  toggleReaction: (messageId: string, emoji: string) => void
  votePoll: (messageId: string, optionId: number) => void
  loadMoreHistory: () => void
  toggleMembers: () => void
  toggleSearch: () => void
  setSearchQuery: (q: string) => void
  setServersOrdered: (servers: Server[]) => void
}

function seedMockMessages(): Record<string, Message[]> {
  const byChannel: Record<string, Message[]> = {}
  for (const m of mockMessages) {
    ;(byChannel[m.channelId] ||= []).push(m)
  }
  return byChannel
}

let nonceCounter = 0
function makeNonce(): string {
  nonceCounter += 1
  return `nonce_${Date.now()}_${nonceCounter}`
}

// Mock-mode optimistic send simulation (Telegram-style status progression).
function simulateSend(
  nonce: string,
  channelId: string,
  set: SetFn,
  forceFail = false,
) {
  const willFail = forceFail || Math.random() < 0.08
  const update = (patch: Partial<Message>) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
          m.nonce === nonce ? { ...m, ...patch } : m,
        ),
      },
    }))
  setTimeout(() => {
    if (willFail) {
      update({ status: 'failed' })
      return
    }
    update({ status: 'sent' })
    setTimeout(() => update({ status: 'delivered' }), 600)
  }, 700)
}

type SetFn = (fn: (s: ChatState) => Partial<ChatState>) => void

export const useChatStore = create<ChatState>((set, get) => ({
  live: false,
  me: mockMe,
  servers: [],
  serverFolders: [],
  messageRequests: [],
  spamRequests: [],
  activeRequestChannel: null,
  channelsByServer: {},
  activeServerId: '',
  activeChannelId: '',
  messagesByChannel: {},
  typing: [],
  connectionStatus: 'offline',
  loadingMessages: false,
  loadingMore: false,
  noMoreHistory: {},
  replyTarget: null,
  editTarget: null,
  showMembers: false,
  searchOpen: false,
  searchQuery: '',
  membersByGuild: {},
  rolesByGuild: {},
  presence: {},

  initMock: () => {
    const channelsByServer: Record<string, Channel[]> = {}
    for (const c of mockChannels) {
      ;(channelsByServer[c.serverId] ||= []).push(c)
    }
    set({
      live: false,
      me: mockMe,
      servers: mockServers,
      channelsByServer,
      activeServerId: mockServers[1].id,
      activeChannelId: 'c_general',
      messagesByChannel: seedMockMessages(),
      typing: ['u_alice'],
      connectionStatus: 'mock',
    })
  },

  goLive: async (me, servers) => {
    // Prepend a synthetic "Direct Messages" entry for the sidebar header.
    const dmServer: Server = {
      id: '@me',
      name: 'Direct Messages',
      acronym: 'DM',
    }
    set({
      live: true,
      me,
      servers: [dmServer, ...servers],
      serverFolders: [],
      messageRequests: [],
      spamRequests: [],
      activeRequestChannel: null,
      channelsByServer: {},
      messagesByChannel: {},
      typing: [],
      connectionStatus: 'ready',
    })

    // Fetch the sidebar folder grouping (non-blocking; rail renders flat until
    // it arrives, then regroups).
    api
      .getServerFolders()
      .then((folders) => set({ serverFolders: folders }))
      .catch(() => {})

    // Fetch pending message requests for the inbox + badge.
    void get().loadMessageRequests()

    // Wire gateway events -> store (incoming realtime messages).
    events.onMessage((m) => {
      set((s) => {
        const list = s.messagesByChannel[m.channelId]
        if (!list) return {} // channel not open; skip until loaded
        // Reconcile optimistic message by nonce if present.
        if (m.nonce) {
          const idx = list.findIndex((x) => x.nonce === m.nonce)
          if (idx >= 0) {
            const copy = [...list]
            copy[idx] = { ...m, status: 'delivered' }
            return {
              messagesByChannel: { ...s.messagesByChannel, [m.channelId]: copy },
            }
          }
        }
        if (list.some((x) => x.id === m.id)) return {}
        return {
          messagesByChannel: {
            ...s.messagesByChannel,
            [m.channelId]: [...list, { ...m, status: 'delivered' }],
          },
        }
      })
    })

    events.onStatus((status) => set({ connectionStatus: status }))

    // MESSAGE_UPDATE: e.g. Discord attaches a GIF/link embed after posting, or
    // an edit. Merge the new data into the existing message by id.
    events.onMessageUpdate((m) => {
      set((s) => {
        const list = s.messagesByChannel[m.channelId]
        if (!list) return {}
        const idx = list.findIndex((x) => x.id === m.id)
        if (idx < 0) return {}
        const copy = [...list]
        copy[idx] = { ...copy[idx], ...m, status: copy[idx].status }
        return {
          messagesByChannel: { ...s.messagesByChannel, [m.channelId]: copy },
        }
      })
    })

    // MESSAGE_DELETE: remove it from the channel.
    events.onMessageDelete((channelId, messageId) => {
      set((s) => {
        const list = s.messagesByChannel[channelId]
        if (!list) return {}
        return {
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: list.filter((m) => m.id !== messageId),
          },
        }
      })
    })

    // Lazy member list (op 14 response): merge into the guild's member set.
    events.onMembers((guildId, members) => {
      set((s) => {
        const existing = s.membersByGuild[guildId] ?? []
        const byId = new Map(existing.map((u) => [u.id, u]))
        for (const u of members) byId.set(u.id, u)
        return {
          membersByGuild: {
            ...s.membersByGuild,
            [guildId]: Array.from(byId.values()),
          },
        }
      })
    })

    // Typing indicators (others only). Auto-expire after 8s.
    events.onTyping((channelId, userId) => {
      if (channelId !== get().activeChannelId) return
      if (userId === get().me.id) return
      set((s) => ({ typing: Array.from(new Set([...s.typing, userId])) }))
      setTimeout(() => {
        set((s) => ({ typing: s.typing.filter((u) => u !== userId) }))
      }, 8000)
    })

    // Presence: track online/idle/dnd/offline for other users.
    events.onPresence((userId, status) => {
      set((s) => ({ presence: { ...s.presence, [userId]: status } }))
    })
    // Initial bulk presences from READY.
    events.onPresenceBulk((map) => {
      set((s) => ({ presence: { ...s.presence, ...map } }))
    })

    // Live reaction sync.
    const applyReaction = (
      channelId: string,
      messageId: string,
      emoji: string,
      mine: boolean,
      delta: number,
    ) =>
      set((s) => {
        const list = s.messagesByChannel[channelId]
        if (!list) return {}
        return {
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: list.map((m) => {
              if (m.id !== messageId) return m
              const existing = m.reactions.find((r) => r.emoji === emoji)
              let reactions
              if (existing) {
                reactions = m.reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count + delta, me: mine ? delta > 0 : r.me }
                      : r,
                  )
                  .filter((r) => r.count > 0)
              } else if (delta > 0) {
                reactions = [...m.reactions, { emoji, count: 1, me: mine }]
              } else {
                reactions = m.reactions
              }
              return { ...m, reactions }
            }),
          },
        }
      })
    // Apply only OTHER users' reactions from the gateway — our own were already
    // updated optimistically by toggleReaction (avoids double-counting).
    events.onReactionAdd((d) => {
      if (d.mine) return
      applyReaction(d.channelId, d.messageId, d.emoji, false, 1)
    })
    events.onReactionRemove((d) => {
      if (d.mine) return
      applyReaction(d.channelId, d.messageId, d.emoji, false, -1)
    })

    // Select first server and load its channels.
    if (servers.length > 0) {
      await get().setActiveServerAsync(servers[0].id)
    }
  },

  setActiveServer: (id) => {
    if (get().live) {
      void get().setActiveServerAsync(id)
      return
    }
    set({ activeServerId: id })
    const chans = get().channelsByServer[id] ?? []
    const firstText = chans.find((c) => c.type === 'text')
    if (firstText) get().setActiveChannel(firstText.id)
  },

  setActiveServerAsync: async (id) => {
    set({ activeServerId: id })
    // Load the guild's roles once, in parallel with channels, so they're in the
    // mention registry before messages render (otherwise @role shows generic).
    const rolesPromise =
      id !== '@me' && !get().rolesByGuild[id]
        ? api
            .getRoles(id)
            .then((roles) =>
              set((s) => ({ rolesByGuild: { ...s.rolesByGuild, [id]: roles } })),
            )
            .catch(() => {})
        : Promise.resolve()

    let channels = get().channelsByServer[id]
    if (!channels) {
      channels = id === '@me' ? await api.getDMChannels() : await api.getChannels(id)
      set((s) => ({
        channelsByServer: { ...s.channelsByServer, [id]: channels! },
      }))
    }
    await rolesPromise
    const firstText = channels.find((c) => c.type === 'text')
    if (firstText) get().setActiveChannel(firstText.id)
  },

  loadChannelMessages: async (channelId) => {
    set({ loadingMessages: true })
    try {
      const msgs = await api.getMessages(channelId)
      set((s) => ({
        messagesByChannel: { ...s.messagesByChannel, [channelId]: msgs },
        loadingMessages: false,
      }))
    } catch {
      set({ loadingMessages: false })
    }
  },

  setActiveChannel: (id) => {
    // Reset transient per-channel UI when switching channels (and leave any
    // message-request preview).
    set({ activeChannelId: id, typing: [], replyTarget: null, editTarget: null, activeRequestChannel: null })
    if (get().live && !get().messagesByChannel[id]) {
      void get().loadChannelMessages(id)
    }
    // Request the guild member list for this channel (op 14) so the members
    // panel + @autocomplete show ALL members, not just chat participants.
    const serverId = get().activeServerId
    if (get().live && serverId && serverId !== '@me') {
      api.requestMembers(serverId, id).catch(() => {})
    }
  },

  loadMessageRequests: async () => {
    if (!get().live) return
    try {
      const all = await api.getMessageRequests()
      set({
        messageRequests: all.filter((c) => !c.isSpam),
        spamRequests: all.filter((c) => c.isSpam),
      })
    } catch {
      /* ignore */
    }
  },

  // Open a message request as a temporary chat (preview), showing the
  // accept/ignore banner; sending a message there auto-accepts it.
  openMessageRequest: (channel) => {
    set({
      activeRequestChannel: channel,
      activeChannelId: channel.id,
      typing: [],
      replyTarget: null,
      editTarget: null,
    })
    if (get().live && !get().messagesByChannel[channel.id]) {
      void get().loadChannelMessages(channel.id)
    }
  },

  acceptMessageRequest: async (channelId) => {
    // Optimistically drop it from the inbox + clear the pending banner.
    set((s) => ({
      messageRequests: s.messageRequests.filter((c) => c.id !== channelId),
      spamRequests: s.spamRequests.filter((c) => c.id !== channelId),
      activeRequestChannel:
        s.activeRequestChannel?.id === channelId ? null : s.activeRequestChannel,
    }))
    try {
      await api.acceptMessageRequest(channelId)
    } catch {
      void get().loadMessageRequests()
      return
    }
    // It's now a normal DM — refresh the DM list so it appears.
    try {
      const dms = await api.getDMChannels()
      set((s) => ({ channelsByServer: { ...s.channelsByServer, '@me': dms } }))
    } catch {
      /* ignore */
    }
  },

  declineMessageRequest: async (channelId) => {
    set((s) => ({
      messageRequests: s.messageRequests.filter((c) => c.id !== channelId),
      spamRequests: s.spamRequests.filter((c) => c.id !== channelId),
      activeRequestChannel:
        s.activeRequestChannel?.id === channelId ? null : s.activeRequestChannel,
    }))
    try {
      await api.declineMessageRequest(channelId)
    } catch {
      void get().loadMessageRequests()
    }
  },

  sendMessage: (content, attachments = []) => {
    const trimmed = content.trim()
    if (!trimmed && attachments.length === 0) return
    const channelId = get().activeChannelId
    if (!channelId) return
    // Sending into a pending message request auto-accepts it (like Discord).
    const req = get().activeRequestChannel
    if (req && req.id === channelId) {
      api.acceptMessageRequest(channelId).catch(() => {})
      set((s) => ({
        activeRequestChannel: null,
        messageRequests: s.messageRequests.filter((c) => c.id !== channelId),
        spamRequests: s.spamRequests.filter((c) => c.id !== channelId),
      }))
      api
        .getDMChannels()
        .then((dms) => set((s) => ({ channelsByServer: { ...s.channelsByServer, '@me': dms } })))
        .catch(() => {})
    }
    const nonce = makeNonce()
    const reply = get().replyTarget
    const optimistic: Message = {
      id: nonce,
      channelId,
      author: get().me,
      content: trimmed,
      timestamp: Date.now(),
      status: 'sending',
      mine: true,
      attachments,
      embeds: [],
      reactions: [],
      nonce,
      replyTo: reply
        ? {
            id: reply.id,
            authorName: reply.author.displayName,
            preview: reply.content.slice(0, 60),
          }
        : undefined,
    }
    // Clear the reply target now that it's captured on the message.
    const replyToId = reply?.id ?? ''
    if (reply) set({ replyTarget: null })
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...(s.messagesByChannel[channelId] ?? []), optimistic],
      },
    }))

    if (get().live) {
      if (!trimmed) {
        // No text and no real attachment path here — mark delivered locally.
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
              m.nonce === nonce ? { ...m, status: 'delivered' } : m,
            ),
          },
        }))
        return
      }
      api
        .sendMessage(channelId, trimmed, nonce, replyToId)
        .then((real) => {
          set((s) => ({
            messagesByChannel: {
              ...s.messagesByChannel,
              [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
                m.nonce === nonce
                  ? { ...real, status: 'sent', nonce }
                  : m,
              ),
            },
          }))
          // gateway MESSAGE_CREATE will bump it to delivered.
        })
        .catch(() => {
          set((s) => ({
            messagesByChannel: {
              ...s.messagesByChannel,
              [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
                m.nonce === nonce ? { ...m, status: 'failed' } : m,
              ),
            },
          }))
        })
    } else {
      simulateSend(nonce, channelId, set)
    }
  },

  executeCommand: async (cmd, options, attachments = []) => {
    const channelId = get().activeChannelId
    if (!channelId || !get().live) return
    const serverId = get().activeServerId
    await api.executeCommand(
      serverId === '@me' ? '' : serverId,
      channelId,
      cmd,
      options,
      attachments,
    )
    // The bot's response arrives via the gateway (MESSAGE_CREATE); nothing to
    // render optimistically since the invocation itself isn't a user message.
  },

  sendAttachment: (attachment) => {
    // GIFs/stickers post as a URL in message content — Discord auto-embeds it
    // (this is how the official client sends Tenor GIFs / favorites).
    if (get().live && (attachment.type === 'gif' || attachment.type === 'sticker')) {
      get().sendMessage(attachment.url)
      return
    }
    // Mock mode: render the attachment locally.
    get().sendMessage('', [attachment])
  },

  sendFiles: (files, content = '') => {
    if (files.length === 0) return
    const channelId = get().activeChannelId
    if (!channelId) return
    const nonce = makeNonce()
    // Optimistic message with local previews.
    const optimistic: Message = {
      id: nonce,
      channelId,
      author: get().me,
      content: content.trim(),
      timestamp: Date.now(),
      status: 'sending',
      mine: true,
      attachments: files.map((f, i) => ({
        id: `${nonce}_${i}`,
        type: f.type.startsWith('image')
          ? f.type === 'image/gif'
            ? 'gif'
            : 'image'
          : f.type.startsWith('video')
            ? 'video'
            : f.type.startsWith('audio')
              ? 'audio'
              : 'file',
        url: f.previewUrl,
        name: f.filename,
      })),
      embeds: [],
      reactions: [],
      nonce,
    }
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...(s.messagesByChannel[channelId] ?? []), optimistic],
      },
    }))

    if (!get().live) {
      // Mock mode: just mark delivered after a beat.
      setTimeout(
        () =>
          set((s) => ({
            messagesByChannel: {
              ...s.messagesByChannel,
              [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
                m.nonce === nonce ? { ...m, status: 'delivered' } : m,
              ),
            },
          })),
        700,
      )
      return
    }

    api
      .sendFiles(
        channelId,
        content.trim(),
        nonce,
        files.map((f) => ({ filename: f.filename, data: f.data })),
      )
      .then((real) => {
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
              m.nonce === nonce ? { ...real, status: 'sent', nonce } : m,
            ),
          },
        }))
      })
      .catch(() => {
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
              m.nonce === nonce ? { ...m, status: 'failed' } : m,
            ),
          },
        }))
      })
  },

  deleteMessage: (id) => {
    const channelId = get().activeChannelId
    // Optimistically remove locally; in live mode also delete on the server.
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).filter(
          (m) => m.id !== id && m.nonce !== id,
        ),
      },
    }))
    if (get().live) {
      // Only real (server) ids can be deleted; skip optimistic nonces.
      const isRealId = /^\d+$/.test(id)
      if (isRealId) {
        api.deleteMessage(channelId, id).catch(() => {
          /* if it fails, the gateway state will re-sync on next fetch */
        })
      }
    }
  },

  setReplyTarget: (m) => set({ replyTarget: m }),

  toggleMembers: () => set((s) => ({ showMembers: !s.showMembers })),
  toggleSearch: () =>
    set((s) => ({ searchOpen: !s.searchOpen, searchQuery: s.searchOpen ? '' : s.searchQuery })),
  setSearchQuery: (q) => set({ searchQuery: q }),

  setServersOrdered: (servers) => {
    // READY guild stubs often have empty names/icons (full data arrives via
    // GUILD_CREATE). So DON'T replace our REST-fetched servers — only reorder
    // the existing ones using READY's id order.
    const order = servers.map((s) => s.id)
    const rank = new Map<string, number>()
    order.forEach((id, i) => rank.set(id, i))
    const existing = get().servers.filter((s) => s.id !== '@me')
    const sorted = [...existing].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name)
    })
    const dm = get().servers.find((s) => s.id === '@me')
    set({ servers: dm ? [dm, ...sorted] : sorted })
  },

  retryMessage: (id) => {
    const channelId = get().activeChannelId
    const list = get().messagesByChannel[channelId] ?? []
    const msg = list.find((m) => m.id === id || m.nonce === id)
    if (!msg) return
    const nonce = msg.nonce ?? makeNonce()
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
          m.id === id || m.nonce === id ? { ...m, status: 'sending', nonce } : m,
        ),
      },
    }))
    if (get().live) {
      api
        .sendMessage(channelId, msg.content, nonce)
        .then((real) =>
          set((s) => ({
            messagesByChannel: {
              ...s.messagesByChannel,
              [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
                m.nonce === nonce ? { ...real, status: 'sent', nonce } : m,
              ),
            },
          })),
        )
        .catch(() =>
          set((s) => ({
            messagesByChannel: {
              ...s.messagesByChannel,
              [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
                m.nonce === nonce ? { ...m, status: 'failed' } : m,
              ),
            },
          })),
        )
    } else {
      simulateSend(nonce, channelId, set)
    }
  },

  toggleReaction: (messageId, emoji) => {
    const channelId = get().activeChannelId
    const list = get().messagesByChannel[channelId] ?? []
    const msg = list.find((m) => m.id === messageId)
    const existing = msg?.reactions.find((r) => r.emoji === emoji)
    const removing = !!existing?.me

    // Adding a reaction promotes the emoji in the recently-used quick row.
    if (!removing) useReactionStore.getState().use(emoji)

    // Optimistic local update.
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) => {
          if (m.id !== messageId) return m
          const ex = m.reactions.find((r) => r.emoji === emoji)
          if (ex) {
            return {
              ...m,
              reactions: m.reactions
                .map((r) =>
                  r.emoji === emoji
                    ? { ...r, me: !r.me, count: r.me ? r.count - 1 : r.count + 1 }
                    : r,
                )
                .filter((r) => r.count > 0),
            }
          }
          return { ...m, reactions: [...m.reactions, { emoji, count: 1, me: true }] }
        }),
      },
    }))

    if (get().live && /^\d+$/.test(messageId)) {
      const p = removing
        ? api.removeReaction(channelId, messageId, emoji)
        : api.addReaction(channelId, messageId, emoji)
      p.catch(() => {})
    }
  },

  setEditTarget: (m) => set({ editTarget: m }),

  editMessage: (id, content) => {
    const channelId = get().activeChannelId
    // Optimistic update.
    set((s) => ({
      editTarget: null,
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
          m.id === id ? { ...m, content, editedTimestamp: Date.now() } : m,
        ),
      },
    }))
    if (get().live && /^\d+$/.test(id)) {
      api.editMessage(channelId, id, content).catch(() => {})
    }
  },

  votePoll: (messageId, optionId) => {
    const channelId = get().activeChannelId
    // Optimistic: mark my vote (single-select for simplicity).
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) => {
          if (m.id !== messageId || !m.poll) return m
          const options = m.poll.options.map((o) =>
            o.id === optionId
              ? { ...o, count: o.me ? o.count : o.count + 1, me: true }
              : m.poll!.multi
                ? o
                : { ...o, count: o.me ? o.count - 1 : o.count, me: false },
          )
          return { ...m, poll: { ...m.poll, options } }
        }),
      },
    }))
    if (get().live && /^\d+$/.test(messageId)) {
      api.votePoll(channelId, messageId, [optionId]).catch(() => {})
    }
  },

  loadMoreHistory: () => {
    const channelId = get().activeChannelId
    if (!get().live || get().loadingMore || get().noMoreHistory[channelId]) return
    const list = get().messagesByChannel[channelId] ?? []
    const oldest = list.find((m) => /^\d+$/.test(m.id))
    if (!oldest) return
    set({ loadingMore: true })
    api
      .getMessagesBefore(channelId, oldest.id)
      .then((older) => {
        set((s) => {
          const cur = s.messagesByChannel[channelId] ?? []
          const ids = new Set(cur.map((m) => m.id))
          const prepend = older.filter((m) => !ids.has(m.id))
          return {
            loadingMore: false,
            noMoreHistory: {
              ...s.noMoreHistory,
              [channelId]: older.length === 0,
            },
            messagesByChannel: {
              ...s.messagesByChannel,
              [channelId]: [...prepend, ...cur],
            },
          }
        })
      })
      .catch(() => set({ loadingMore: false }))
  },
}))
