import { Check, TriangleAlert } from 'lucide-react'
import { cx } from '../utils/format'

/** Compact tag. `detected`/`matched` = green with ✓, `missing` = amber with !, default = neutral. */
export default function SkillChip({ children, variant = 'default', note, className }) {
  const tone = { default: '', detected: 'chip-success', matched: 'chip-success', missing: 'chip-warning', accent: 'chip-accent' }[variant]
  const Icon = variant === 'matched' || variant === 'detected' ? Check : variant === 'missing' ? TriangleAlert : null
  return (
    <span className={cx('chip', tone, className)}>
      {Icon && <Icon size={12} aria-hidden />}
      {children}
      {note && <span className="mono ml-0.5 opacity-80">{note}</span>}
      {variant === 'matched' && <span className="sr-only"> (matched)</span>}
      {variant === 'missing' && <span className="sr-only"> (not detected)</span>}
    </span>
  )
}

export function ChipList({ items, empty = 'None detected', render }) {
  if (!items?.length) return <p className="t-small text-ink-muted">{empty}</p>
  return <ul className="flex flex-wrap gap-1.5">{items.map((it, i) => <li key={i}>{render(it)}</li>)}</ul>
}
