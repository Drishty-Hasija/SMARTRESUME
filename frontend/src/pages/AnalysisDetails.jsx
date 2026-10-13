import { useState } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Target, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import Card, { CardHeader } from '../components/Card'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import ResumeReport from '../components/ResumeReport'
import { ErrorState, PageSkeleton } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { formatDateTime } from '../utils/format'

/** Detailed historical report: the full analysis plus every job match for this resume. */
export default function AnalysisDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: resume, error, loading, reload } = useAsync(() => api.resume(id), [id])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  if (loading && !resume) return <PageSkeleton rows={3} />
  if (error) return (<>
    <Button to="/app/history" variant="ghost" icon={ArrowLeft} className="mb-4 -ml-3">Back to history</Button>
    <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />
  </>)

  const rerun = async () => { setBusy(true); setActionError(null); try { await api.reanalyze(id); await reload() } catch (e) { setActionError(e) } finally { setBusy(false) } }
  const remove = async () => {
    setBusy(true)
    try { await api.deleteResume(id); navigate('/app/history') } catch (e) { setActionError(e); setConfirm(false); setBusy(false) }
  }

  const matchColumns = [
    { key: 'job_title', header: 'Job', primary: true, render: (m) => <span className="font-medium">{m.job_title}</span> },
    { key: 'score', header: 'Match', render: (m) => <span className="mono font-medium">{Math.round(m.match_score)}%</span> },
    { key: 'verdict', header: 'Result', render: (m) => <span className="text-ink-soft">{m.verdict}</span> },
    { key: 'skills', header: 'Skills', render: (m) => <span className="t-small text-ink-muted">{m.matching_skill_count} matched · {m.missing_skill_count} missing</span> },
    { key: 'date', header: 'Date', render: (m) => <span className="whitespace-nowrap text-ink-soft">{formatDateTime(m.created_at)}</span> },
    { key: 'open', header: <span className="sr-only">Open</span>, className: 'text-right', render: (m) => <Button to={`/app/match?match=${m.id}`} variant="ghost" size="sm" aria-label={`Open match with ${m.job_title}`}>Open<ArrowRight size={14} aria-hidden /></Button> },
  ]

  return (
    <>
      <Link to="/app/history" className="t-small mb-4 -ml-1 inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />Back to history</Link>
      <PageHeader eyebrow={`Analysis #${resume.id} · ${resume.analysis_count} run${resume.analysis_count !== 1 ? 's' : ''}`} title={resume.filename}
        description="Full report from the stored analysis."
        actions={<>
          <Button variant="secondary" icon={RefreshCw} loading={busy && !confirm} onClick={rerun}>Re-analyze</Button>
          <Button to={`/app/match?resume=${resume.id}`} icon={Target}>Match a job</Button>
          <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)} aria-label="Delete this analysis" className="text-danger hover:text-danger" />
        </>} />
      {actionError && <ErrorState error={actionError} compact className="mb-6" />}

      {resume.analysis ? <ResumeReport resume={resume} /> : <ErrorState title="This resume has no stored analysis." onRetry={rerun} />}

      <Card className="mt-6">
        <CardHeader title="Job matches" description="Comparisons run for this resume" />
        {resume.matches.length ? <DataTable columns={matchColumns} rows={resume.matches} caption="Job matches" />
          : <p className="text-ink-muted">No job matches yet. <Link to={`/app/match?resume=${resume.id}`} className="text-accent underline underline-offset-2">Compare with a job description</Link>.</p>}
      </Card>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this analysis?"
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={remove}>Delete</Button></>}>
        <p><span className="font-medium text-ink">{resume.filename}</span>, its analysis and its {resume.matches.length} job match{resume.matches.length !== 1 && 'es'} will be permanently removed.</p>
      </Modal>
    </>
  )
}
