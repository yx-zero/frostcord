import { BrowserOpenURL } from '../../wailsjs/runtime/runtime'
import { isWails } from '../services/discord'

// Open a URL in the system's default browser (not the in-app webview).
export function openExternal(url: string) {
  if (!url) return
  if (isWails()) {
    BrowserOpenURL(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// Convenience click handler for <a>/<button> that should open externally.
export function onExternalClick(url: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    openExternal(url)
  }
}
