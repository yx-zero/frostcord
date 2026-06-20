// Service layer bridging the Go backend (Wails bindings + events) to UI types.
import {
  Login as goLogin,
  StartQRLogin as goStartQRLogin,
  CancelQRLogin as goCancelQRLogin,
  ListAccounts as goListAccounts,
  SwitchAccount as goSwitchAccount,
  RemoveAccount as goRemoveAccount,
  Logout as goLogout,
  GetGuilds,
  GetChannels,
  GetDMChannels,
  GetMessages,
  GetMessagesBefore as goGetMessagesBefore,
  GetPinnedMessages,
  GetFavoriteGifs,
  SendMessage as goSendMessage,
  SendFiles as goSendFiles,
  DeleteMessage as goDeleteMessage,
  EditMessage as goEditMessage,
  AddReaction as goAddReaction,
  RemoveReaction as goRemoveReaction,
  VotePoll as goVotePoll,
  GetFriends as goGetFriends,
  AcceptFriend as goAcceptFriend,
  RemoveFriend as goRemoveFriend,
  RequestMembers as goRequestMembers,
  GetUserProfile as goGetUserProfile,
  SearchGifs as goSearchGifs,
  SearchCommands as goSearchCommands,
  ExecuteCommand as goExecuteCommand,
  Autocomplete as goAutocomplete,
} from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import {
  Channel,
  ChannelType,
  Gif,
  Message,
  MessageStatus,
  Server,
  User,
  UserProfile,
} from '../types'
import { useMentionStore } from '../store/mentionStore'

// ---- DTO shapes coming from Go (camelCase) --------------------------------
interface UserDTO {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bot: boolean
}
interface GuildDTO {
  id: string
  name: string
  iconUrl: string
  acronym: string
}
interface ChannelDTO {
  id: string
  serverId: string
  name: string
  type: string
  topic: string
  parentId: string
  position: number
  isDM: boolean
  avatarUrl: string
  subtitle: string
  recipients: UserDTO[] | null
}
interface AttachmentDTO {
  id: string
  type: string
  url: string
  width: number
  height: number
  name: string
}
interface EmbedFieldDTO {
  name: string
  value: string
  inline: boolean
}
interface EmbedDTO {
  type: string
  url: string
  title: string
  description: string
  color: string
  authorName: string
  authorIcon: string
  authorUrl: string
  footerText: string
  footerIcon: string
  providerName: string
  imageUrl: string
  thumbUrl: string
  videoUrl: string
  fields: EmbedFieldDTO[] | null
}
interface ReactionDTO {
  emoji: string
  emojiUrl: string
  count: number
  me: boolean
}
interface ButtonDTO {
  label: string
  style: number
  url: string
  disabled: boolean
  emojiUrl: string
  emoji: string
}
interface PollOptionDTO {
  id: number
  text: string
  count: number
  me: boolean
}
interface PollDTO {
  question: string
  options: PollOptionDTO[]
  totalVotes: number
  finalized: boolean
  multi: boolean
}
interface MessageDTO {
  id: string
  channelId: string
  author: UserDTO
  content: string
  timestamp: string
  edited: boolean
  mine: boolean
  nonce: string
  msgType: number
  attachments: AttachmentDTO[]
  embeds: EmbedDTO[] | null
  reactions: ReactionDTO[] | null
  buttons: ButtonDTO[] | null
  poll: PollDTO | null
  replyTo: { id: string; authorName: string; preview: string } | null
  interaction: { name: string; userName: string } | null
  mentions: Record<string, string> | null
}

// ---- slash command shapes -------------------------------------------------
export interface CommandChoice {
  name: string
  value: string
}
export interface CommandOption {
  type: number
  name: string
  description: string
  required: boolean
  autocomplete: boolean
  choices: CommandChoice[] | null
  options: CommandOption[] | null
}
export interface SlashCommand {
  id: string
  appId: string
  version: string
  type: number
  name: string
  description: string
  botName: string
  botIconUrl: string
  options: CommandOption[] | null
}
export interface CommandOptionInput {
  type: number
  name: string
  value?: string
  options?: CommandOptionInput[]
}
export interface CommandAttachmentInput {
  optionName: string
  filename: string
  data: string
}

// ---- mappers --------------------------------------------------------------
function mapUser(u: UserDTO): User {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    avatarUrl: u.avatarUrl || undefined,
    bot: u.bot,
  }
}

