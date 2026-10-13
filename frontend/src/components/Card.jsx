import { cx } from '../utils/format'

export function Card({ as: Tag = 'section', className, padded = true, children, ...rest }) {
  return <Tag className={cx('card', padded && 'p-5 md:p-6', className)} {...rest}>{children}</Tag>
}

/** Card heading: optional mono eyebrow, title, description and a right-aligned action. */
export function CardHeader({ eyebrow, title, description, action, className }) {
  return (
    <div className={cx('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="t-h4">{title}</h2>
        {description && <p className="t-small mt-1 text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export default Card
