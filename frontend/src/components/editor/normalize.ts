// Slate normalizer that turns emoji syntax inside text runs into emoji void
// nodes, so they render as images inline in the editor. Handles:
//   - unicode emoji (😭)            -> twemoji image node
//   - :shortcode:  (:sob:)          -> twemoji image node (if known)
//   - <:name:id> / <a:name:id>      -> custom Discord emoji image node
//
// This runs on every text node so typed, pasted, and programmatically-inserted
// content all render consistently.

import { Editor, Element, Node, Text, Transforms } from 'slate'
import { makeEmojiNode } from './serialize'
import { emojiForShortcode, EMOJI_REGEX } from '../../utils/emoji'

interface Hit {
  index: number
  length: number
  node: ReturnType<typeof makeEmojiNode>
}

// Find the first emoji-like token in a string (custom > shortcode > unicode),
// returning its position + the node to insert, or null.
function firstEmojiHit(text: string): Hit | null {
  let best: Hit | null = null
  const consider = (index: number, length: number, node: Hit['node']) => {
    if (index < 0) return
    if (!best || index < best.index) best = { index, length, node }
  }

  // custom emoji <:name:id> / <a:name:id>
  const custom = /<(a)?:(\w+):(\d+)>/.exec(text)
  if (custom) {
    consider(custom.index, custom[0].length,
      makeEmojiNode({ name: custom[2], emojiId: custom[3], animated: custom[1] === 'a' }))
  }

  // :shortcode:
  const sc = /:([a-z0-9_+-]+):/i.exec(text)
  if (sc) {
    const uni = emojiForShortcode(sc[1])
    if (uni) consider(sc.index, sc[0].length, makeEmojiNode({ name: sc[1], unicode: uni }))
  }

  // unicode emoji run
  EMOJI_REGEX.lastIndex = 0
  const uni = EMOJI_REGEX.exec(text)
  if (uni) {
    consider(uni.index, uni[0].length, makeEmojiNode({ name: 'emoji', unicode: uni[0] }))
  }

  return best
}

export function withEmojiNormalize<T extends Editor>(editor: T): T {
  const { normalizeNode } = editor
  editor.normalizeNode = (entry) => {
    const [node, path] = entry
    if (Text.isText(node)) {
      const hit = firstEmojiHit(node.text)
      if (hit) {
        const at = { anchor: { path, offset: hit.index }, focus: { path, offset: hit.index + hit.length } }
        Transforms.delete(editor, { at })
        Transforms.insertNodes(editor, hit.node, { at: { path, offset: hit.index } })
        return // re-run normalization on the updated tree
      }
    }
    // Ensure the root always has at least one paragraph.
    if (Editor.isEditor(node) && node.children.length === 0) {
      Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] }, { at: [0] })
      return
    }
    // Paragraphs only contain inlines/text (guard against stray block nesting).
    if (Element.isElement(node) && node.type === 'paragraph') {
      for (const [child, childPath] of Node.children(editor, path)) {
        if (Element.isElement(child) && !editor.isInline(child)) {
          Transforms.unwrapNodes(editor, { at: childPath })
          return
        }
      }
    }
    normalizeNode(entry)
  }
  return editor
}
