import { useCountUp } from '../hooks/useAsync'
import { cx } from '../utils/format'

const FILL = { ink: 'bg-ink', accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning' }

export function ProgressBar({ value, tone = 'ink', label, className, muted }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className={className}>
      <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-sm bg-surface-soft ring-1 ring-inset ring-line">
        <div className={cx('h-full rounded-sm transition-[width] duration-500 ease-out', muted ? 'bg-ink-muted' : FILL[tone])} style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

/** Simple circular indicator. The number counts up once on mount. */
export function CircularScore({ value, max = 100, tone = 'ink', size = 148, caption, suffix = `/ ${100}`, unit }) {
  const shown = useCountUp(value ?? 0)
  const r = 54
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, (value ?? 0) / max))
  const stroke = tone === 'accent' ? '#2563EB' : '#171717'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(value ?? 0)} out of ${max}`}>
      <svg viewBox="0 0 128 128" width={size} height={size} className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#E4E4E7" strokeWidth="8" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="butt"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold leading-none tracking-tight" style={{ fontSize: size * 0.27 }}>{Math.round(shown)}{unit}</span>
        {suffix && <span className="mono mt-1 text-ink-muted">{suffix}</span>}
        {caption && <span className="sr-only">{caption}</span>}
      </div>
    </div>
  )
}
