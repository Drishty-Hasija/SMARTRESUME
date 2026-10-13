import { useId } from 'react'
import { cx } from '../utils/format'

/** Label + control + hint/error, wired for accessibility (htmlFor, aria-describedby, aria-invalid). */
export function Field({ label, hint, error, children, className, optional }) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  const control = children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
  return (
    <div className={className}>
      <label htmlFor={id} className="t-label mb-1.5 flex items-center justify-between text-ink">
        <span>{label}</span>
        {optional && <span className="font-normal text-ink-muted">Optional</span>}
      </label>
      {control}
      {error ? <p id={`${id}-err`} role="alert" className="t-small mt-1.5 text-danger">{error}</p>
        : hint ? <p id={`${id}-hint`} className="t-small mt-1.5 text-ink-muted">{hint}</p> : null}
    </div>
  )
}

export function Input({ className, error, ...props }) {
  return <input className={cx('input', error && 'input-error', className)} {...props} />
}

export function Textarea({ className, error, rows = 10, ...props }) {
  return <textarea rows={rows} className={cx('input min-h-[220px] resize-y leading-relaxed', error && 'input-error', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return <select className={cx('input appearance-none bg-no-repeat pr-8', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 10px center' }} {...props}>{children}</select>
}
