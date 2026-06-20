import { useEffect, useState } from 'react'
import { LiquidGlassFilter } from './components/LiquidGlassFilter'
import { ServerRail } from './components/ServerRail'
import { ChannelSidebar } from './components/ChannelSidebar'
import { ChatView } from './components/ChatView'
import { FriendsView } from './components/FriendsView'
import { SettingsPanel } from './components/SettingsPanel'
import { LoginScreen } from './components/LoginScreen'
import { ContextMenu } from './components/ContextMenu'
import { ProfilePopout } from './components/ProfilePopout'
import { Lightbox } from './components/Lightbox'
import { initTheme, useThemeStore } from './theme/themeStore'
import { useChatStore } from './store/chatStore'
import { useAppStore } from './store/appStore'
import { api, events, isWails } from './services/discord'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const animatedWallpaper = useThemeStore((s) => s.animatedWallpaper)
  const phase = useAppStore((s) => s.phase)
  const setPhase = useAppStore((s) => s.setPhase)
  const banner = useAppStore((s) => s.banner)
  const setBanner = useAppStore((s) => s.setBanner)
  const initMock = useChatStore((s) => s.initMock)
  const goLive = useChatStore((s) => s.goLive)
  const live = useChatStore((s) => s.live)
  const activeServerId = useChatStore((s) => s.activeServerId)
  const showFriends = useAppStore((s) => s.showFriends)
  const contextMenu = useAppStore((s) => s.contextMenu)
  const closeContextMenu = useAppStore((s) => s.closeContextMenu)
  const profile = useAppStore((s) => s.profile)
  const closeProfile = useAppStore((s) => s.closeProfile)

  // Paint theme once.
  useEffect(() => {
    initTheme()
  }, [])

  // Global Esc closes the lightbox.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useAppStore.getState().closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // When not inside Wails (browser dev), jump straight to mock UI.
  useEffect(() => {
    if (!isWails()) {
      initMock()
      setPhase('app')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subscribe to gateway lifecycle events (ready may also arrive via login flow).
  useEffect(() => {
    const offReady = events.onReady((me) => {
      // If we logged in but state hasn't gone live yet, do it now. Fetch the
      // server list via REST (already in the user's real sidebar order) rather
      // than using READY's name-less guild stubs.
      if (!useChatStore.getState().live) {
        void (async () => {
          const servers = await api.getServers()
          await goLive(me, servers)
        })()
      }
      setPhase('app')
    })
    const offError = events.onError((err) => setBanner(err))
    const offStatus = events.onStatus((status) => {
      if (status === 'reconnecting') setBanner('Reconnecting…')
      else if (status === 'ready') setBanner('')
    })
    return () => {
      offReady()
      offError()
      offStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After goLive flips `live` true, move to the app view.
  useEffect(() => {
    if (live) setPhase('app')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  const startMock = () => {
    initMock()
    setPhase('app')
  }

  const openSettings = () => setSettingsOpen(true)

  if (phase === 'login') {
    return <LoginScreen onMockMode={startMock} />
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <div className={`app-wallpaper ${animatedWallpaper ? 'animated' : ''}`} />
      <LiquidGlassFilter />

      {/* Connection banner */}
      {banner && (
        <div
          className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-semibold"
          style={{
            background: 'rgb(var(--c-warning) / 0.9)',
            color: 'rgb(var(--c-crust))',
          }}
        >
          {banner}
        </div>
      )}

      <div
        className="drag-region flex"
        style={{ background: 'rgb(var(--c-crust) / 0.55)' }}
      >
        <ServerRail onOpenSettings={openSettings} />
      </div>

      <ChannelSidebar onOpenSettings={openSettings} />
      {showFriends && activeServerId === '@me' ? (
        <FriendsView />
      ) : (
        <ChatView onOpenSettings={openSettings} />
      )}

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ContextMenu
        open={contextMenu.open}
        pos={{ x: contextMenu.x, y: contextMenu.y }}
        items={contextMenu.items}
        onClose={closeContextMenu}
      />

      <ProfilePopout
        open={profile.open}
        user={profile.user}
        x={profile.x}
        y={profile.y}
        onClose={closeProfile}
      />

      <Lightbox />
    </div>
  )
}

export default App
