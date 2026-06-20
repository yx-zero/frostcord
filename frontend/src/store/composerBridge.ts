import { create } from 'zustand'

// Small bridge so the picker can push an emoji into the composer's text input,
// and the composer can read+clear it. Keeps Composer and EmojiPicker decoupled.
interface ComposerBridge {
  /** text to append to the composer input (e.g. an emoji char) */
  insert: string
  /** monotonically increasing so the composer effect always fires */
  insertSeq: number
  appendText: (text: string) => void
  consume: () => void
}

export const useComposerBridge = create<ComposerBridge>((set) => ({
  insert: '',
  insertSeq: 0,
  appendText: (text) =>
    set((s) => ({ insert: text, insertSeq: s.insertSeq + 1 })),
  consume: () => set({ insert: '' }),
}))
