import { ArrowRight, FileText } from 'lucide-react'
import { formatDate } from '../utils/format'
import { StatusBadge } from './Badge'
import Button from './Button'
import DataTable from './DataTable'

const dash = <span className="text-ink-muted">—</span>

/** Analysis history / recent analyses table. Reused by Dashboard and History. */
export default function HistoryTable({ items }) {
  const columns = [
    { key: 'filename', header: 'Resume', primary: true, render: (r) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <FileText size={16} className="shrink-0 text-ink-muted" aria-hidden />
        <span className="min-w-0"><span className="block truncate font-medium" title={r.filename}>{r.filename}</span>
          <span className="mono text-ink-muted">{r.file_type.toUpperCase()}</span></span>
      </span>) },
    { key: 'date', header: 'Date', render: (r) => <span className="whitespace-nowrap text-ink-soft">{formatDate(r.date)}</span> },
    { key: 'score', header: 'Score', render: (r) => r.score == null ? dash : <span className="mono font-medium text-ink">{Math.round(r.score)}<span className="text-ink-muted"> / 100</span></span> },
    { key: 'match', header: 'Job match', render: (r) => r.match_score == null ? dash : (
      <span title={r.match_job_title || ''}><span className="mono font-medium text-ink">{Math.round(r.match_score)}%</span>
        {r.match_count > 1 && <span className="t-small ml-1.5 text-ink-muted">+{r.match_count - 1} more</span>}</span>) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'action', header: <span className="sr-only">Action</span>, className: 'text-right', render: (r) => (
      <Button to={`/app/history/${r.resume_id}`} variant="ghost" size="sm" aria-label={`Open analysis of ${r.filename}`}>Open<ArrowRight size={14} aria-hidden /></Button>) },
  ]
  return <DataTable columns={columns} rows={items} rowKey={(r) => r.resume_id} caption="Analysis history" />
}
