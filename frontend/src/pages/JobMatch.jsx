import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Target, Upload, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import Button from '../components/Button'
import Card, { CardHeader } from '../components/Card'
import { Field, Input, Select, Textarea } from '../components/Form'
import MatchResult from '../components/MatchResult'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState, PageSkeleton } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { cx, formatDate } from '../utils/format'

const STEPS = ['Reading job description', 'Processing language', 'Comparing skills', 'Calculating similarity']
const MAX_CHARS = 30000
const TABS = [['paste', 'Paste text'], ['upload', 'Upload file'], ['saved', 'Saved jobs']]

function Tabs({ value, onChange }) {
  return (
    <div role="tablist" aria-label="Job description source" className="mb-4 inline-flex rounded border border-line bg-surface-soft p-0.5">
      {TABS.map(([k, label]) => (
        <button key={k} role="tab" type="button" id={`tab-${k}`} aria-selected={value === k} aria-controls={`panel-${k}`}
          onClick={() => onChange(k)}
          className={cx('h-8 rounded-sm px-3 text-[13px] font-medium transition-colors duration-150', value === k ? 'bg-surface text-ink shadow-[0_0_0_1px_#E4E4E7]' : 'text-ink-muted hover:text-ink')}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function JobMatch() {
  const [params, setParams] = useSearchParams()
  const resumes = useAsync(() => api.resumes(), [])
  const jobs = useAsync(() => api.jobs(), [])

  const [resumeId, setResumeId] = useState(params.get('resume') || '')
  const [mode, setMode] = useState('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [savedId, setSavedId] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)
  const resultRef = useRef(null)

  // default to the newest resume
  useEffect(() => { if (!resumeId && resumes.data?.length) setResumeId(String(resumes.data[0].id)) }, [resumes.data, resumeId])

  // open a saved match: /app/match?match=ID
  const matchParam = params.get('match')
  useEffect(() => {
    if (!matchParam) return
    api.getMatch(matchParam).then((m) => { setResult(m); setResumeId(String(m.resume_id)) }).catch(setError)
  }, [matchParam])

  const resume = useAsync(() => (resumeId ? api.resume(resumeId) : Promise.resolve(null)), [resumeId])
  const excerpt = useMemo(() => (resume.data?.raw_text || '').slice(0, 1800), [resume.data])

  const reset = () => { setResult(null); setError(null); if (matchParam) setParams({}) }

  const compare = async () => {
    setError(null); setFieldError(null)
    if (mode === 'paste' && !text.trim()) return setFieldError({ message: 'The job description is empty.', hint: 'Paste the role and requirements text.' })
    if (mode === 'paste' && text.length > MAX_CHARS) return setFieldError({ message: `This is longer than ${MAX_CHARS.toLocaleString()} characters.` })
    if (mode === 'upload' && !file) return setFieldError({ message: 'Choose a job description file.', hint: 'PDF, DOCX or TXT.' })
    if (mode === 'saved' && !savedId) return setFieldError({ message: 'Select a saved job description.' })

    setRunning(true); setResult(null); setStep(mode === 'saved' ? 2 : 0)
    const t = mode === 'saved' ? null : setTimeout(() => setStep(1), 600)
    try {
      let jobId = savedId
      if (mode !== 'saved') {
        const job = mode === 'paste' ? await api.createJob(title.trim(), text) : await api.uploadJob(file, title.trim())
        jobId = job.id
        jobs.reload()
      }
      setStep(2)
      const t2 = setTimeout(() => setStep(3), 500)
      const m = await api.match(Number(resumeId), Number(jobId))
      clearTimeout(t2)
      setResult(m)
      setTimeout(() => resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50)
    } catch (e) {
      setError(e)
    } finally {
      clearTimeout(t); setRunning(false)
    }
  }

  if (resumes.loading && !resumes.data) return <PageSkeleton rows={2} />
  if (resumes.error) return <ErrorState error={resumes.error} onRetry={resumes.reload} />
  if (!resumes.data.length) {
    return (<>
      <PageHeader eyebrow="Job Matching" title="Match a job" />
      <EmptyState icon={Target} title="Upload a resume first" action={<Button to="/app/upload" icon={Upload}>Upload Resume</Button>}>
        Job matching compares a job description with a resume you've analyzed.
      </EmptyState>
    </>)
  }

  const canRun = !running && resumeId

  return (
    <>
      <PageHeader eyebrow="Job Matching" title="Compare your resume with a job"
        description="Paste or upload a job description. We'll compare the text and skills of both documents." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Resume */}
        <Card>
          <CardHeader title="Resume" description="The text extracted from your file" />
          <Field label="Resume to compare">{(p) => (
            <Select {...p} value={resumeId} onChange={(e) => { setResumeId(e.target.value); reset() }} disabled={running}>
              {resumes.data.map((r) => <option key={r.id} value={r.id}>{r.filename}</option>)}
            </Select>)}
          </Field>
          <p className="t-label mb-1.5 mt-5 flex justify-between text-ink-muted"><span>Extracted content</span>{resume.data && <span className="mono">{resume.data.word_count ?? '—'} words</span>}</p>
          <div className="h-[280px] overflow-auto rounded border border-line bg-surface-soft p-3 text-[13px] leading-relaxed text-ink-soft" tabIndex={0} aria-label="Extracted resume text">
            {resume.loading ? <span className="text-ink-muted">Loading…</span> : resume.error ? <span className="text-danger">{resume.error.message}</span>
              : <pre className="whitespace-pre-wrap font-sans">{excerpt}{(resume.data?.raw_text.length || 0) > 1800 && '\n…'}</pre>}
          </div>
        </Card>

        {/* Job description */}
        <Card>
          <CardHeader title="Job description" description="Required skills, keywords and qualifications are read from it" />
          <Tabs value={mode} onChange={(m) => { setMode(m); setFieldError(null) }} />

          <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
            {mode !== 'saved' && <Field label="Job title" optional className="mb-4">{(p) => <Input {...p} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Junior Full Stack Developer" disabled={running} />}</Field>}

            {mode === 'paste' && (
              <Field label="Job description text" error={fieldError?.message} hint={fieldError?.hint}>{(p) => (
                <>
                  <Textarea {...p} value={text} onChange={(e) => { setText(e.target.value); setFieldError(null) }} error={fieldError} disabled={running} placeholder="Paste the full job posting here…" />
                  <p className={cx('mono mt-1.5 text-right', text.length > MAX_CHARS ? 'text-danger' : 'text-ink-muted')}>{text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</p>
                </>)}
              </Field>
            )}

            {mode === 'upload' && (
              <div>
                <input ref={fileRef} id="jd-file" type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] || null); setFieldError(null) }} />
                <label htmlFor="jd-file" className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface-soft px-4 py-10 text-center transition-colors hover:border-accent hover:bg-accent-soft focus-within:outline focus-within:outline-2 focus-within:outline-accent">
                  <FileUp size={20} className="mb-2 text-ink-soft" aria-hidden />
                  <span className="font-medium">{file ? file.name : 'Choose a job description file'}</span>
                  <span className="mono mt-1 text-ink-muted">PDF, DOCX or TXT · Max 10 MB</span>
                </label>
                {file && <Button variant="ghost" size="sm" className="mt-2" icon={X} onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>Remove file</Button>}
                {fieldError && <p role="alert" className="t-small mt-2 text-danger">{fieldError.message}</p>}
              </div>
            )}

            {mode === 'saved' && (
              <fieldset>
                <legend className="t-label mb-2 text-ink">Choose a saved job description</legend>
                {jobs.data?.length ? (
                  <ul className="max-h-[300px] divide-y divide-line overflow-auto rounded border border-line">
                    {jobs.data.map((j) => (
                      <li key={j.id}>
                        <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-surface-soft has-[:checked]:bg-accent-soft">
                          <input type="radio" name="saved-job" value={j.id} checked={String(savedId) === String(j.id)} onChange={() => { setSavedId(String(j.id)); setFieldError(null) }} className="mt-1 accent-[#2563EB]" />
                          <span className="min-w-0"><span className="block truncate font-medium">{j.title}</span>
                            <span className="t-small text-ink-muted">{formatDate(j.created_at)} · {j.skill_count} skills · {j.word_count} words</span></span>
                        </label>
                      </li>))}
                  </ul>
                ) : <p className="rounded border border-dashed border-line-strong p-4 text-ink-muted">No saved job descriptions yet. Paste one on the first tab and it will be saved here.</p>}
                {fieldError && <p role="alert" className="t-small mt-2 text-danger">{fieldError.message}</p>}
              </fieldset>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" icon={Target} onClick={compare} disabled={!canRun} loading={running}>{running ? 'Matching…' : 'Compare resume with job'}</Button>
        {result && !running && <Button variant="ghost" size="lg" onClick={reset}>Clear result</Button>}
      </div>

      {running && <div className="card mt-8 p-8"><LoadingState steps={STEPS} current={step} title="Matching job description…" /></div>}
      {error && !running && <div className="mt-8"><ErrorState error={error} onRetry={compare} /></div>}

      {result && !running && (
        <section ref={resultRef} className="mt-10 scroll-mt-24" aria-labelledby="result-h">
          <div className="mb-5 border-t border-line pt-8">
            <p className="eyebrow mb-1">Result</p>
            <h2 id="result-h" className="t-h3 break-words">{result.job_title}</h2>
            <p className="mt-1 text-ink-muted">compared with <span className="font-medium text-ink-soft">{result.resume_filename}</span></p>
          </div>
          <MatchResult match={result} />
        </section>
      )}
    </>
  )
}
