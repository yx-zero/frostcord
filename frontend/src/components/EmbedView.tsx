import { Embed } from '../types'
import { Markdown } from './Markdown'
import { useAppStore } from '../store/appStore'
import { onExternalClick } from '../utils/links'

// Discord-style rich embed card: colored left bar, author, title (link),
// description, fields grid, image/thumbnail, footer.
export function EmbedView({ embed }: { embed: Embed }) {
  const openLightbox = useAppStore((s) => s.openLightbox)
  return (
    <div
      className="my-1 max-w-[460px] overflow-hidden rounded-lg"
      style={{
        background: 'rgb(var(--c-crust) / 0.55)',
        borderLeft: `4px solid ${embed.color ?? 'rgb(var(--c-overlay))'}`,
      }}
    >
      <div className="flex gap-3 p-3">
        <div className="min-w-0 flex-1">
          {/* Author */}
          {embed.authorName && (
            <div className="mb-1 flex items-center gap-1.5">
              {embed.authorIcon && (
                <img
                  src={embed.authorIcon}
                  alt=""
                  className="h-5 w-5 rounded-full"
                />
              )}
              {embed.authorUrl ? (
                <a
                  href={embed.authorUrl} onClick={onExternalClick(embed.authorUrl!)}
                  
                  
                  className="text-sm font-bold text-text hover:underline"
                >
                  {embed.authorName}
                </a>
              ) : (
                <span className="text-sm font-bold text-text">
                  {embed.authorName}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          {embed.title && (
            <div className="mb-1">
              {embed.url ? (
                <a
                  href={embed.url} onClick={onExternalClick(embed.url!)}
                  
                  
                  className="font-bold hover:underline"
                  style={{ color: 'rgb(var(--c-accent2))' }}
                >
                  <Markdown content={embed.title} />
                </a>
              ) : (
                <span className="font-bold text-text">
                  <Markdown content={embed.title} />
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {embed.description && (
            <div className="selectable whitespace-pre-wrap break-words text-sm text-subtext">
              <Markdown content={embed.description} />
            </div>
          )}

          {/* Fields */}
          {embed.fields.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {embed.fields.map((f, i) => (
                <div
                  key={i}
                  className={f.inline ? '' : 'sm:col-span-2'}
                >
                  <div className="text-xs font-bold text-text">
                    <Markdown content={f.name} />
                  </div>
                  <div className="text-xs text-subtext">
                    <Markdown content={f.value} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inline image */}
          {embed.imageUrl && (
            <img
              src={embed.imageUrl}
              alt=""
              className="mt-2 max-h-72 max-w-full cursor-pointer rounded-md object-cover transition hover:brightness-95"
              loading="lazy"
              onClick={() => openLightbox(embed.imageUrl!)}
            />
          )}

          {/* Footer */}
          {embed.footerText && (
            <div className="mt-2 flex items-center gap-1.5">
              {embed.footerIcon && (
                <img src={embed.footerIcon} alt="" className="h-4 w-4 rounded-full" />
              )}
              <span className="text-xs text-muted">{embed.footerText}</span>
            </div>
          )}
        </div>

        {/* Thumbnail (right) */}
        {embed.thumbUrl && !embed.imageUrl && (
          <img
            src={embed.thumbUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        )}
      </div>
    </div>
  )
}
