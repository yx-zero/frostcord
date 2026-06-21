// Slate document model for the rich composer.
//
// The editor is a single paragraph whose children are a mix of:
//  - text runs ({ text })
//  - emoji void nodes (unicode -> twemoji image, or custom -> Discord CDN image)
//  - mention void nodes (@user pill, rendered like a sent mention)
//  - command-option chips (the inline slash layout)
//
// Void/inline nodes are non-editable atoms; the caret skips over them.

import { BaseEditor, Descendant } from 'slate'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'

export interface EmojiElement {
  type: 'emoji'
  /** unicode char (for twemoji) OR empty when custom */
  unicode?: string
  /** custom emoji id (Discord CDN) */
  emojiId?: string
  /** :shortcode: name, used for serialization + alt text */
  name: string
  animated?: boolean
  children: [{ text: '' }]
}

export interface MentionElement {
  type: 'mention'
  /** the user OR role id being mentioned */
  userId: string
  name: string
  /** when true this is a @role mention (serializes to <@&id>) */
  isRole?: boolean
  /** "#rrggbb" role color for the pill */
  color?: string
  children: [{ text: '' }]
}

// An inline slash command: the /name pill + its option chips, living inside the
// editor as a single deletable atom. Option state is stored on the node so it
// survives editor re-renders and serializes correctly.
export interface CommandElement {
  type: 'command'
  command: SlashCommandData
  values: Record<string, string>
  files: Record<string, { filename: string; data: string }>
  subPath: string[] // names of chosen sub-commands (0-2 deep)
  children: [{ text: '' }]
}

// Minimal SlashCommand shape stored on the node (mirrors services/discord
// SlashCommand to avoid an import cycle into the editor model).
export interface SlashCommandData {
  id: string
  appId: string
  version: string
  type: number
  name: string
  description: string
  botName: string
  botIconUrl: string
  options: CommandOptionData[] | null
}

export interface CommandOptionData {
  type: number
  name: string
  description: string
  required: boolean
  autocomplete: boolean
  choices: { name: string; value: string }[] | null
  options: CommandOptionData[] | null
}

export interface ParagraphElement {
  type: 'paragraph'
  children: Descendant[]
}

export type CustomElement =
  | ParagraphElement
  | EmojiElement
  | MentionElement
  | CommandElement

export interface CustomText {
  text: string
}

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor
    Element: CustomElement
    Text: CustomText
  }
}

export const emptyValue: Descendant[] = [
  { type: 'paragraph', children: [{ text: '' }] },
]
