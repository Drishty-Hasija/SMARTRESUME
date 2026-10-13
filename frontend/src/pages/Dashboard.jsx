import { useState } from 'react'
import { ArrowRight, FileSearch, History, Target, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Card, { CardHeader } from '../components/Card'
import FileUploader from '../components/FileUploader'
import HistoryTable from '../components/HistoryTable'
import PageHeader from '../components/PageHeader'
import { CircularScore, ProgressBar } from '../components/Progress'
import SkillChip, { ChipList } from '../components/SkillChip'
import { EmptyState, ErrorState, PageSkeleton } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { useResumeUpload } from '../hooks/useResumeUpload'
import { api } from '../services/api'
import { formatDate } from '../utils/format'

const ACTIONS = [
  { to: '/app/analysis', icon: FileSearch, title: 'Analyze Resume', text: 'Open your latest analysis' },
  { to: '/app/match', icon: Target, title: 'Match Job', text: 'Compare with a job description' },
  { to: '/app/history', icon: History, title: 'View History', text: 'Browse previous analyses' },
]

function SampleButton({ onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const run = async () => {
    setBusy(true); setError(null)
    try { const r = await api.loadSample(); onDone(r) } catch (e) { setError(e); setBusy(false) }
  }
  return (<>
    <Button variant="secondary" loading={busy} onClick={run}>Try with sample data</Button>
    {error && <div className="mt-3 w-full text-left"><ErrorState error={error} compact /></div>}
  </>)
}

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(() => api.dashboard(), [])
  const upload = useResumeUpload()
  const navigate = useNavigate()

  if (loading && !data) return <PageSkeleton rows={4} />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { user, totals, latest_resume: resume, latest_analysis: a, latest_match: m, top_skills: skills, recent } = data
  const first = (user.name || 'there').split(' ')[0]

  const onSelect = async (file) => { const r = await upload.start(file); if (r) { reload(); navigate(`/app/analysis/${r.id}`) } }

  if (!resume) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title={`Welcome, ${first}`} description="Your resume, understood as data." />
        <EmptyState icon={Upload} title="No resume analyzed yet"
          action={<Button to="/app/upload" icon={Upload}>Upload Resume</Button>}
          secondary={<SampleButton onDone={(r) => navigate(`/app/analysis/${r.resume_id}`)} />}>
          Upload your resume to see your skills, keywords and section breakdown, or try the app with sample data.
        </EmptyState>
      </>
    )
  }

  const rows = ['sections', 'skills', 'keywords', 'experience', 'projects'].map((k) => a.score_breakdown[k])

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Welcome back, ${first}`}
        description={<span className="mono">{totals.resumes} resume{totals.resumes !== 1 && 's'} · {totals.matches} job comparison{totals.matches !== 1 && 's'}{totals.average_score != null && ` · average score ${Math.round(totals.average_score)}`}</span>}
        actions={<Button to="/app/upload" icon={Upload}>Upload Resume</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="reveal lg:col-span-2">
          <CardHeader eyebrow="Latest analysis" title={resume.filename} description={`Analyzed ${formatDate(a.created_at)}`}
            action={<Button to={`/app/analysis/${resume.id}`} variant="ghost" size="sm">Full report<ArrowRight size={14} aria-hidden /></Button>} />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex items-center gap-5 sm:block">
              <CircularScore value={a.score} size={124} />
              <p className="t-small mt-0 text-ink-soft sm:mt-3"><span className="block font-medium text-ink">Resume analysis score</span>{a.score_label}</p>
            </div>
            <ul className="min-w-0 flex-1 space-y-3">
              {rows.map((r) => (
                <li key={r.label}>
                  <div className="mb-1 flex justify-between"><span className="t-small font-medium">{r.label}</span>
                    <span className="mono text-ink-soft">{r.applicable ? `${Math.round(r.score)}%` : 'N/A'}</span></div>
                  <ProgressBar value={r.applicable ? r.score : 0} muted={!r.applicable} label={`${r.label} score`} />
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="reveal">
          <CardHeader eyebrow="Latest job match" title={m ? m.job_title : 'No job match yet'} />
          {m ? (
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-4">
                <CircularScore value={m.match_score} tone="accent" unit="%" suffix="match" size={96} />
                <div><p className="font-medium">{m.details.verdict}</p>
                  <p className="t-small text-ink-muted">{m.matching_skill_count} skills matched · {m.missing_skill_count} not detected</p></div>
              </div>
              <Button to={`/app/match?match=${m.id}`} variant="secondary" size="sm">View match<ArrowRight size={14} aria-hidden /></Button>
            </div>
          ) : (
            <div><p className="text-ink-soft">Compare your resume with a job description.</p>
              <Button to="/app/match" className="mt-4" icon={Target}>Match a Job</Button></div>
          )}
        </Card>

        <Card className="reveal lg:col-span-2">
          <CardHeader eyebrow="From your latest resume" title="Skills detected"
            description={`${a.stats.skill_count} skills across ${Object.keys(a.skills.by_category).length} categories`} />
          <ChipList items={skills} render={(s) => <SkillChip variant="detected">{s.name}</SkillChip>} />
          {a.stats.skill_count > skills.length && <p className="t-small mt-3 text-ink-muted">Showing the top {skills.length}. <Link to={`/app/analysis/${resume.id}`} className="text-accent underline underline-offset-2">See all</Link></p>}
        </Card>

        <Card className="reveal">
          <CardHeader title="Quick actions" />
          <ul className="-mx-2 mb-5 divide-y divide-line">
            {ACTIONS.map((x) => (
              <li key={x.to}><Link to={x.to} className="group flex items-center gap-3 rounded px-2 py-3 hover:bg-surface-soft">
                <x.icon size={18} className="text-ink-soft" aria-hidden />
                <span className="min-w-0 flex-1"><span className="block font-medium">{x.title}</span><span className="t-small text-ink-muted">{x.text}</span></span>
                <ArrowRight size={14} className="text-ink-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link></li>
            ))}
          </ul>
          <FileUploader compact title="Analyze another resume" {...upload} onSelect={onSelect} onReset={upload.reset} />
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="recent">
        <div className="mb-4 flex items-center justify-between"><h2 id="recent" className="t-h4">Recent analyses</h2>
          <Button to="/app/history" variant="ghost" size="sm">View all<ArrowRight size={14} aria-hidden /></Button></div>
        <HistoryTable items={recent} />
      </section>
    </>
  )
}
