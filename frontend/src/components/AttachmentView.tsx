import { Attachment } from '../types'
import { IconPaperclip } from './icons'
import { useAppStore } from '../store/appStore'

export function AttachmentView({ attachment }: { attachment: Attachment }) {
  const a = attachment
  const openLightbox = useAppStore((s) => s.openLightbox)

  switch (a.type) {
    case 'image':
    case 'gif':
      return (
        <img
          src={a.url}
          alt={a.name ?? a.type}
          className="max-h-80 max-w-full cursor-pointer rounded-lg object-cover transition hover:brightness-95"
          loading="lazy"
          onClick={() => openLightbox(a.url)}
        />
      )

    case 'sticker':
      return (
        <img
          src={a.url}
          alt={a.name ?? 'sticker'}
          className="max-h-40 w-auto cursor-pointer rounded-lg"
          loading="lazy"
          onClick={() => openLightbox(a.url)}
        />
      )

    case 'video':
      return (
        <video
          src={a.url}
          controls
          preload="metadata"
          className="max-h-80 max-w-full rounded-lg"
          style={{ background: 'black' }}
        />
      )

    case 'audio':
      return (
        <audio src={a.url} controls className="w-64 max-w-full" />
      )

    default:
      // Generic file card with a download link.
      return (
        <a
          href={a.url}
          target="_blank"
          rel="noreferrer noopener"
          className="no-drag flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:brightness-110"
          style={{ background: 'rgb(var(--c-crust) / 0.5)', color: 'rgb(var(--c-text))' }}
        >
          <IconPaperclip width={18} height={18} className="text-subtext" />
          <span className="max-w-[220px] truncate font-medium">
            {a.name ?? 'attachment'}
          </span>
        </a>
      )
  }
}
