import {
  WindowMinimise,
  WindowToggleMaximise,
  Quit,
} from '../../wailsjs/runtime/runtime'
import { isWails } from '../services/discord'

// Custom window controls for the frameless window: minimize, maximize/restore,
// close. Placed in the top-right; the surrounding bar should be a drag region.
export function WindowControls() {
  if (!isWails()) return null

  return (
    <div className="no-drag flex items-center">
      <ControlButton title="Minimize" onClick={() => WindowMinimise()}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
        </svg>
      </ControlButton>

      <ControlButton title="Maximize" onClick={() => WindowToggleMaximise()}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect
            x="2.5"
            y="2.5"
            width="7"
            height="7"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      </ControlButton>

      <ControlButton title="Close" onClick={() => Quit()} danger>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </ControlButton>
    </div>
  )
}

function ControlButton({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-11 items-center justify-center text-subtext transition"
      style={{ borderRadius: 8 }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = danger
          ? 'rgb(237 66 69 / 0.9)'
          : 'rgb(var(--c-surface1))')
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}
