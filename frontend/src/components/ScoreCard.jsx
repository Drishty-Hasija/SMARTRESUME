import { Info } from 'lucide-react'
import Card from './Card'
import { CircularScore, ProgressBar } from './Progress'

/** The one visually dominant card: score ring + label + explainable breakdown. */
export default function ScoreCard({ analysis }) {
  const rows = Object.entries(analysis.score_breakdown)
  return (
    <Card className="reveal">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
        <div className="flex items-center gap-6 md:flex-col md:items-start md:gap-4">
          <CircularScore value={analysis.score} />
          <div>
            <p className="eyebrow mb-1">Resume analysis score</p>
            <p className="t-h4">{analysis.score_label}</p>
            <p className="t-small mt-1 max-w-[220px] text-ink-muted">A transparent score from measurable parts of your resume. It is not an ATS score.</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-3">Score breakdown</p>
          <ul className="space-y-3.5">
            {rows.map(([key, c]) => (
              <li key={key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="font-medium">{c.label}</span>
                  {c.applicable
                    ? <span className="mono text-ink-soft">{Math.round(c.score)}%<span className="ml-2 text-ink-muted">weight {c.weight}</span></span>
                    : <span className="mono text-ink-muted">Not applicable</span>}
                </div>
                <ProgressBar value={c.applicable ? c.score : 0} label={`${c.label} score`} muted={!c.applicable} />
                <p className="t-small mt-1 text-ink-muted">{c.detail}</p>
              </li>
            ))}
          </ul>
          <p className="t-small mt-5 flex gap-2 text-ink-muted"><Info size={14} className="mt-0.5 shrink-0" aria-hidden />The overall score is the weighted average of the parts above. Parts marked "Not applicable" are left out and their weight is shared by the rest, so students without work history aren't penalised.</p>
        </div>
      </div>
    </Card>
  )
}
