import { Fragment, ReactNode, useState } from 'react'
import { resolveChannel, resolveRole, resolveUser } from '../store/mentionStore'
import { EMOJI_REGEX, twemojiURL } from '../utils/emoji'
import { onExternalClick } from '../utils/links'

// Split a string into plain text + Discord-style (twemoji) emoji images, so
// unicode emoji render with Discord's artwork instead of the OS font.
function withEmoji(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  EMOJI_REGEX.lastIndex = 0
  while ((m = EMOJI_REGEX.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const emoji = m[0]
    out.push(
      <img
        key={`e${i++}`}
        src={twemojiURL(emoji)}
        alt={emoji}
        draggable={false}
        className="inline-block align-text-bottom"
        style={{ width: '1.35em', height: '1.35em', margin: '0 0.02em' }}
      />,
    )
    last = m.index + emoji.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length ? out : [text]
}

// Minimal, safe inline markdown -> React. No dangerouslySetInnerHTML, so there's
// no XSS surface: we only ever emit text nodes and known elements.
// Supports: **bold**, *italic*/_italic_, `code`, ~~strike~~, ||spoiler||, links,
// Discord mentions (<@id>, <@!id>, <#id>, <@&id>), @everyone/@here, custom
// emoji (<:name:id> / <a:name:id>), and timestamps (<t:...>).

type Token =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strike'; v: string }
  | { t: 'spoiler'; v: string }
  | { t: 'link'; v: string; href: string }
  | { t: 'mention'; kind: 'user' | 'channel' | 'role' | 'everyone'; label: string }
  | { t: 'emoji'; name: string; id: string; animated: boolean }

const URL_RE = /(https?:\/\/[^\s]+)/g

// Discord entity tokens: custom emoji, user/channel/role mentions, timestamps.
const ENTITY_RE =
  /<(a)?:(\w+):(\d+)>|<@!?(\d+)>|<#(\d+)>|<@&(\d+)>|<t:(\d+)(?::[a-zA-Z])?>|(@everyone|@here)/g

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = []
  // 1) Split out code spans first so their contents aren't further parsed.
  const codeSplit = line.split(/(`[^`]+`)/g)
  for (const seg of codeSplit) {
    if (!seg) continue
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
      tokens.push({ t: 'code', v: seg.slice(1, -1) })
      continue
    }
    // 2) Spoilers, bold, strike, italic on the remainder.
    const pattern =
      /(\|\|[^|]+\|\|)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(_[^_]+_)/g
    let lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(seg))) {
      if (m.index > lastIndex) {
        pushEntities(tokens, seg.slice(lastIndex, m.index))
      }
      const tok = m[0]
      if (tok.startsWith('||')) tokens.push({ t: 'spoiler', v: tok.slice(2, -2) })
      else if (tok.startsWith('**')) tokens.push({ t: 'bold', v: tok.slice(2, -2) })
      else if (tok.startsWith('~~')) tokens.push({ t: 'strike', v: tok.slice(2, -2) })
      else tokens.push({ t: 'italic', v: tok.slice(1, -1) })
      lastIndex = m.index + tok.length
    }
    if (lastIndex < seg.length) {
      pushEntities(tokens, seg.slice(lastIndex))
    }
  }
  return tokens
}

// Parse Discord entities (mentions/emoji/timestamps) then links in plain text.
function pushEntities(tokens: Token[], text: string) {
  let last = 0
  let m: RegExpExecArray | null
  ENTITY_RE.lastIndex = 0
  while ((m = ENTITY_RE.exec(text))) {
    if (m.index > last) pushTextWithLinks(tokens, text.slice(last, m.index))
    if (m[2] && m[3]) {
      // custom emoji <a?:name:id>
      tokens.push({ t: 'emoji', name: m[2], id: m[3], animated: !!m[1] })
    } else if (m[4]) {
      const name = resolveUser(m[4])
      tokens.push({ t: 'mention', kind: 'user', label: name ? `@${name}` : '@user' })
    } else if (m[5]) {
      const name = resolveChannel(m[5])
      tokens.push({ t: 'mention', kind: 'channel', label: name ? `#${name}` : '#channel' })
    } else if (m[6]) {
      const name = resolveRole(m[6])
      tokens.push({ t: 'mention', kind: 'role', label: name ? `@${name}` : '@role' })
    } else if (m[7]) {
      // timestamp
      const d = new Date(parseInt(m[7], 10) * 1000)
      tokens.push({ t: 'mention', kind: 'channel', label: d.toLocaleString() })
    } else if (m[8]) {
      tokens.push({ t: 'mention', kind: 'everyone', label: m[8] })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) pushTextWithLinks(tokens, text.slice(last))
}

function pushTextWithLinks(tokens: Token[], text: string) {
  let last = 0
  let m: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((m = URL_RE.exec(text))) {
    if (m.index > last) tokens.push({ t: 'text', v: text.slice(last, m.index) })
    tokens.push({ t: 'link', v: m[0], href: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ t: 'text', v: text.slice(last) })
}

function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span
      onClick={() => setRevealed(true)}
      className="cursor-pointer rounded px-0.5 transition"
      style={{
        background: revealed ? 'rgb(var(--c-crust) / 0.5)' : 'rgb(var(--c-crust))',
        color: revealed ? 'inherit' : 'transparent',
      }}
    >
      {children}
    </span>
  )
}

