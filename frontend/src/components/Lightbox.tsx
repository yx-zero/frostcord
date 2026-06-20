import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import { IconClose } from './icons'

// Fullscreen image viewer (lightbox). Click backdrop or X to close.
export function Lightbox() {
  const url = useAppStore((s) => s.lightboxUrl)
  const close = useAppStore((s) => s.closeLightbox)

  return createPortal(
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85"
          onClick={close}
        >
          <button
            onClick={close}
            className="no-drag absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            title="Close (Esc)"
          >
            <IconClose width={22} height={22} />
          </button>
          <motion.img
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            src={url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="no-drag absolute bottom-5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
          >
            Open original
          </a>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
