import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Button from './Button'

/** Accessible dialog: Esc closes, focus moves inside, backdrop click closes. */
export default function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const prev = document.activeElement
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="reveal w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-modal outline-none">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="t-h4">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog" className="-mr-2 -mt-1 px-2"><X size={16} /></Button>
        </div>
        <div className="text-ink-soft">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
