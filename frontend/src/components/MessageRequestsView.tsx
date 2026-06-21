import { useEffect, useState } from 'react'
import { Glass } from './Glass'
import { Avatar } from './Avatar'
import { Channel } from '../types'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/appStore'
import { IconInbox } from './icons'

type Tab = 'requests' | 'spam'

// The message-requests inbox: pending DMs from non-friends, split into Requests
// and Spam. Clicking a row opens a temporary chat preview (with accept/ignore).
export function MessageRequestsView() {
  const requests = useChatStore((s) => s.messageRequests)
  const spam = useChatStore((s) => s.spamRequests)
  const loadMessageRequests = useChatStore((s) => s.loadMessageRequests)
  const acceptMessageRequest = useChatStore((s) => s.acceptMessageRequest)
  const declineMessageRequest = useChatStore((s) => s.declineMessageRequest)
  const openMessageRequest = useChatStore((s) => s.openMessageRequest)
  const setShowMessageRequests = useAppStore((s) => s.setShowMessageRequests)
  const [tab, setTab] = useState<Tab>('requests')

  useEffect(() => {
    void loadMessageRequests()
  }, [loadMessageRequests])

  const list = tab === 'requests' ? requests : spam

  const open = (ch: Channel) => {
    setShowMessageRequests(false)
    openMessageRequest(ch)
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'requests', label: 'Requests', count: requests.length },
    { id: 'spam', label: 'Spam', count: spam.length },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="z-10 px-3 pt-3">
        <Glass refract className="drag-region flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <IconInbox width={18} height={18} className="text-accent" />
          <span className="font-bold text-text">Message Requests</span>
          <div className="ml-2 flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="no-drag rounded-lg px-3 py-1 text-sm font-semibold transition"
                style={{
                  background: tab === t.id ? 'rgb(var(--c-accent) / 0.25)' : 'transparent',
                  color: tab === t.id ? 'rgb(var(--c-text))' : 'rgb(var(--c-muted))',
                }}
              >
                {t.label}
                {t.count > 0 && <span className="ml-1 opacity-70">{t.count}</span>}
              </button>
            ))}
          </div>
        </Glass>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
        {list.length === 0 && (
          <div className="py-10 text-center text-sm text-muted">
            {tab === 'requests' ? 'No message requests.' : 'No spam.'}
          </div>
        )}
        {list.map((ch) => {
          const u = ch.recipients?.[0]
          const user = {
            id: u?.id ?? ch.id,
            username: u?.username ?? ch.subtitle?.replace(/^@/, '') ?? ch.name,
            displayName: u?.displayName ?? ch.name,
            avatarUrl: u?.avatarUrl ?? ch.avatarUrl,
          }
          return (
            <div
              key={ch.id}
              className="group flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-surface1/40"
            >
              <button
                onClick={() => open(ch)}
                className="no-drag flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Avatar user={user} size={36} />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-bold text-text">{ch.name}</span>
                  <span className="truncate text-xs text-muted">
                    {ch.subtitle || 'Wants to message you'}
                  </span>
                </div>
              </button>
              <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => void acceptMessageRequest(ch.id)}
                  className="no-drag rounded-lg px-3 py-1 text-xs font-bold"
                  style={{ background: 'rgb(var(--c-success))', color: 'rgb(var(--c-crust))' }}
                >
                  Accept
                </button>
                <button
                  onClick={() => void declineMessageRequest(ch.id)}
                  className="no-drag rounded-lg px-3 py-1 text-xs font-bold"
                  style={{ background: 'rgb(var(--c-surface2))', color: 'rgb(var(--c-danger))' }}
                >
                  {tab === 'spam' ? 'Delete' : 'Decline'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
