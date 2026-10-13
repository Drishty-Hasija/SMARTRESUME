import { useState } from 'react'
import { FileSearch, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import FileUploader from '../components/FileUploader'
import PageHeader from '../components/PageHeader'
import { ErrorState } from '../components/States'
import { useResumeUpload } from '../hooks/useResumeUpload'
import { api } from '../services/api'

export default function Upload() {
  const upload = useResumeUpload()
  const navigate = useNavigate()
  const [sampleBusy, setSampleBusy] = useState(false)
  const [sampleError, setSampleError] = useState(null)
  const id = upload.result?.id

  const loadSample = async () => {
    setSampleBusy(true); setSampleError(null)
    try { const r = await api.loadSample(); navigate(`/app/analysis/${r.resume_id}`) } catch (e) { setSampleError(e); setSampleBusy(false) }
  }

  return (
    <>
      <PageHeader eyebrow="Resume Analysis" title="Upload your resume"
        description="We extract the text, then detect skills, sections, keywords and entities. Your file is stored only on this machine." />
      <div className="mx-auto max-w-3xl">
        <FileUploader {...upload} onSelect={upload.start} onReset={upload.reset}>
          <Button to={`/app/analysis/${id}`} icon={FileSearch}>View analysis</Button>
          <Button to={`/app/match?resume=${id}`} variant="secondary" icon={Target}>Match a job</Button>
          <Button variant="ghost" onClick={upload.reset}>Upload another resume</Button>
        </FileUploader>

        {upload.status === 'idle' && (
          <div className="mt-8 border-t border-line pt-6">
            <p className="font-medium">No resume at hand?</p>
            <p className="t-small mt-1 text-ink-muted">Load a sample resume and a sample job description to explore every feature.</p>
            <Button variant="secondary" className="mt-4" loading={sampleBusy} onClick={loadSample}>Use sample data</Button>
            {sampleError && <div className="mt-4"><ErrorState error={sampleError} compact /></div>}
          </div>
        )}
        {upload.status === 'idle' && (
          <ul className="t-small mt-8 grid gap-3 text-ink-muted sm:grid-cols-3">
            <li><span className="mono mb-1 block text-ink">Text-based files</span>Scanned images can't be read; export a text PDF.</li>
            <li><span className="mono mb-1 block text-ink">Private</span>Everything runs locally. No external AI service.</li>
            <li><span className="mono mb-1 block text-ink">Any layout</span>Standard headings like Education and Skills work best.</li>
          </ul>
        )}
      </div>
    </>
  )
}
