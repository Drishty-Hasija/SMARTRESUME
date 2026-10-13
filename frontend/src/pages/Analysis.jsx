import { useState } from 'react'
import { FileSearch, RefreshCw, Target, Upload } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import { Select } from '../components/Form'
import PageHeader from '../components/PageHeader'
import ResumeReport from '../components/ResumeReport'
import { EmptyState, ErrorState, PageSkeleton } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'

/** Latest (or selected) resume analysis. Route: /app/analysis[/:id] */
export default function Analysis() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const list = useAsync(() => api.resumes(), [])
  const targetId = id || list.data?.[0]?.id
  const detail = useAsync(() => (targetId ? api.resume(targetId) : Promise.resolve(null)), [targetId])

  if (list.loading && !list.data) return <PageSkeleton rows={2} />
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (!list.data.length) {
    return (<>
      <PageHeader eyebrow="Resume Analysis" title="Resume analysis" />
      <EmptyState icon={FileSearch} title="No resume analyzed yet" action={<Button to="/app/upload" icon={Upload}>Upload Resume</Button>}>
        Upload your resume to see your skills, keywords and section breakdown.
      </EmptyState>
    </>)
  }
  if (detail.loading && !detail.data) return <PageSkeleton rows={3} />
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />
  const resume = detail.data
  if (!resume) return null

  const rerun = async () => {
    setBusy(true); setActionError(null)
    try { await api.reanalyze(resume.id); await detail.reload() } catch (e) { setActionError(e) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader eyebrow="Resume Analysis" title={resume.filename} description="What the NLP pipeline found in your resume."
        actions={<>
          {list.data.length > 1 && (
            <Select aria-label="Choose resume" value={resume.id} onChange={(e) => navigate(`/app/analysis/${e.target.value}`)} className="w-56">
              {list.data.map((r) => <option key={r.id} value={r.id}>{r.filename}</option>)}
            </Select>)}
          <Button variant="secondary" icon={RefreshCw} loading={busy} onClick={rerun}>Re-analyze</Button>
          <Button to={`/app/match?resume=${resume.id}`} icon={Target}>Match a job</Button>
        </>} />
      {actionError && <ErrorState error={actionError} compact className="mb-6" />}
      {resume.analysis
        ? <ResumeReport resume={resume} />
        : <ErrorState title="This resume hasn't been analyzed yet." onRetry={rerun} />}
    </>
  )
}
