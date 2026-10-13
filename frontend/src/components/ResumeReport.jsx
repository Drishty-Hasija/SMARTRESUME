import { Check, Minus } from 'lucide-react'
import { formatBytes, formatDateTime } from '../utils/format'
import Badge from './Badge'
import Card, { CardHeader } from './Card'
import { ChipList } from './SkillChip'
import SkillChip from './SkillChip'
import ScoreCard from './ScoreCard'
import SectionStatus from './SectionStatus'
import SkillChart from './SkillChart'
import Suggestions from './Suggestions'

function Fact({ label, children }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="t-label text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
const none = <span className="text-ink-muted">Not detected</span>

/** Entities rewritten as plain facts (not raw NER output). */
function Entities({ entities: e }) {
  const contact = e.contact || {}
  const contactItems = [['Email', contact.email], ['Phone', contact.phone], ['LinkedIn', contact.linkedin], ['GitHub', contact.github], ['Website', contact.website]]
  const edu = e.education || {}
  return (
    <dl className="divide-y divide-line">
      <Fact label="Name">{e.name || none}</Fact>
      <Fact label="Contact details">
        <ul className="flex flex-wrap gap-1.5">
          {contactItems.map(([label, val]) => (
            <li key={label}>
              <SkillChip variant={val ? 'detected' : 'default'} className={val ? '' : 'text-ink-muted'}>
                {label}{!val && <span className="sr-only"> not found</span>}
              </SkillChip>
            </li>
          ))}
        </ul>
      </Fact>
      <Fact label="Education">
        {edu.degrees?.length || edu.institutions?.length ? (
          <div className="space-y-0.5">
            {edu.degrees?.length > 0 && <p>{edu.degrees.join(', ')}</p>}
            {edu.institutions?.length > 0 && <p className="text-ink-soft">{edu.institutions.join(', ')}</p>}
            {edu.grades?.length > 0 && <p className="mono text-ink-muted">{edu.grades.join(' · ')}</p>}
          </div>
        ) : none}
      </Fact>
      <Fact label="Organizations">{e.organizations?.length ? e.organizations.join(', ') : none}</Fact>
      <Fact label="Locations">{e.locations?.length ? e.locations.join(', ') : none}</Fact>
      <Fact label="Dates found">{e.dates?.length ? <span className="mono">{e.dates.join('  ·  ')}</span> : none}</Fact>
      <Fact label="Experience length">
        {e.estimated_experience_years != null ? `About ${e.estimated_experience_years} year(s) from dated roles` : none}
      </Fact>
    </dl>
  )
}

/**
 * The full analysis, in the order from DESIGN.md §35:
 * summary → score → breakdown → skills → sections → keywords → entities → suggestions.
 */
export default function ResumeReport({ resume }) {
  const a = resume.analysis
  const skills = a.skills
  const categories = Object.entries(skills.by_category)
  const byCount = Object.fromEntries(categories.map(([c, list]) => [c, list.length]))
  const detectedBySkill = Object.fromEntries(skills.items.map((s) => [s.name, s]))

  return (
    <div className="space-y-6">
      {/* 1 · Resume summary */}
      <Card padded={false} className="reveal">
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          {[
            ['File', <span key="f" className="block truncate" title={resume.filename}>{resume.filename}</span>],
            ['Type · size', <span key="t" className="mono">{resume.file_type.toUpperCase()} · {formatBytes(resume.file_size)}</span>],
            ['Analyzed', formatDateTime(a.created_at)],
            ['Words', `${a.stats.word_count} (~${a.stats.estimated_pages} page${a.stats.estimated_pages > 1 ? 's' : ''})`],
            ['Skills found', a.stats.skill_count],
            ['Sections', `${a.stats.section_count} headed`],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 border-b border-line p-4 last:border-b-0 sm:[&:nth-child(n+4)]:border-b-0 lg:border-b-0">
              <dt className="t-label text-ink-muted">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* 2 · Score + breakdown */}
      <ScoreCard analysis={a} />

      {/* 3 · Skills */}
      <Card className="reveal">
        <CardHeader eyebrow="Rule-based dictionary match" title="Detected skills"
          description={`${skills.total} skills across ${categories.length} categories`} />
        {skills.total === 0 ? <p className="text-ink-muted">No skills from our dictionary were detected. Add a Skills section listing your tools and languages.</p> : (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              {categories.map(([cat, names]) => (
                <div key={cat}>
                  <p className="t-label mb-1.5 flex items-center gap-2 text-ink-muted">{cat}<span className="mono">{names.length}</span></p>
                  <ChipList items={names} render={(n) => <SkillChip variant="detected" note={detectedBySkill[n]?.count > 1 ? `×${detectedBySkill[n].count}` : undefined}>{n}</SkillChip>} />
                </div>
              ))}
            </div>
            <div>
              <p className="t-label mb-2 text-ink-muted">Skills per category</p>
              <SkillChart byCategory={byCount} />
            </div>
          </div>
        )}
      </Card>

      {/* 4 · Sections + keywords */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="reveal">
          <CardHeader title="Resume sections" description="Sections that don't apply to you aren't penalised." />
          <SectionStatus sections={a.sections} />
        </Card>
        <Card className="reveal">
          <CardHeader eyebrow="TF-IDF + frequency" title="Top resume keywords" description="Important terms detected in your resume" />
          {a.keywords.length === 0 ? <p className="text-ink-muted">Not enough text to extract keywords.</p> : (
            <ol className="space-y-2">
              {a.keywords.slice(0, 12).map((k, i) => (
                <li key={k.keyword} className="flex items-center gap-3">
                  <span className="mono w-5 text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="w-40 shrink-0 truncate font-medium" title={k.keyword}>{k.keyword}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface-soft ring-1 ring-inset ring-line"><span className="block h-full bg-ink" style={{ width: `${Math.max(6, k.score * 100)}%` }} /></span>
                  {k.is_skill ? <Badge tone="success" icon={Check}>Skill</Badge> : <Badge icon={Minus}>Term</Badge>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* 5 · Entities */}
      <Card className="reveal">
        <CardHeader eyebrow="spaCy NER + rules" title="What we understood about you" description="Facts extracted from the text. Check they look right." />
        <Entities entities={a.entities} />
      </Card>

      {/* 6 · Suggestions */}
      <Card className="reveal">
        <CardHeader title="Suggestions" description="Generated from this analysis, in order of priority." />
        <Suggestions items={a.suggestions} />
      </Card>
    </div>
  )
}
