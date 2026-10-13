import { Check, CircleAlert, Inbox, Loader2 } from 'lucide-react'
import { cx } from '../utils/format'
import Button from './Button'

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded bg-surface-soft ring-1 ring-inset ring-line/60', className)} aria-hidden />
}

/** Placeholder layout shown while a page loads. */
export function PageSkeleton({ rows = 3 }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-72 max-w-full" /></div>
      <div className="grid gap-6 md:grid-cols-2">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return <span role="status" className="inline-flex items-center gap-2 text-ink-muted"><Loader2 size={16} className="animate-spin" aria-hidden />{label}</span>
}

export function EmptyState({ icon: Icon = Inbox, title, children, action, secondary, className }) {
  return (
    <div className={cx('flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center', className)}>
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-line bg-surface-soft text-ink-soft"><Icon size={20} aria-hidden /></span>
      <h2 className="t-h4">{title}</h2>
      {children && <p className="mt-1.5 max-w-md text-ink-muted">{children}</p>}
      {(action || secondary) && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}{secondary}</div>}
    </div>
  )
}

/** Human error: plain title + what to do next. Never shows raw server output. */
export function ErrorState({ error, title, onRetry, className, compact }) {
  const message = title || error?.message || 'Something went wrong.'
  const hint = error?.hint
  return (
    <div role="alert" className={cx('flex gap-3 rounded-lg border border-red-200 bg-danger-soft text-danger', compact ? 'p-3' : 'p-5', className)}>
      <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {hint && <p className="t-small mt-0.5 text-ink-soft">{hint}</p>}
        {onRetry && <Button variant="secondary" size="sm" className="mt-3 bg-surface" onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  )
}

/** Progressive processing checklist: 01 Uploading … 05 Calculating results. */
export function LoadingState({ steps, current, title }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-sm">
      {title && <p className="mb-4 font-medium">{title}</p>}
      <ol className="space-y-2.5">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={label} className={cx('flex items-center gap-3 transition-colors duration-200', active ? 'text-ink' : done ? 'text-ink-soft' : 'text-ink-muted/70')} aria-current={active ? 'step' : undefined}>
              <span className="mono w-5 text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
              <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border', done ? 'border-success bg-success text-white' : active ? 'border-accent text-accent' : 'border-line-strong')}>
                {done ? <Check size={12} aria-hidden /> : active ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
              </span>
              <span className={cx(active && 'font-medium')}>{label}{active ? '…' : ''}</span>
              <span className="sr-only">{done ? 'done' : active ? 'in progress' : 'waiting'}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
