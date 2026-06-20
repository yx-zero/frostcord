// Serialization between the Slate document and Discord's wire format.
//
//  - mention void  <-> <@id>
//  - custom emoji  <-> <:name:id> / <a:name:id>
//  - unicode emoji void serializes to its raw unicode char
//  - everything else is plain text

import { Descendant, Editor, Node, Transforms } from 'slate'
import {
  CommandElement,
  CustomElement,
  EmojiElement,
  MentionElement,
  SlashCommandData,
} from './types'
import { emojiForShortcode } from '../../utils/emoji'

// Serialize the editor value to the string we send to Discord.
export function serialize(nodes: Descendant[]): string {
  return nodes.map(serializeNode).join('')
}

function serializeNode(node: Descendant): string {
  if ('text' in node) return node.text
  const el = node as CustomElement
  switch (el.type) {
    case 'mention':
      return `<@${el.userId}>`
    case 'emoji':
      if (el.emojiId) {
        return `<${el.animated ? 'a' : ''}:${el.name}:${el.emojiId}>`
      }
      return el.unicode ?? ''
    case 'paragraph':
      return el.children.map(serializeNode).join('')
    default:
      return ''
  }
}

// Build an emoji inline void node (custom or unicode).
export function makeEmojiNode(opts: {
  name: string
  unicode?: string
  emojiId?: string
  animated?: boolean
}): EmojiElement {
  return {
    type: 'emoji',
    name: opts.name,
    unicode: opts.unicode,
    emojiId: opts.emojiId,
    animated: opts.animated,
    children: [{ text: '' }],
  }
}

export function makeMentionNode(userId: string, name: string): MentionElement {
  return { type: 'mention', userId, name, children: [{ text: '' }] }
}

// Build a command inline node from a chosen slash command.
export function makeCommandNode(command: SlashCommandData): CommandElement {
  return {
    type: 'command',
    command,
    values: {},
    files: {},
    subPath: [],
    children: [{ text: '' }],
  }
}

// Find the first command node in the editor (there's at most one), returning the
// node + its path, or null.
export function findCommand(editor: Editor): [CommandElement, number[]] | null {
  for (const [node, path] of Node.elements(editor)) {
    const el = node as CustomElement
    if (el.type === 'command') return [el, path]
  }
  return null
}

// Parse a Discord wire string into editor nodes (used when loading an edit).
// Recognizes <@id>, <:name:id>, <a:name:id>, and :shortcode: emoji.
export function deserialize(content: string): Descendant[] {
  const children: Descendant[] = []
  let buf = ''
  const flush = () => {
    if (buf) {
      children.push({ text: buf })
      buf = ''
    }
  }
  // Combined matcher for mentions and custom emoji.
  const re = /<(@!?)(\d+)>|<(a)?:(\w+):(\d+)>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    buf += content.slice(last, m.index)
    if (m[2]) {
      // mention
      flush()
      children.push(makeMentionNode(m[2], 'user'))
    } else if (m[5]) {
      // custom emoji
      flush()
      children.push(
        makeEmojiNode({ name: m[4], emojiId: m[5], animated: m[3] === 'a' }),
      )
    }
    last = re.lastIndex
  }
  buf += content.slice(last)
  // Now turn :shortcode: unicode emoji within text runs into emoji nodes.
  const withEmoji: Descendant[] = []
  for (const node of [...children, ...(buf ? [{ text: buf }] : [])]) {
    if (!('text' in node)) {
      withEmoji.push(node)
      continue
    }
    splitShortcodes(node.text, withEmoji)
  }
  if (withEmoji.length === 0) withEmoji.push({ text: '' })
  return [{ type: 'paragraph', children: withEmoji }]
}

function splitShortcodes(text: string, out: Descendant[]) {
  const re = /:([a-z0-9_+-]+):/gi
  let last = 0
  let m: RegExpExecArray | null
  let pending = ''
  while ((m = re.exec(text)) !== null) {
    const uni = emojiForShortcode(m[1])
    if (!uni) continue
    pending += text.slice(last, m.index)
    if (pending) {
      out.push({ text: pending })
      pending = ''
    }
    out.push(makeEmojiNode({ name: m[1], unicode: uni }))
    last = re.lastIndex
  }
  pending += text.slice(last)
  if (pending) out.push({ text: pending })
}

// Reset the editor to an empty paragraph.
export function resetEditor(editor: Editor) {
  Transforms.delete(editor, {
    at: {
      anchor: Editor.start(editor, []),
      focus: Editor.end(editor, []),
    },
  })
  // Ensure a single empty paragraph remains.
  if (editor.children.length === 0) {
    Transforms.insertNodes(editor, {
      type: 'paragraph',
      children: [{ text: '' }],
    })
  }
}

// True if the editor holds no text and no inline nodes.
export function isEmpty(editor: Editor): boolean {
  const text = Editor.string(editor, [])
  if (text.trim()) return false
  // Check for any inline void nodes (emoji/mention).
  for (const [node] of Node.elements(editor)) {
    const el = node as CustomElement
    if (el.type === 'emoji' || el.type === 'mention') return false
  }
  return true
}
