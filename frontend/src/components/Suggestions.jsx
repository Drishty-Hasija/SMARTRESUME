import { PRIORITY } from '../utils/format'
import Badge from './Badge'

/** Prioritised, rule-based suggestions generated from the actual analysis. */
export default function Suggestions({ items }) {
  if (!items?.length) return <p className="text-ink-muted">No suggestions. Nothing stood out.</p>
  return (
    <ol className="divide-y divide-line">
      {items.map((s, i) => {
        const p = PRIORITY[s.priority] || PRIORITY.low
        return (
          <li key={i} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <span className="mono mt-0.5 w-5 shrink-0 text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{s.title}</h3>
                <Badge tone={s.priority === 'high' ? 'danger' : s.priority === 'medium' ? 'warning' : 'neutral'}>{p.label}</Badge>
                <span className="mono text-ink-muted">{s.category}</span>
              </div>
              <p className="text-ink-soft">{s.message}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
