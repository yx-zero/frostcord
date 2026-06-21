import { create } from 'zustand'
import type { MenuItem } from '../components/ContextMenu'
import type { User } from '../types'

export type AppPhase = 'login' | 'app'

interface ContextMenuState {
  open: boolean
  x: number
  y: number
  items: MenuItem[]
}

interface ProfileState {
  open: boolean
  user: User | null
  x: number
  y: number
}

interface ReactionPickerState {
  open: boolean
  x: number
  y: number
  messageId: string
}

interface AppState {
  phase: AppPhase
  banner: string // transient error/status banner
  contextMenu: ContextMenuState
  profile: ProfileState
  reactionPicker: ReactionPickerState
  lightboxUrl: string | null
  showFriends: boolean
  showMessageRequests: boolean
  setPhase: (p: AppPhase) => void
  setBanner: (b: string) => void
  setShowFriends: (v: boolean) => void
  setShowMessageRequests: (v: boolean) => void
  openContextMenu: (x: number, y: number, items: MenuItem[]) => void
  closeContextMenu: () => void
  openProfile: (user: User, x: number, y: number) => void
  closeProfile: () => void
  openReactionPicker: (x: number, y: number, messageId: string) => void
  closeReactionPicker: () => void
  openLightbox: (url: string) => void
  closeLightbox: () => void
}

export const useAppStore = create<AppState>((set) => ({
  phase: 'login',
  banner: '',
  contextMenu: { open: false, x: 0, y: 0, items: [] },
  profile: { open: false, user: null, x: 0, y: 0 },
  reactionPicker: { open: false, x: 0, y: 0, messageId: '' },
  lightboxUrl: null,
  showFriends: false,
  showMessageRequests: false,
  setPhase: (phase) => set({ phase }),
  setBanner: (banner) => set({ banner }),
  setShowFriends: (showFriends) => set({ showFriends }),
  setShowMessageRequests: (showMessageRequests) => set({ showMessageRequests }),
  openContextMenu: (x, y, items) =>
    set({ contextMenu: { open: true, x, y, items } }),
  closeContextMenu: () =>
    set((s) => ({ contextMenu: { ...s.contextMenu, open: false } })),
  openProfile: (user, x, y) => set({ profile: { open: true, user, x, y } }),
  closeProfile: () =>
    set((s) => ({ profile: { ...s.profile, open: false } })),
  openReactionPicker: (x, y, messageId) =>
    set({ reactionPicker: { open: true, x, y, messageId } }),
  closeReactionPicker: () =>
    set((s) => ({ reactionPicker: { ...s.reactionPicker, open: false } })),
  openLightbox: (url) => set({ lightboxUrl: url }),
  closeLightbox: () => set({ lightboxUrl: null }),
}))
