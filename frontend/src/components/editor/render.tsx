// Slate render components: inline emoji images and @mention pills.

import { createContext, useContext } from 'react'
import { RenderElementProps, useSelected, useFocused } from 'slate-react'
import { CommandElement, CustomElement } from './types'
import { twemojiURL } from '../../utils/emoji'
import { CommandNode } from './CommandNode'

// Context to inject command-node dependencies (channel + run/cancel callbacks)
// into the Slate renderElement callback, which only receives element props.
export interface CommandCtx {
  guildId: string
  channelId: string
  onRun: (el: CommandElement) => void
  onCancel: () => void
}
const CommandContext = createContext<CommandCtx>({
  guildId: '',
  channelId: '',
  onRun: () => {},
  onCancel: () => {},
})
export const CommandProvider = CommandContext.Provider

// Marks emoji + mention as inline void atoms so the caret treats them as a
// single character and they can sit within a line of text.
import { Editor } from 'slate'

export function withInlines<T extends Editor>(editor: T): T {
  const { isInline, isVoid } = editor
  editor.isInline = (el) => {
    const e = el as CustomElement
    return e.type === 'emoji' || e.type === 'mention' || e.type === 'command' || isInline(el)
  }
  editor.isVoid = (el) => {
    const e = el as CustomElement
    return e.type === 'emoji' || e.type === 'mention' || e.type === 'command' || isVoid(el)
  }
  return editor
}

export function ElementRenderer(props: RenderElementProps) {
  const el = props.element as CustomElement
  const cmdCtx = useContext(CommandContext)
  switch (el.type) {
    case 'emoji':
      return <EmojiNode {...props} />
    case 'mention':
      return <MentionNode {...props} />
    case 'command':
      return (
        <CommandNode
          {...props}
          guildId={cmdCtx.guildId}
          channelId={cmdCtx.channelId}
          onRun={cmdCtx.onRun}
          onCancel={cmdCtx.onCancel}
        />
      )
    default:
      return (
        <p {...props.attributes} className="m-0 whitespace-pre-wrap break-words leading-snug">
          {props.children}
        </p>
      )
  }
}

function EmojiNode(props: RenderElementProps) {
  const el = props.element as CustomElement & { type: 'emoji' }
  const src = el.emojiId
    ? `https://cdn.discordapp.com/emojis/${el.emojiId}.${el.animated ? 'gif' : 'png'}?size=48`
    : el.unicode
      ? twemojiURL(el.unicode)
      : ''
  return (
    <span {...props.attributes} contentEditable={false} className="inline-block">
      <img
        src={src}
        alt={`:${el.name}:`}
        title={`:${el.name}:`}
        draggable={false}
        className="inline-block align-text-bottom"
        style={{ width: '1.35em', height: '1.35em' }}
      />
      {props.children}
    </span>
  )
}

function MentionNode(props: RenderElementProps) {
  const el = props.element as CustomElement & { type: 'mention' }
  const selected = useSelected()
  const focused = useFocused()
  const roleColor = el.isRole ? el.color : undefined
  return (
    <span
      {...props.attributes}
      contentEditable={false}
      className="mx-px inline-block rounded px-1 font-medium"
      style={{
        background: roleColor ? `${roleColor}33` : 'rgb(var(--c-accent) / 0.22)',
        color: roleColor ?? 'rgb(var(--c-accent2))',
        boxShadow: selected && focused ? '0 0 0 2px rgb(var(--c-accent) / 0.5)' : 'none',
      }}
    >
      @{el.name}
      {props.children}
    </span>
  )
}
