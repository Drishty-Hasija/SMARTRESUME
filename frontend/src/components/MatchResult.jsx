import { Check, Info } from 'lucide-react'
import Card, { CardHeader } from './Card'
import { CircularScore, ProgressBar } from './Progress'
import SkillChip, { ChipList } from './SkillChip'
import Suggestions from './Suggestions'

function Component({ label, value, weight, help }) {
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        {value == null ? <span className="mono text-ink-muted">Not enough data</span>
          : <span className="mono text-ink-soft">{Math.round(value)}%<span className="ml-2 text-ink-muted">weight {Math.round(weight * 100)}%</span></span>}
      </div>
      <ProgressBar value={value ?? 0} tone="accent" label={label} muted={value == null} />
      <p className="t-small mt-1 text-ink-muted">{help}</p>
    </li>
  )
}

/** Job match report: score → what matched → what's missing → what to do next. */
export default function MatchResult({ match }) {
  const d = match.details
  const c = d.components
  const required = match.missing_skills.filter((s) => s.importance === 'required')
  const preferred = match.missing_skills.filter((s) => s.importance === 'preferred')
  const totalSkills = match.matching_skills.length + match.missing_skills.length
  const w = c.weights

  return (
    <div className="space-y-6">
      <Card className="reveal">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
          <div className="flex items-center gap-6">
            <CircularScore value={match.match_score} tone="accent" unit="%" suffix="match" size={140} />
            <div>
              <p className="eyebrow mb-1">Job match</p>
              <p className="t-h4">{d.verdict}</p>
              <p className="t-small mt-1 text-ink-muted">Resume / Job description</p>
              {totalSkills > 0 && <p className="mt-2 text-ink-soft">{match.matching_skills.length} of {totalSkills} skills from the job description were found in your resume.</p>}
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-3.5">
            <Component label="Skill match" value={c.skill_match} weight={w.skills} help="Required skills count fully, nice-to-have skills count half." />
            <Component label="Text similarity" value={c.text_similarity} weight={w.text} help="TF-IDF cosine similarity between the two documents. Raw values are naturally low, so this part is rescaled before it is combined." />
            <Component label="Keyword overlap" value={c.keyword_overlap} weight={w.keywords} help="Share of the job's important non-skill terms that also appear in your resume." />
          </ul>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="reveal">
          <CardHeader title="Matching skills" description={`${match.matching_skills.length} found in both`} />
          <ChipList items={match.matching_skills} empty="No skills from the job description were found in your resume."
            render={(s) => <SkillChip variant="matched" note={s.importance === 'preferred' ? 'nice to have' : undefined}>{s.name}</SkillChip>} />
        </Card>
        <Card className="reveal">
          <CardHeader title="Missing / not detected" description="In the job description but not found in your resume" />
          {match.missing_skills.length === 0 ? <p className="flex items-center gap-2 text-success"><Check size={16} aria-hidden />Nothing missing. Every skill in the posting was found.</p> : (
            <div className="space-y-4">
              {required.length > 0 && <div><p className="t-label mb-1.5 text-ink-muted">Required</p>
                <ChipList items={required} render={(s) => <SkillChip variant="missing">{s.name}</SkillChip>} /></div>}
              {preferred.length > 0 && <div><p className="t-label mb-1.5 text-ink-muted">Nice to have</p>
                <ChipList items={preferred} render={(s) => <SkillChip variant="missing">{s.name}</SkillChip>} /></div>}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="reveal">
          <CardHeader title="Keywords in both" description="Terms the job stresses that your resume also uses" />
          <ChipList items={match.matching_keywords} empty="No shared keywords found." render={(k) => <SkillChip variant="matched">{k}</SkillChip>} />
        </Card>
        <Card className="reveal">
          <CardHeader title="Keywords missing from your resume" description="Use them only where they honestly describe your work" />
          <ChipList items={match.missing_keywords} empty="None. Your resume covers the job's key terms." render={(k) => <SkillChip variant="missing">{k}</SkillChip>} />
        </Card>
      </div>

      {(d.experience_check?.required_years || d.extra_skills?.length > 0) && (
        <Card className="reveal">
          <CardHeader title="Other observations" />
          <dl className="divide-y divide-line">
            {d.experience_check?.required_years && (
              <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[200px_1fr] sm:gap-4">
                <dt className="t-label text-ink-muted">Experience asked for</dt>
                <dd>{d.experience_check.required_years}+ year(s). Your resume shows {d.experience_check.resume_years_mentioned != null ? `about ${d.experience_check.resume_years_mentioned} year(s)` : 'no dated experience'}.</dd>
              </div>
            )}
            {d.extra_skills?.length > 0 && (
              <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[200px_1fr] sm:gap-4">
                <dt className="t-label text-ink-muted">Extra skills you have</dt>
                <dd><ChipList items={d.extra_skills.slice(0, 14)} render={(s) => <SkillChip>{s}</SkillChip>} /></dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      <Card className="reveal">
        <CardHeader title="Next steps" description="Based on the gaps found above." />
        <Suggestions items={d.suggestions} />
      </Card>

      <p className="t-small flex gap-2 text-ink-muted"><Info size={14} className="mt-0.5 shrink-0" aria-hidden />{d.disclaimer}</p>
    </div>
  )
}

