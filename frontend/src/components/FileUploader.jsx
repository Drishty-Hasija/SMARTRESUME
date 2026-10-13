import { useRef, useState } from 'react'
import { Check, FileText, Upload } from 'lucide-react'
import { cx } from '../utils/format'
import { ACCEPTED, MAX_MB, PROCESS_STEPS } from '../hooks/useResumeUpload'
import Button from './Button'
import { ErrorState, LoadingState } from './States'
import { ProgressBar } from './Progress'

/**
 * Technical document drop zone (DESIGN.md §25-26).
 * Controlled by `status`: idle | uploading | processing | complete | error.
 * Accessible: the real <input type=file> stays focusable inside the label.
 */
export default function FileUploader({
  status = 'idle', progress = 0, step = 0, fileName, error, onSelect, onReset,
  title = 'Upload resume', compact = false, steps = PROCESS_STEPS, completeLabel = 'Resume analyzed', children,
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const busy = status === 'uploading' || status === 'processing'
  const pad = compact ? 'px-5 py-8' : 'px-6 py-14 md:py-20'

  const pick = (files) => { const f = files?.[0]; if (f && onSelect) onSelect(f) }

  if (status === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState error={error} title={error?.message || "We couldn't read this file."} />
        <Button variant="secondary" icon={Upload} onClick={onReset}>Try another file</Button>
      </div>
    )
  }

  if (busy) {
    return (
      <div className={cx('rounded-lg border border-line bg-surface-soft text-center', pad)} aria-busy="true">
        <p className="mono mb-1 flex items-center justify-center gap-2 text-ink-muted"><FileText size={14} aria-hidden />{fileName}</p>
        {status === 'uploading' ? (
          <div className="mx-auto mt-4 w-full max-w-sm text-left">
            <div className="mb-2 flex justify-between"><span className="font-medium">Uploading…</span><span className="mono text-ink-muted">{progress}%</span></div>
            <ProgressBar value={progress} tone="accent" label="Upload progress" />
          </div>
        ) : (
          <div className="mt-5 text-left"><LoadingState steps={steps} current={step} /></div>
        )}
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div className={cx('rounded-lg border border-green-200 bg-success-soft text-center', compact ? 'px-5 py-8' : 'px-6 py-12')} role="status">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success text-white"><Check size={20} aria-hidden /></span>
        <p className="t-h4">{completeLabel}</p>
        <p className="mono mt-1 text-ink-soft">{fileName}</p>
        {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
      </div>
    )
  }

  return (
    <label
      htmlFor="resume-file"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files) }}
      className={cx(
        'group block cursor-pointer rounded-lg border border-dashed text-center transition-colors duration-150 ease-out focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-soft hover:border-accent hover:bg-accent-soft', pad,
      )}
    >
      <input
        id="resume-file" ref={inputRef} type="file" className="sr-only"
        accept={ACCEPTED.map((e) => `.${e}`).join(',')}
        onChange={(e) => { pick(e.target.files); e.target.value = '' }}
      />
      <Upload size={22} className={cx('mx-auto mb-3 transition-colors', dragging ? 'text-accent' : 'text-ink-soft group-hover:text-accent')} aria-hidden />
      <p className="t-h4">{dragging ? 'Drop to upload' : title}</p>
      <p className="mono mt-2 text-ink-muted">PDF, DOCX or TXT · Max {MAX_MB} MB</p>
      <p className="t-small mt-4 text-ink-muted">Drag a file here, or <span className="font-medium text-accent underline underline-offset-2">browse your files</span></p>
    </label>
  )
}
