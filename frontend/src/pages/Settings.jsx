import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Card, { CardHeader } from '../components/Card'
import { Field, Input } from '../components/Form'
import PageHeader from '../components/PageHeader'
import { ErrorState, PageSkeleton } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { useUser } from '../hooks/UserContext'
import { api } from '../services/api'

const fieldErrors = (err) => Object.fromEntries((err?.details || []).map((d) => [d.field, d.message]))

export default function Settings() {
  const { user, setUser } = useUser()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [sampleBusy, setSampleBusy] = useState(false)

  const profile = useAsync(() => api.getUser(), [])
  const health = useAsync(() => api.health().then(() => true), [])
  const skills = useAsync(() => api.skills(), [])

  useEffect(() => { const u = user || profile.data; if (u) { setName(u.name); setEmail(u.email) } }, [user, profile.data])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setSaved(false); setError(null)
    try { setUser(await api.updateUser({ name, email })); setSaved(true) } catch (err) { setError(err) } finally { setSaving(false) }
  }
  const sample = async () => {
    setSampleBusy(true)
    try { const r = await api.loadSample(); navigate(`/app/analysis/${r.resume_id}`) } catch (err) { setError(err); setSampleBusy(false) }
  }

  if (profile.loading && !profile.data) return <PageSkeleton rows={2} />
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.reload} />
  const fe = fieldErrors(error)

  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" description="Your profile and information about this installation." />
      <div className="grid max-w-4xl gap-6">
        <Card>
          <CardHeader title="Profile" description="Shown in the top bar. SmartResume has a single local user and no login." />
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Name" error={fe.name}>{(p) => <Input {...p} value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} maxLength={120} required error={fe.name} autoComplete="name" />}</Field>
            <Field label="Email" error={fe.email}>{(p) => <Input {...p} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false) }} required error={fe.email} autoComplete="email" />}</Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" loading={saving}>Save changes</Button>
              <span aria-live="polite" className="t-small flex items-center gap-1.5 text-success">{saved && <><Check size={14} aria-hidden />Saved</>}</span>
            </div>
            {error && !Object.keys(fe).length && <div className="sm:col-span-2"><ErrorState error={error} compact /></div>}
          </form>
        </Card>

        <Card>
          <CardHeader title="Sample data" description="Adds a sample resume and a sample job description so you can try every feature." />
          <Button variant="secondary" loading={sampleBusy} onClick={sample}>Load sample data</Button>
        </Card>

        <Card>
          <CardHeader title="About this installation" />
          <dl className="divide-y divide-line">
            <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[200px_1fr]"><dt className="t-label text-ink-muted">Backend API</dt>
              <dd>{health.loading ? 'Checking…' : health.data ? <span className="inline-flex items-center gap-1.5 text-success"><Check size={14} aria-hidden />Connected</span> : <span className="text-danger">Not reachable. Start the backend on port 8000.</span>}</dd></div>
            <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]"><dt className="t-label text-ink-muted">Skill dictionary</dt>
              <dd>{skills.data ? `${skills.data.total_skills} skills in ${Object.keys(skills.data.categories).length} categories (editable in data/skills.json)` : '—'}</dd></div>
            <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]"><dt className="t-label text-ink-muted">Techniques</dt>
              <dd className="text-ink-soft">NLTK tokenization, stop-words and lemmatization · spaCy named entities · TF-IDF · cosine similarity · rule-based skill and section detection.</dd></div>
            <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[200px_1fr]"><dt className="t-label text-ink-muted">What it is not</dt>
              <dd className="text-ink-soft">Not an ATS score, not a hiring prediction, and no generative AI. Everything is computed locally from your text.</dd></div>
          </dl>
        </Card>
      </div>
    </>
  )
}
