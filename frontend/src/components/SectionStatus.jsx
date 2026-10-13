import { Check, Minus, TriangleAlert } from 'lucide-react'
import { cx } from '../utils/format'

/** Resume sections list. Status is text + icon, never colour alone. */
export default function SectionStatus({ sections }) {
  return (
    <ul className="divide-y divide-line">
      {sections.map((s) => {
        const present = s.status === 'present'
        const optional = s.status === 'optional_missing'
        const Icon = present ? Check : optional ? Minus : TriangleAlert
        return (
          <li key={s.key} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              present ? 'bg-success-soft text-success' : optional ? 'bg-surface-soft text-ink-muted' : 'bg-warning-soft text-warning')}>
              <Icon size={12} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="font-medium">{s.label}</span>
                <span className={cx('t-small', present ? 'text-success' : optional ? 'text-ink-muted' : 'text-warning')}>
                  {present ? 'Complete' : optional ? 'Optional' : 'Needs attention'}
                </span>
              </div>
              {!present && s.note && <p className="t-small mt-0.5 text-ink-muted">{s.note}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
