// The inline slash-command node rendered inside the Slate editor: a /name pill
// plus option chips. Option state (values/files/subPath) lives on the Slate node
// and is updated via Transforms.setNodes, so it survives re-renders and the
// editor stays a normal input (you can type after it, Ctrl+A, backspace it).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RenderElementProps, ReactEditor, useSlateStatic } from 'slate-react'
import { Transforms } from 'slate'
import { CommandElement, CommandOptionData } from './types'
import { api, CommandOptionInput } from '../../services/discord'
import { readFile } from '../../utils/files'
import { IconClose } from '../icons'

// Discord application command option type ids.
const T = {
  SUB: 1,
  GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  NUMBER: 10,
  BOOLEAN: 5,
  ATTACHMENT: 11,
}

interface Props extends RenderElementProps {
  // Active server/channel + a callback to run the command, injected via context.
  guildId: string
  channelId: string
  onRun: (el: CommandElement) => void
  onCancel: () => void
}

export function CommandNode(props: Props) {
  const editor = useSlateStatic()
  const el = props.element as CommandElement
  const { guildId, channelId, onRun, onCancel } = props

  // Update this node's stored state immutably.
  const patch = (changes: Partial<CommandElement>) => {
    const path = ReactEditor.findPath(editor, el)
    Transforms.setNodes(editor, changes, { at: path })
  }
  const setValue = (name: string, v: string) =>
    patch({ values: { ...el.values, [name]: v } })
  const setFile = (name: string, f: { filename: string; data: string }) =>
    patch({ files: { ...el.files, [name]: f } })
  const clearFile = (name: string) => {
    const files = { ...el.files }
    delete files[name]
    patch({ files })
  }

  // Resolve options at the current sub-path.
  const levelOptions: CommandOptionData[] = (() => {
    let opts = el.command.options ?? []
    for (const name of el.subPath) {
      const sub = opts.find((o) => o.name === name)
      opts = sub?.options ?? []
    }
    return opts
  })()
  const subCommands = levelOptions.filter((o) => o.type === T.SUB || o.type === T.GROUP)
  const leafOptions = levelOptions.filter((o) => o.type !== T.SUB && o.type !== T.GROUP)

  // Autocomplete popup state (local; doesn't need to persist on the node).
  const [acOption, setAcOption] = useState<string | null>(null)
  const [acChoices, setAcChoices] = useState<{ name: string; value: string }[]>([])
  const [acIndex, setAcIndex] = useState(0)

  const focusedValue = acOption ? el.values[acOption] ?? '' : null

  useEffect(() => {
    if (acOption === null) {
      setAcChoices([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      // Only send the focused option + already-filled options; never empty
      // attachments (Discord rejects them with 50035).
      const leaves: CommandOptionInput[] = leafOptions
        .filter((o) => {
          if (o.type === T.ATTACHMENT) return false
          if (o.name === acOption) return true
          return (el.values[o.name] ?? '') !== ''
        })
        .map((o) => ({ type: o.type, name: o.name, value: el.values[o.name] ?? '' }))
      let inputs: CommandOptionInput[] = leaves
      for (let i = el.subPath.length - 1; i >= 0; i--) {
        // Find the sub-command's type for proper nesting.
        inputs = [{ type: T.SUB, name: el.subPath[i], options: inputs }]
      }
      api
        .autocomplete(guildId, channelId, toSlashCommand(el), inputs, acOption)
        .then((cs) => {
          if (!cancelled) {
            setAcChoices(cs)
            setAcIndex(0)
          }
        })
        .catch(() => {
          if (!cancelled) setAcChoices([])
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acOption, focusedValue, guildId, channelId])

  const run = () => {
    onRun(el)
  }

  return (
    <span
      {...props.attributes}
      contentEditable={false}
      // Stop Slate from hijacking mouse/focus events on the interactive chips so
      // the inputs can be focused and the autocomplete onFocus fires.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex flex-wrap items-center gap-1.5 align-middle"
    >
      {/* /command pill (+ chosen sub-commands) with a remove button */}
      <span className="flex items-center gap-1">
        <span
          className="rounded-md px-2 py-1 text-sm font-semibold"
          style={{ background: 'rgb(var(--c-accent) / 0.22)', color: 'rgb(var(--c-accent2))' }}
        >
          /{el.command.name}
          {el.subPath.map((s) => ' ' + s).join('')}
        </span>
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            onCancel()
          }}
          title="Remove command"
          className="no-drag flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-surface1 hover:text-text"
        >
          <IconClose width={12} height={12} />
        </button>
      </span>

      {/* Sub-command chooser when this level groups options */}
      {subCommands.length > 0 &&
        subCommands.map((s) => (
          <button
            key={s.name}
            onMouseDown={(e) => {
              e.preventDefault()
              patch({ subPath: [...el.subPath, s.name], values: {} })
            }}
            className="no-drag rounded-md bg-surface1 px-2 py-1 text-sm font-medium text-text transition hover:bg-surface2"
            title={s.description}
          >
            {s.name}
          </button>
        ))}

      {/* Leaf option chips */}
      {subCommands.length === 0 &&
        leafOptions.map((o) => (
          <OptionChip
            key={o.name}
            option={o}
            value={el.values[o.name] ?? ''}
            file={el.files[o.name]}
            acOpen={acOption === o.name}
            acChoices={acOption === o.name ? acChoices : []}
            acIndex={acIndex}
            onFocus={() => {
              if (o.autocomplete) setAcOption(o.name)
            }}
            onBlur={() =>
              setTimeout(() => setAcOption((cur) => (cur === o.name ? null : cur)), 150)
            }
            onChange={(v) => setValue(o.name, v)}
            onPickChoice={(c) => {
              setValue(o.name, c.value)
              setAcOption(null)
              setAcChoices([])
            }}
            onPickFile={async (file) => {
              const pf = await readFile(file)
              setFile(o.name, { filename: pf.filename, data: pf.data })
            }}
            onClearFile={() => clearFile(o.name)}
            onAcNav={(dir) =>
              setAcIndex((i) =>
                acChoices.length === 0 ? 0 : (i + dir + acChoices.length) % acChoices.length,
              )
            }
            onRun={run}
          />
        ))}

      {/* Slate requires the void node's children to be rendered. */}
      {props.children}
    </span>
  )
}

// Convert the node's stored command back to the services SlashCommand shape.
function toSlashCommand(el: CommandElement) {
  return {
    id: el.command.id,
    appId: el.command.appId,
    version: el.command.version,
    type: el.command.type,
    name: el.command.name,
    description: el.command.description,
    botName: el.command.botName,
    botIconUrl: el.command.botIconUrl,
    options: el.command.options,
  }
}

function OptionChip({
  option,
  value,
  file,
  acOpen,
  acChoices,
  acIndex,
  onFocus,
  onBlur,
  onChange,
  onPickChoice,
  onPickFile,
  onClearFile,
  onAcNav,
  onRun,
}: {
  option: CommandOptionData
  value: string
  file?: { filename: string; data: string }
  acOpen: boolean
  acChoices: { name: string; value: string }[]
  acIndex: number
  onFocus: () => void
  onBlur: () => void
  onChange: (v: string) => void
  onPickChoice: (c: { name: string; value: string }) => void
  onPickFile: (f: File) => void
  onClearFile: () => void
  onAcNav: (dir: number) => void
  onRun: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Track the input's screen rect so the portaled popup can anchor to it.
  const [popupRect, setPopupRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!acOpen) {
      setPopupRect(null)
      return
    }
    const update = () => {
      if (inputRef.current) setPopupRect(inputRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [acOpen, value])

  const label = (
    <span className="rounded-l-md bg-surface2 px-2 py-1 text-xs font-semibold text-subtext">
      {option.name}
      {option.required && <span className="text-red-400"> *</span>}
    </span>
  )

  if (option.type === T.ATTACHMENT) {
    return (
      <span className="flex items-center overflow-hidden rounded-md bg-surface1">
        {label}
        <label className="no-drag flex cursor-pointer items-center gap-1 px-2 py-1 text-sm text-text hover:bg-surface2">
          {file ? file.filename : option.description || 'Attach a file'}
          <input
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPickFile(f)
              e.target.value = ''
            }}
          />
        </label>
        {file && (
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              onClearFile()
            }}
            className="no-drag px-1 text-muted hover:text-text"
          >
            <IconClose width={12} height={12} />
          </button>
        )}
      </span>
    )
  }

  if ((option.choices && option.choices.length > 0) || option.type === T.BOOLEAN) {
    const opts =
      option.choices && option.choices.length > 0
        ? option.choices
        : [
            { name: 'True', value: 'true' },
            { name: 'False', value: 'false' },
          ]
    return (
      <span className="flex items-center overflow-hidden rounded-md bg-surface1">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="no-drag bg-surface1 px-2 py-1 text-sm text-text outline-none"
        >
          <option value="">—</option>
          {opts.map((c) => (
            <option key={c.value} value={c.value}>
              {c.name}
            </option>
          ))}
        </select>
      </span>
    )
  }

  return (
    <span className="relative inline-flex items-center">
      <span className="flex items-center overflow-hidden rounded-md bg-surface1">
        {label}
        <input
          ref={inputRef}
          type={option.type === T.INTEGER || option.type === T.NUMBER ? 'number' : 'text'}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (acOpen && acChoices.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                onAcNav(1)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                onAcNav(-1)
                return
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                onPickChoice(acChoices[acIndex])
                return
              }
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              onRun()
            }
          }}
          placeholder={option.description || option.name}
          className="no-drag min-w-[8rem] bg-surface1 px-2 py-1 text-sm text-text outline-none placeholder:text-muted"
        />
      </span>
      {/* Autocomplete popup is portaled to <body> with fixed positioning so it
          isn't clipped by the editor's overflow-y-auto. */}
      {acOpen &&
        popupRect &&
        createPortal(
          <div
            className="fixed z-[1000] max-h-56 w-72 overflow-y-auto rounded-lg bg-crust p-1 shadow-xl ring-1 ring-white/10"
            style={{
              left: popupRect.left,
              // Place the popup above the input.
              bottom: window.innerHeight - popupRect.top + 6,
            }}
          >
            {acChoices.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted">No matches</div>
            )}
            {acChoices.map((c, i) => (
              <button
                key={c.value + i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPickChoice(c)
                }}
                className="no-drag block w-full truncate rounded px-2 py-1.5 text-left text-sm transition"
                style={{
                  background: i === acIndex ? 'rgb(var(--c-accent) / 0.22)' : 'transparent',
                  color: 'rgb(var(--c-text))',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </span>
  )
}
