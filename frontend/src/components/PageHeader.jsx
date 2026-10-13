import { cx } from '../utils/format'

export default function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cx('mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="t-h2 break-words">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