function mapServer(g: GuildDTO): Server {
  return {
    id: g.id,
    name: g.name,
    iconUrl: g.iconUrl || undefined,
    acronym: g.acronym,
  }
}

function mapChannel(c: ChannelDTO): Channel {
  return {
    id: c.id,
    serverId: c.serverId,
    name: c.name,
    type: c.type as ChannelType,
    topic: c.topic || undefined,
    parentId: c.parentId || undefined,
    position: c.position,
    isDM: c.isDM || undefined,
    avatarUrl: c.avatarUrl || undefined,
    subtitle: c.subtitle || undefined,
    recipients: c.recipients ? c.recipients.map(mapUser) : undefined,
  }
}

export function mapMessage(m: MessageDTO): Message {
  // Feed names into the mention registry so <@id> renders as @name.
  if (m.mentions) {
    useMentionStore.getState().addUsers(m.mentions)
  }
  if (m.author?.id) {
    useMentionStore.getState().addUser(m.author.id, m.author.displayName || m.author.username)
  }
  return {
    id: m.id,
    channelId: m.channelId,
    author: mapUser(m.author),
    content: m.content,
    timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
    editedTimestamp: m.edited ? Date.now() : undefined,
    status: 'delivered' as MessageStatus,
    mine: m.mine,
    type: m.msgType,
    attachments: (m.attachments ?? []).map((a) => ({
      id: a.id,
      type:
        (a.type as 'image' | 'video' | 'gif' | 'sticker' | 'audio' | 'file') ??
        'file',
      url: a.url,
      width: a.width || undefined,
      height: a.height || undefined,
      name: a.name || undefined,
    })),
    embeds: (m.embeds ?? []).map((e) => ({
      type: e.type,
      url: e.url || undefined,
      title: e.title || undefined,
      description: e.description || undefined,
      color: e.color || undefined,
      authorName: e.authorName || undefined,
      authorIcon: e.authorIcon || undefined,
      authorUrl: e.authorUrl || undefined,
      footerText: e.footerText || undefined,
      footerIcon: e.footerIcon || undefined,
      providerName: e.providerName || undefined,
      imageUrl: e.imageUrl || undefined,
      thumbUrl: e.thumbUrl || undefined,
      videoUrl: e.videoUrl || undefined,
      fields: e.fields ?? [],
    })),
    reactions: (m.reactions ?? []).map((r) => ({
      emoji: r.emoji,
      emojiUrl: r.emojiUrl || undefined,
      count: r.count,
      me: r.me,
    })),
    buttons: (m.buttons ?? []).map((b) => ({
      label: b.label,
      style: b.style,
      url: b.url || undefined,
      disabled: b.disabled,
      emojiUrl: b.emojiUrl || undefined,
      emoji: b.emoji || undefined,
    })),
    poll: m.poll
      ? {
          question: m.poll.question,
          options: m.poll.options ?? [],
          totalVotes: m.poll.totalVotes,
          finalized: m.poll.finalized,
          multi: m.poll.multi,
        }
      : undefined,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorName: m.replyTo.authorName,
          preview: m.replyTo.preview,
        }
      : undefined,
    interaction: m.interaction
      ? { name: m.interaction.name, userName: m.interaction.userName }
      : undefined,
    nonce: m.nonce || undefined,
  }
}

// ---- public API -----------------------------------------------------------
export interface LoginResponse {
  ok: boolean
  error: string
  user: User | null
}

export interface SavedAccount {
  id: string
  username: string
  globalName: string
  avatarUrl: string
}

