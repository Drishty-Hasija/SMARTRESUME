import { cx } from '../utils/format'

/**
 * Responsive table. ≥ md: compact bordered table. < md: each row becomes a stacked
 * card (labels shown) instead of squeezing columns.
 * columns: [{ key, header, render?(row), className?, primary? }]
 */
export default function DataTable({ columns, rows, rowKey = (r) => r.id, caption }) {
  return (
    <>
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b border-line bg-surface-soft/60">
                {columns.map((c) => <th key={c.key} scope="col" className={cx('t-label px-4 py-2.5 font-medium text-ink-muted', c.className)}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-line last:border-0 transition-colors duration-150 hover:bg-surface-soft/60">
                  {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 align-middle', c.className)}>{c.render ? c.render(row) : row[c.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="card space-y-2 p-4">
            {columns.map((c) => (
              <div key={c.key} className={cx('flex items-center justify-between gap-4', c.primary && 'pb-2 border-b border-line')}>
                {!c.primary && <span className="t-label text-ink-muted">{c.header}</span>}
                <span className={cx('min-w-0', c.primary ? 'w-full font-medium' : 'text-right')}>{c.render ? c.render(row) : row[c.key]}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  )
}