function Mention({
  kind,
  label,
  onAccent,
}: {
  kind: 'user' | 'channel' | 'role' | 'everyone'
  label: string
  onAccent?: boolean
}) {
  // On an accent (own) bubble, accent-on-accent is invisible — use the bubble's
  // own text color with a translucent white pill instead.
  const color = onAccent
    ? 'currentColor'
    : kind === 'everyone'
      ? 'rgb(var(--c-warning))'
      : 'rgb(var(--c-accent))'
  const bg = onAccent
    ? 'rgb(255 255 255 / 0.22)'
    : 'rgb(var(--c-accent) / 0.22)'
  return (
    <span
      className="rounded px-1 font-semibold"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

function renderToken(tok: Token, key: number, onAccent?: boolean): ReactNode {
  switch (tok.t) {
    case 'text':
      return <Fragment key={key}>{withEmoji(tok.v)}</Fragment>
    case 'bold':
      return <strong key={key} className="font-extrabold">{withEmoji(tok.v)}</strong>
    case 'italic':
      return <em key={key}>{withEmoji(tok.v)}</em>
    case 'strike':
      return <s key={key}>{withEmoji(tok.v)}</s>
    case 'spoiler':
      return <Spoiler key={key}>{tok.v}</Spoiler>
    case 'mention':
      return <Mention key={key} kind={tok.kind} label={tok.label} onAccent={onAccent} />
    case 'emoji':
      return (
        <img
          key={key}
          src={`https://cdn.discordapp.com/emojis/${tok.id}.${tok.animated ? 'gif' : 'png'}?size=48`}
          alt={`:${tok.name}:`}
          title={`:${tok.name}:`}
          className="inline-block align-text-bottom"
          style={{ width: '1.35em', height: '1.35em' }}
        />
      )
    case 'code':
      return (
        <code
          key={key}
          className="rounded px-1.5 py-0.5 font-mono text-[0.85em]"
          style={{ background: 'rgb(var(--c-crust) / 0.6)' }}
        >
          {tok.v}
        </code>
      )
    case 'link':
      return (
        <a
          key={key}
          href={tok.href}
          onClick={onExternalClick(tok.href)}
          className="cursor-pointer underline decoration-1 underline-offset-2"
          style={{ color: 'rgb(var(--c-accent2))' }}
        >
          {tok.v}
        </a>
      )
  }
}

export function Markdown({
  content,
  onAccent,
}: {
  content: string
  onAccent?: boolean
}) {
  // First split out fenced code blocks (```lang\n...\n```), rendering them as
  // <pre> so their contents aren't treated as markdown (no italics/headings).
  const blocks = splitCodeBlocks(content)

  return (
    <>
      {blocks.map((block, bi) => {
        if (block.type === 'code') {
          return (
            <pre
              key={`b${bi}`}
              className="selectable my-1 max-w-full overflow-x-auto rounded-md p-2 text-[0.85em] leading-snug"
              style={{
                background: 'rgb(var(--c-crust) / 0.7)',
                color: 'rgb(var(--c-text))',
              }}
            >
              <code className="font-mono whitespace-pre">{block.content}</code>
            </pre>
          )
        }
        return (
          <Fragment key={`b${bi}`}>{renderLines(block.content, onAccent)}</Fragment>
        )
      })}
    </>
  )
}

// Parse a string into alternating text / fenced-code blocks.
function splitCodeBlocks(
  content: string,
): { type: 'text' | 'code'; content: string }[] {
  const out: { type: 'text' | 'code'; content: string }[] = []
  const fence = /```(?:[a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = fence.exec(content))) {
    if (m.index > last) {
      out.push({ type: 'text', content: content.slice(last, m.index) })
    }
    out.push({ type: 'code', content: m[1].replace(/\n$/, '') })
    last = m.index + m[0].length
  }
  if (last < content.length) {
    out.push({ type: 'text', content: content.slice(last) })
  }
  if (out.length === 0) out.push({ type: 'text', content })
  return out
}

function renderLines(content: string, onAccent?: boolean): ReactNode {
  const lines = content.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        // Headings: "# ", "## ", "### " (Discord renders these as big/med/small)
        const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line)
        if (headingMatch) {
          const level = headingMatch[1].length
          const text = headingMatch[2]
          const rendered = tokenizeLine(text).map((tok, j) =>
            renderToken(tok, j, onAccent),
          )
          const sizeClass =
            level === 1
              ? 'text-[1.5rem] font-extrabold'
              : level === 2
                ? 'text-[1.25rem] font-bold'
                : 'text-[1.05rem] font-bold'
          return (
            <div key={i} className={`my-1 leading-tight ${sizeClass}`}>
              {rendered}
            </div>
          )
        }

        // Block quote: lines starting with "> "
        const isQuote = line.startsWith('> ')
        const text = isQuote ? line.slice(2) : line
        const rendered = tokenizeLine(text).map((tok, j) =>
          renderToken(tok, j, onAccent),
        )
        return (
          <Fragment key={i}>
            {isQuote ? (
              <span
                className="my-0.5 inline-block border-l-2 pl-2"
                style={{ borderColor: 'rgb(var(--c-overlay))' }}
              >
                {rendered}
              </span>
            ) : (
              rendered
            )}
            {i < lines.length - 1 && <br />}
          </Fragment>
        )
      })}
    </>
  )
}