export const api = {
  async login(token: string): Promise<LoginResponse> {
    const res = await goLogin(token)
    return {
      ok: res.ok,
      error: res.error,
      user: res.ok ? mapUser(res.user as UserDTO) : null,
    }
  },

  startQRLogin(): Promise<void> {
    return goStartQRLogin()
  },

  cancelQRLogin(): Promise<void> {
    return goCancelQRLogin()
  },

  async listAccounts(): Promise<SavedAccount[]> {
    return ((await goListAccounts()) as SavedAccount[]) ?? []
  },

  async switchAccount(id: string): Promise<LoginResponse> {
    const res = await goSwitchAccount(id)
    return {
      ok: res.ok,
      error: res.error,
      user: res.ok ? mapUser(res.user as UserDTO) : null,
    }
  },

  removeAccount(id: string): Promise<void> {
    return goRemoveAccount(id)
  },

  logout(): Promise<void> {
    return goLogout()
  },

  async getServers(): Promise<Server[]> {
    const gs = (await GetGuilds()) as GuildDTO[]
    return (gs ?? []).map(mapServer)
  },

  async getChannels(serverId: string): Promise<Channel[]> {
    const cs = (await GetChannels(serverId)) as ChannelDTO[]
    const channels = (cs ?? []).map(mapChannel)
    // Register channel names for <#id> mention rendering.
    const names: Record<string, string> = {}
    for (const c of channels) names[c.id] = c.name
    useMentionStore.getState().addChannels(names)
    return channels
  },

  async getDMChannels(): Promise<Channel[]> {
    const cs = (await GetDMChannels()) as ChannelDTO[]
    const channels = (cs ?? []).map(mapChannel)
    const names: Record<string, string> = {}
    for (const c of channels) names[c.id] = c.name
    useMentionStore.getState().addChannels(names)
    return channels
  },

  async getMessages(channelId: string): Promise<Message[]> {
    const ms = (await GetMessages(channelId)) as MessageDTO[]
    return (ms ?? []).map(mapMessage)
  },

  async getPinnedMessages(channelId: string): Promise<Message[]> {
    const ms = (await GetPinnedMessages(channelId)) as MessageDTO[]
    return (ms ?? []).map(mapMessage)
  },

  async getMessagesBefore(channelId: string, beforeId: string): Promise<Message[]> {
    const ms = (await goGetMessagesBefore(channelId, beforeId)) as MessageDTO[]
    return (ms ?? []).map(mapMessage)
  },

  async editMessage(
    channelId: string,
    messageId: string,
    content: string,
  ): Promise<Message> {
    const m = (await goEditMessage(channelId, messageId, content)) as MessageDTO
    return mapMessage(m)
  },

  addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    return goAddReaction(channelId, messageId, emoji)
  },
  removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    return goRemoveReaction(channelId, messageId, emoji)
  },
  votePoll(channelId: string, messageId: string, answerIds: number[]): Promise<void> {
    return goVotePoll(channelId, messageId, answerIds)
  },

  async getFriends(): Promise<
    { id: string; type: number; user: User }[]
  > {
    const fs = (await goGetFriends()) as { id: string; type: number; user: UserDTO }[]
    return (fs ?? []).map((f) => ({ id: f.id, type: f.type, user: mapUser(f.user) }))
  },
  acceptFriend(userId: string): Promise<void> {
    return goAcceptFriend(userId)
  },
  removeFriend(userId: string): Promise<void> {
    return goRemoveFriend(userId)
  },

  async sendMessage(
    channelId: string,
    content: string,
    nonce: string,
    replyToId = '',
  ): Promise<Message> {
    const m = (await goSendMessage(
      channelId,
      content,
      nonce,
      replyToId,
    )) as MessageDTO
    return mapMessage(m)
  },

  deleteMessage(channelId: string, messageId: string): Promise<void> {
    return goDeleteMessage(channelId, messageId)
  },

  requestMembers(guildId: string, channelId: string): Promise<void> {
    return goRequestMembers(guildId, channelId)
  },

  async getUserProfile(userId: string): Promise<UserProfile> {
    return (await goGetUserProfile(userId)) as UserProfile
  },

  async sendFiles(
    channelId: string,
    content: string,
    nonce: string,
    files: { filename: string; data: string }[],
  ): Promise<Message> {
    const m = (await goSendFiles(channelId, content, nonce, files)) as MessageDTO
    return mapMessage(m)
  },

  async searchCommands(
    guildId: string,
    channelId: string,
    query: string,
  ): Promise<SlashCommand[]> {
    const cs = (await goSearchCommands(guildId, channelId, query)) as SlashCommand[]
    return cs ?? []
  },

  executeCommand(
    guildId: string,
    channelId: string,
    cmd: SlashCommand,
    options: CommandOptionInput[],
    attachments: CommandAttachmentInput[] = [],
  ): Promise<void> {
    return goExecuteCommand(
      guildId,
      channelId,
      cmd.id,
      cmd.appId,
      cmd.version,
      cmd.name,
      cmd.type,
      options as never,
      attachments as never,
    )
  },

  async autocomplete(
    guildId: string,
    channelId: string,
    cmd: SlashCommand,
    options: CommandOptionInput[],
    focusedName: string,
  ): Promise<{ name: string; value: string }[]> {
    const cs = (await goAutocomplete(
      guildId,
      channelId,
      cmd.id,
      cmd.appId,
      cmd.version,
      cmd.name,
      cmd.type,
      options as never,
      focusedName,
    )) as { name: string; value: string }[]
    return cs ?? []
  },

  async searchGifs(query: string): Promise<Gif[]> {
    const gs = (await goSearchGifs(query)) as {
      id: string
      url: string
      previewUrl: string
      width: number
      height: number
    }[]
    return (gs ?? []).map((g) => ({
      id: g.id,
      url: g.url,
      previewUrl: g.previewUrl,
      width: g.width,
      height: g.height,
    }))
  },

  async favoriteGifs(): Promise<Gif[]> {
    const gs = (await GetFavoriteGifs()) as {
      id: string
      url: string
      previewUrl: string
      width: number
      height: number
    }[]
    return (gs ?? []).map((g) => ({
      id: g.id,
      url: g.url,
      previewUrl: g.previewUrl,
      width: g.width,
      height: g.height,
    }))
  },
}

