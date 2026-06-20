// Shared domain types. These mirror the subset of Discord's model we render,
// kept deliberately simple so the Go backend can map onto them later.

export type MessageStatus =
  | 'sending' // optimistic, not yet acked by server (Telegram: circle)
  | 'sent' // acked by server (Telegram: single check)
  | 'delivered' // confirmed in channel (Telegram: double check)
  | 'failed' // network error / rejected (Telegram: red !)

export interface User {
  id: string
  username: string
  /** display name (global_name / nick), falls back to username */
  displayName: string
  avatarUrl?: string
  /** hex or css color for the avatar fallback / name color */
  color?: string
  status?: 'online' | 'idle' | 'dnd' | 'offline'
  bot?: boolean
}

export interface Attachment {
  id: string
  type: 'image' | 'video' | 'gif' | 'sticker' | 'audio' | 'file'
  url: string
  width?: number
  height?: number
  name?: string
}

export interface Reaction {
  emoji: string // unicode or custom name
  emojiUrl?: string // for custom emoji
  count: number
  me: boolean
}

export interface EmbedField {
  name: string
  value: string
  inline: boolean
}

export interface Embed {
  type: string
  url?: string
  title?: string
  description?: string
  color?: string // css hex
  authorName?: string
  authorIcon?: string
  authorUrl?: string
  footerText?: string
  footerIcon?: string
  providerName?: string
  imageUrl?: string
  thumbUrl?: string
  videoUrl?: string
  fields: EmbedField[]
}

export interface Button {
  label: string
  style: number // 1-5 (primary/secondary/success/danger/link)
  url?: string
  disabled?: boolean
  emojiUrl?: string
  emoji?: string
}

export interface PollOption {
  id: number
  text: string
  count: number
  me: boolean
}

export interface Poll {
  question: string
  options: PollOption[]
  totalVotes: number
  finalized: boolean
  multi: boolean
}

export interface Message {
  id: string
  channelId: string
  author: User
  content: string
  /** ms epoch */
  timestamp: number
  editedTimestamp?: number
  status: MessageStatus
  mine: boolean
  attachments: Attachment[]
  embeds: Embed[]
  reactions: Reaction[]
  buttons?: Button[]
  poll?: Poll
  /** Discord message type (0=default, 7=join, 19=reply, etc.) */
  type?: number
  replyTo?: {
    id: string
    authorName: string
    preview: string
  }
  /** transient client id used to reconcile optimistic -> real */
  nonce?: string
}

export type ChannelType = 'text' | 'voice' | 'category' | 'announcement'

export interface Channel {
  id: string
  serverId: string
  name: string
  type: ChannelType
  topic?: string
  unread?: number
  /** category this channel belongs to (for nesting) */
  parentId?: string
  position?: number
  /** for voice: connected members */
  voiceMembers?: User[]
  /** DM-specific */
  isDM?: boolean
  avatarUrl?: string
  subtitle?: string
  /** group-DM members */
  recipients?: User[]
}

export interface Server {
  id: string
  name: string
  iconUrl?: string
  /** short acronym used when there's no icon */
  acronym: string
  /** brand color for the icon fallback */
  color?: string
  unread?: boolean
  mentionCount?: number
}

export interface UserProfile {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bannerUrl: string
  accentColor: string
  bio: string
  pronouns: string
  bot: boolean
  badgeIcons: string[]
}

export interface Emoji {
  id: string
  name: string
  /** unicode char for standard emoji, undefined for custom */
  char?: string
  /** url for custom server emoji */
  url?: string
  animated?: boolean
}

export interface Gif {
  id: string
  url: string // full gif/mp4
  previewUrl: string // small preview
  width: number
  height: number
  title?: string
}

export interface Sticker {
  id: string
  name: string
  url: string
}
