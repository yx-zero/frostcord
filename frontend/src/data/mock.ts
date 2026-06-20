import {
  Channel,
  Emoji,
  Gif,
  Message,
  Server,
  Sticker,
  User,
} from '../types'

export const me: User = {
  id: 'me',
  username: 'you',
  displayName: 'You',
  color: '#cba6f7',
  status: 'online',
}

const alice: User = {
  id: 'u_alice',
  username: 'alice',
  displayName: 'Alice',
  color: '#89b4fa',
  status: 'online',
}
const bob: User = {
  id: 'u_bob',
  username: 'bob',
  displayName: 'Bob',
  color: '#a6e3a1',
  status: 'idle',
}
const carol: User = {
  id: 'u_carol',
  username: 'carol',
  displayName: 'Carol',
  color: '#f9e2af',
  status: 'dnd',
}

export const mockUsers: User[] = [me, alice, bob, carol]

export const mockServers: Server[] = [
  { id: 's_dm', name: 'Direct Messages', acronym: 'DM', color: '#cba6f7' },
  {
    id: 's_lounge',
    name: 'The Lounge',
    acronym: 'TL',
    color: '#89b4fa',
    unread: true,
    mentionCount: 3,
  },
  { id: 's_dev', name: 'Dev Hangout', acronym: 'DH', color: '#a6e3a1' },
  { id: 's_art', name: 'Art Club', acronym: 'AC', color: '#f38ba8' },
  { id: 's_music', name: 'Music Room', acronym: 'MR', color: '#fab387' },
]

export const mockChannels: Channel[] = [
  // The Lounge
  { id: 'cat_text', serverId: 's_lounge', name: 'Text Channels', type: 'category' },
  { id: 'c_general', serverId: 's_lounge', name: 'general', type: 'text', parentId: 'cat_text', topic: 'General chit-chat' },
  { id: 'c_memes', serverId: 's_lounge', name: 'memes', type: 'text', parentId: 'cat_text', unread: 12, topic: 'Post your best' },
  { id: 'c_random', serverId: 's_lounge', name: 'random', type: 'text', parentId: 'cat_text' },
  { id: 'cat_voice', serverId: 's_lounge', name: 'Voice Channels', type: 'category' },
  {
    id: 'c_vc_general',
    serverId: 's_lounge',
    name: 'General',
    type: 'voice',
    parentId: 'cat_voice',
    voiceMembers: [alice, bob],
  },
  { id: 'c_vc_music', serverId: 's_lounge', name: 'Music', type: 'voice', parentId: 'cat_voice' },
]

const now = Date.now()
const min = 60_000

export const mockMessages: Message[] = [
  {
    id: 'm1',
    channelId: 'c_general',
    author: alice,
    content: 'hey! did you see the new build?',
    timestamp: now - 22 * min,
    status: 'delivered',
    mine: false,
    attachments: [],
    embeds: [],
    reactions: [],
  },
  {
    id: 'm2',
    channelId: 'c_general',
    author: me,
    content: 'yeah just pulled it, the glass UI looks unreal',
    timestamp: now - 21 * min,
    status: 'delivered',
    mine: true,
    attachments: [],
    embeds: [],
    reactions: [{ emoji: '🔥', count: 2, me: false }],
  },
  {
    id: 'm3',
    channelId: 'c_general',
    author: me,
    content: 'the bubbles feel so much nicer than discord default',
    timestamp: now - 21 * min + 5000,
    status: 'delivered',
    mine: true,
    attachments: [],
    embeds: [],
    reactions: [],
  },
  {
    id: 'm4',
    channelId: 'c_general',
    author: bob,
    content: 'agreed. telegram-style but themeable is the dream',
    timestamp: now - 18 * min,
    status: 'delivered',
    mine: false,
    attachments: [],
    embeds: [],
    reactions: [{ emoji: '💯', count: 1, me: true }],
  },
  {
    id: 'm5',
    channelId: 'c_general',
    author: carol,
    content: 'can we get catppuccin mocha as default? 👀',
    timestamp: now - 12 * min,
    status: 'delivered',
    mine: false,
    attachments: [],
    embeds: [],
    reactions: [],
    replyTo: { id: 'm4', authorName: 'Bob', preview: 'telegram-style but themeable…' },
  },
  {
    id: 'm6',
    channelId: 'c_general',
    author: me,
    content: 'already done 😎',
    timestamp: now - 11 * min,
    status: 'delivered',
    mine: true,
    attachments: [],
    embeds: [],
    reactions: [{ emoji: '😎', count: 3, me: false }],
  },
  {
    id: 'm7',
    channelId: 'c_general',
    author: alice,
    content: 'what about send states? like when wifi drops',
    timestamp: now - 4 * min,
    status: 'delivered',
    mine: false,
    attachments: [],
    embeds: [],
    reactions: [],
  },
  {
    id: 'm8',
    channelId: 'c_general',
    author: me,
    content: 'sending shows a spinner circle, then a check when it lands',
    timestamp: now - 30000,
    status: 'sent',
    mine: true,
    attachments: [],
    embeds: [],
    reactions: [],
  },
  {
    id: 'm9',
    channelId: 'c_general',
    author: me,
    content: 'this one is mid-send (pretend the wifi blipped)',
    timestamp: now - 2000,
    status: 'sending',
    mine: true,
    attachments: [],
    embeds: [],
    reactions: [],
  },
]

// ---- Emoji / GIF / sticker mock data --------------------------------------
const EMOJI_CHARS =
  '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫡 🤭 🫢 🫣 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 🔥 ✨ ⭐ 🌟 💫 🎉 🎊 👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👏 🙌 🙏 💪'

export const mockEmoji: Emoji[] = EMOJI_CHARS.split(' ').map((char, i) => ({
  id: `e_${i}`,
  name: `emoji_${i}`,
  char,
}))

export const mockGifs: Gif[] = Array.from({ length: 12 }, (_, i) => ({
  id: `g_${i}`,
  url: `https://picsum.photos/seed/gif${i}/300/200`,
  previewUrl: `https://picsum.photos/seed/gif${i}/200/140`,
  width: 300,
  height: 200,
  title: `gif ${i}`,
}))

export const mockStickers: Sticker[] = Array.from({ length: 9 }, (_, i) => ({
  id: `st_${i}`,
  name: `sticker ${i}`,
  url: `https://picsum.photos/seed/sticker${i}/160/160`,
}))

export const typingUsers: User[] = [alice]
