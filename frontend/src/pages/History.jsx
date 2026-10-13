import { useState } from 'react'
import { ArrowDown, ArrowUp, History as HistoryIcon, Search, Upload } from 'lucide-react'
import Button from '../components/Button'
import { Input, Select } from '../components/Form'
import HistoryTable from '../components/HistoryTable'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorState, PageSkeleton } from '../components/States'
import { useAsync, useDebounced } from '../hooks/useAsync'
import { api } from '../services/api'

const DEFAULTS = { q: '', file_type: '', status: '', has_match: '', sort: 'date', order: 'desc' }

export default function History() {
  const [f, setF] = useState(DEFAULTS)
  const q = useDebounced(f.q)
  const { data, error, loading, reload } = useAsync(
    () => api.history({ q: q.trim(), file_type: f.file_type, status: f.status, has_match: f.has_match, sort: f.sort, order: f.order }),
    [q, f.file_type, f.status, f.has_match, f.sort, f.order],
  )
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const filtered = f.q || f.file_type || f.status || f.has_match

  return (
    <>
      <PageHeader eyebrow="History" title="Analysis history" description="Every resume you've analyzed, with its score and latest job match."
        actions={<Button to="/app/upload" icon={Upload}>Upload Resume</Button>} />

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input type="search" aria-label="Search by resume or job title" placeholder="Search resume or job title" className="pl-9" value={f.q} onChange={set('q')} />
        </div>
        <Select aria-label="File type" value={f.file_type} onChange={set('file_type')} className="md:w-36"><option value="">All types</option><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="txt">TXT</option></Select>
        <Select aria-label="Status" value={f.status} onChange={set('status')} className="md:w-36"><option value="">Any status</option><option value="complete">Complete</option><option value="failed">Failed</option></Select>
        <Select aria-label="Job match" value={f.has_match} onChange={set('has_match')} className="md:w-40"><option value="">Match: any</option><option value="true">With a match</option><option value="false">No match yet</option></Select>
        <Select aria-label="Sort by" value={f.sort} onChange={set('sort')} className="md:w-36"><option value="date">Sort: date</option><option value="score">Sort: score</option><option value="match">Sort: match</option><option value="name">Sort: name</option></Select>
        <Button variant="secondary" aria-label={`Order: ${f.order === 'desc' ? 'descending' : 'ascending'}. Click to reverse`} onClick={() => setF((s) => ({ ...s, order: s.order === 'desc' ? 'asc' : 'desc' }))}>
          {f.order === 'desc' ? <ArrowDown size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}<span className="md:sr-only">{f.order === 'desc' ? 'Descending' : 'Ascending'}</span>
        </Button>
      </div>

      {loading && !data ? <PageSkeleton rows={2} /> : error ? <ErrorState error={error} onRetry={reload} /> : data.items.length === 0 ? (
        filtered ? (
          <EmptyState icon={Search} title="No analyses match your filters" action={<Button variant="secondary" onClick={() => setF(DEFAULTS)}>Clear filters</Button>}>Try a different search term or remove a filter.</EmptyState>
        ) : (
          <EmptyState icon={HistoryIcon} title="No history yet" action={<Button to="/app/upload" icon={Upload}>Upload Resume</Button>}>Your analyzed resumes will be listed here.</EmptyState>
        )
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <p className="t-small mb-3 text-ink-muted" aria-live="polite">{data.total} analys{data.total === 1 ? 'is' : 'es'}{filtered && ' found'}</p>
          <HistoryTable items={data.items} />
        </div>
      )}
    </>
  )
}
