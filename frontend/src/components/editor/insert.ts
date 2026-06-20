// Insertion helpers for the rich editor.

import { Editor, Transforms, Range } from 'slate'
import { makeEmojiNode, makeMentionNode } from './serialize'

// Insert an emoji void node at the current selection, then a trailing space so
// the caret continues naturally.
export function insertEmoji(
  editor: Editor,
  opts: { name: string; unicode?: string; emojiId?: string; animated?: boolean },
) {
  const node = makeEmojiNode(opts)
  Transforms.insertNodes(editor, node)
  Transforms.move(editor)
}

// Insert a mention pill, then a trailing space.
export function insertMention(editor: Editor, userId: string, name: string) {
  const node = makeMentionNode(userId, name)
  Transforms.insertNodes(editor, node)
  Transforms.move(editor)
  Transforms.insertText(editor, ' ')
}

// The current "word" immediately before the caret that starts with a trigger
// char (@ or :), used to drive autocomplete. Returns null if none.
export function getTrigger(
  editor: Editor,
  triggers: string[],
): { trigger: string; query: string; range: Range } | null {
  const { selection } = editor
  if (!selection || !Range.isCollapsed(selection)) return null

  const [start] = Range.edges(selection)
  const lineStart = Editor.before(editor, start, { unit: 'line' }) ?? Editor.start(editor, [])
  const before = Editor.string(editor, { anchor: lineStart, focus: start })

  for (const trig of triggers) {
    // Match trigger + word chars at the end of the text before the caret.
    const esc = trig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|\\s)(${esc}([\\w+-]*))$`)
    const m = re.exec(before)
    if (!m) continue
    const full = m[1]
    const query = m[2]
    // Compute the slate Range covering the trigger token.
    const offset = before.length - full.length
    const tokenStart = Editor.before(editor, start, {
      distance: full.length,
      unit: 'character',
    })
    if (!tokenStart) continue
    const range: Range = { anchor: tokenStart, focus: start }
    void offset
    return { trigger: trig, query, range }
  }
  return null
}

// Replace the trigger token (e.g. ":sob" or "@joh") with a node + trailing text.
export function replaceTrigger(
  editor: Editor,
  range: Range,
  node: ReturnType<typeof makeEmojiNode> | ReturnType<typeof makeMentionNode>,
  trailingSpace = true,
) {
  Transforms.select(editor, range)
  Transforms.delete(editor)
  Transforms.insertNodes(editor, node)
  Transforms.move(editor)
  if (trailingSpace) Transforms.insertText(editor, ' ')
}