// ---- gateway events -------------------------------------------------------
export interface ReadyEvent {
  user: UserDTO
  guilds: GuildDTO[]
}

export const events = {
  onReady(cb: (user: User, servers: Server[]) => void) {
    return EventsOn('cd:ready', (data: ReadyEvent) => {
      cb(mapUser(data.user), (data.guilds ?? []).map(mapServer))
    })
  },
  onMessage(cb: (m: Message) => void) {
    return EventsOn('cd:message', (data: MessageDTO) => cb(mapMessage(data)))
  },
  onMessageUpdate(cb: (m: Message) => void) {
    return EventsOn('cd:messageUpdate', (data: MessageDTO) => cb(mapMessage(data)))
  },
  onMessageDelete(cb: (channelId: string, messageId: string) => void) {
    return EventsOn('cd:messageDelete', (d: { channelId: string; messageId: string }) =>
      cb(d.channelId, d.messageId),
    )
  },
  onStatus(cb: (status: string) => void) {
    return EventsOn('cd:status', (s: string) => cb(s))
  },
  onError(cb: (err: string) => void) {
    return EventsOn('cd:error', (e: string) => cb(e))
  },
  onMembers(cb: (guildId: string, members: User[]) => void) {
    return EventsOn(
      'cd:members',
      (d: { guildId: string; members: UserDTO[] }) =>
        cb(d.guildId, (d.members ?? []).map(mapUser)),
    )
  },
  onQRCode(cb: (url: string) => void) {
    return EventsOn('cd:qr', (d: { url: string }) => cb(d.url))
  },
  onQRUser(
    cb: (u: { id: string; username: string; discriminator: string; avatarUrl: string }) => void,
  ) {
    return EventsOn('cd:qrUser', cb)
  },
  onQRSuccess(cb: (user: User) => void) {
    return EventsOn('cd:qrSuccess', (u: UserDTO) => cb(mapUser(u)))
  },
  onQRError(cb: (err: string) => void) {
    return EventsOn('cd:qrError', (d: { error: string }) => cb(d.error))
  },
  onTyping(cb: (channelId: string, userId: string) => void) {
    return EventsOn('cd:typing', (d: { channelId: string; userId: string }) =>
      cb(d.channelId, d.userId),
    )
  },
  onPresence(cb: (userId: string, status: string) => void) {
    return EventsOn('cd:presence', (d: { userId: string; status: string }) =>
      cb(d.userId, d.status),
    )
  },
  onPresenceBulk(cb: (map: Record<string, string>) => void) {
    return EventsOn('cd:presenceBulk', (m: Record<string, string>) => cb(m))
  },
  onReactionAdd(
    cb: (d: { channelId: string; messageId: string; emoji: string; mine: boolean }) => void,
  ) {
    return EventsOn('cd:reactionAdd', cb)
  },
  onReactionRemove(
    cb: (d: { channelId: string; messageId: string; emoji: string; mine: boolean }) => void,
  ) {
    return EventsOn('cd:reactionRemove', cb)
  },
}

/** True when running inside the Wails runtime (vs plain browser dev). */
export function isWails(): boolean {
  return typeof window !== 'undefined' && !!(window as any).go?.main?.App
}
