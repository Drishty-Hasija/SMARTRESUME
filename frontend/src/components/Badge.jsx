import { Check, X, Loader2, Minus } from 'lucide-react'
import { cx } from '../utils/format'

const TONES = { neutral: 'badge-neutral', success: 'badge-success', warning: 'badge-warning', danger: 'badge-danger', accent: 'badge-accent' }

export default function Badge({ tone = 'neutral', icon: Icon, children, className }) {
  return (
    <span className={cx('badge', TONES[tone], className)}>
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  )
}

/** Resume status badge. Status is always conveyed with text + icon, never colour alone. */
export function StatusBadge({ status }) {
  const map = {
    complete: { tone: 'success', icon: Check, label: 'Complete' },
    processing: { tone: 'accent', icon: Loader2, label: 'Processing' },
    failed: { tone: 'danger', icon: X, label: 'Failed' },
  }
  const s = map[status] || { tone: 'neutral', icon: Minus, label: status }
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>
}

