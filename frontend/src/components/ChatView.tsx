import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatTopBar } from './ChatTopBar'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { EmojiPicker, PickerTab } from './EmojiPicker'
import { MembersPanel } from './MembersPanel'
import { Glass } from './Glass'
import { IconSearch, IconClose } from './icons'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/appStore'
import { useComposerBridge } from '../store/composerBridge'
import { typingUsers } from '../data/mock'
import { api } from '../services/discord'
import { Emoji, Gif, Sticker } from '../types'

export function ChatView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const live = useChatStore((s) => s.live)
  const activeServerId = useChatStore((s) => s.activeServerId)
  const activeChannelId = useChatStore((s) => s.activeChannelId)
  const channelsByServer = useChatStore((s) => s.channelsByServer)
  const messagesByChannel = useChatStore((s) => s.messagesByChannel)
  const sendAttachment = useChatStore((s) => s.sendAttachment)
  const typingIds = useChatStore((s) => s.typing)
  const membersByGuild = useChatStore((s) => s.membersByGuild)
  const appendText = useComposerBridge((s) => s.appendText)
  const showMembers = useChatStore((s) => s.showMembers)
  const searchOpen = useChatStore((s) => s.searchOpen)
  const searchQuery = useChatStore((s) => s.searchQuery)
  const setSearchQuery = useChatStore((s) => s.setSearchQuery)
  const toggleSearch = useChatStore((s) => s.toggleSearch)
  const activeRequestChannel = useChatStore((s) => s.activeRequestChannel)
  const acceptMessageRequest = useChatStore((s) => s.acceptMessageRequest)
  const declineMessageRequest = useChatStore((s) => s.declineMessageRequest)
  const setShowMessageRequests = useAppStore((s) => s.setShowMessageRequests)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState<PickerTab>('emoji')

  const isPendingRequest =
    !!activeRequestChannel && activeRequestChannel.id === activeChannelId
  const channel =
    (channelsByServer[activeServerId] ?? []).find((c) => c.id === activeChannelId) ??
    (isPendingRequest ? activeRequestChannel! : undefined)
  const allMessages = messagesByChannel[activeChannelId] ?? []
  const messages =
    searchOpen && searchQuery.trim()
      ? allMessages.filter((m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : allMessages
  // Typing: live uses real TYPING_START events (resolved to users); mock uses
  // the canned demo typers in the general channel.
  const typing = (() => {
    if (!live) {
      return activeChannelId === 'c_general' && !searchOpen ? typingUsers : []
    }
    if (searchOpen || typingIds.length === 0) return []
    const known = membersByGuild[activeServerId] ?? []
    const msgs = messagesByChannel[activeChannelId] ?? []
    return typingIds.map((id) => {
      const fromMembers = known.find((u) => u.id === id)
      if (fromMembers) return fromMembers
      const fromMsgs = msgs.find((m) => m.author.id === id)?.author
      return (
        fromMsgs ?? {
          id,
          username: 'user',
          displayName: 'Someone',
        }
      )
    })
  })()

  const openPicker = (tab: PickerTab) => {
    setPickerTab(tab)
    setPickerOpen(true)
  }

  const handleEmoji = (e: Emoji) => {
    if (e.char) appendText(e.char)
    // keep picker open so users can pick several emoji at once
  }
  const handleGif = (g: Gif) => {
    sendAttachment({
      id: g.id,
      type: 'gif',
      url: g.url,
      width: g.width,
      height: g.height,
    })
    setPickerOpen(false)
  }
  const handleSticker = (s: Sticker) => {
    sendAttachment({ id: s.id, type: 'sticker', url: s.url, name: s.name })
    setPickerOpen(false)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <ChatTopBar channel={channel} onOpenSettings={onOpenSettings} />

        {/* In-channel search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden px-3 pt-2"
            >
              <Glass className="flex items-center gap-2 rounded-xl px-3 py-2">
                <IconSearch width={16} height={16} className="text-muted" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search this channel"
                  className="no-drag selectable flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
                />
                {searchQuery && (
                  <span className="text-xs text-muted">
                    {messages.length} result{messages.length === 1 ? '' : 's'}
                  </span>
                )}
                <button
                  onClick={toggleSearch}
                  className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface1 hover:text-text"
                >
                  <IconClose width={14} height={14} />
                </button>
              </Glass>
            </motion.div>
          )}
        </AnimatePresence>

        <MessageList messages={messages} typing={typing} />

        {/* Pending message-request banner — sending also auto-accepts. */}
        {isPendingRequest && channel && (
          <div className="px-3 pb-1">
            <Glass className="flex items-center gap-3 rounded-xl px-4 py-2.5">
              <span className="text-sm text-subtext">
                <span className="font-bold text-text">{channel.name}</span> wants to message you. Accept to chat — or just reply to accept automatically.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => acceptMessageRequest(channel.id)}
                  className="no-drag rounded-lg px-3 py-1 text-xs font-bold"
                  style={{ background: 'rgb(var(--c-accent))', color: 'rgb(var(--c-bubble-mine-text))' }}
                >
                  Accept DM
                </button>
                <button
                  onClick={() => {
                    declineMessageRequest(channel.id)
                    setShowMessageRequests(true)
                  }}
                  className="no-drag rounded-lg px-3 py-1 text-xs font-bold"
                  style={{ background: 'rgb(var(--c-surface2))', color: 'rgb(var(--c-text))' }}
                >
                  Ignore
                </button>
                <button
                  onClick={() => {
                    declineMessageRequest(channel.id)
                    setShowMessageRequests(true)
                  }}
                  className="no-drag rounded-lg px-3 py-1 text-xs font-bold"
                  style={{ background: 'rgb(var(--c-danger) / 0.85)', color: 'white' }}
                >
                  Report Spam
                </button>
              </div>
            </Glass>
          </div>
        )}

        <div className="relative">
          <EmojiPicker
            open={pickerOpen}
            tab={pickerTab}
            onTab={setPickerTab}
            onClose={() => setPickerOpen(false)}
            onPickEmoji={handleEmoji}
            onPickGif={handleGif}
            onPickSticker={handleSticker}
            searchGifs={live ? api.searchGifs : undefined}
            favoriteGifs={live ? api.favoriteGifs : undefined}
          />
          <Composer
            channelName={channel?.name ?? 'channel'}
            onOpenPicker={openPicker}
          />
        </div>
      </div>

      {/* Members panel (right) */}
      <MembersPanel open={showMembers} messages={allMessages} />
    </div>
  )
}

