import { ArrowRight, ArrowDown, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Logo from '../components/Logo'

const FEATURES = [
  ['Resume analysis', 'Understand the structure, skills, sections and keywords in your resume.'],
  ['Skill detection', 'Extract relevant technical and professional skills, grouped by category.'],
  ['Job matching', 'Compare your resume against a job description with TF-IDF and cosine similarity.'],
  ['Missing skills', 'See skills the job asks for that were not detected in your resume.'],
  ['Actionable suggestions', 'Get rule-based improvement suggestions drawn from your own results.'],
]

const STEPS = [
  ['01', 'Upload', 'Add your resume as a PDF, DOCX or TXT file.'],
  ['02', 'Analyze', 'We extract the text and detect skills, sections and keywords.'],
  ['03', 'Match', 'Paste a job description and compare it with your resume.'],
  ['04', 'Improve', 'Follow prioritised suggestions to close the gaps.'],
]

const NLP = [
  ['Tokenization', 'Text is split into words and technical terms such as C++ or Node.js.'],
  ['Stop-words & lemmas', 'Filler words are dropped and words are reduced to a base form, so "building" and "built" count as one.'],
  ['Named entities', 'spaCy finds names, organizations, places and dates; we turn them into plain facts.'],
  ['TF-IDF', 'Terms that are frequent here but not everywhere score higher, which surfaces your real keywords.'],
  ['Cosine similarity', 'Both documents become vectors; the angle between them measures how alike the wording is.'],
]

function HeroVisual() {
  return (
    <figure className="relative" aria-label="Example of the analysis flow: resume, NLP analysis, job match">
      <div className="card p-5 shadow-none">
        <div className="mb-3 flex items-center justify-between"><span className="eyebrow">Resume</span><span className="mono text-ink-muted">resume.pdf</span></div>
        <div className="flex flex-wrap gap-1.5">
          {['Python', 'React', 'Figma', 'NLP', 'Flutter'].map((s) => <span key={s} className="chip chip-success"><Check size={12} aria-hidden />{s}</span>)}
        </div>
      </div>
      <Connector />
      <div className="card p-5">
        <p className="eyebrow mb-3">NLP analysis</p>
        <div className="grid grid-cols-2 divide-x divide-line">
          <div><p className="t-label text-ink-muted">Skills</p><p className="t-h3 mt-0.5">18</p></div>
          <div className="pl-5"><p className="t-label text-ink-muted">Keywords</p><p className="t-h3 mt-0.5">24</p></div>
        </div>
      </div>
      <Connector />
      <div className="card flex items-center justify-between p-5">
        <div><p className="eyebrow mb-1">Job match</p><p className="t-small text-ink-muted">Resume / Job description</p></div>
        <p className="t-h2 text-accent">78%</p>
      </div>
      <figcaption className="mono mt-3 text-center text-ink-muted">Illustrative example, not real data</figcaption>
    </figure>
  )
}
const Connector = () => (
  <div className="flex justify-center py-1.5 text-ink-muted" aria-hidden><div className="flex flex-col items-center"><span className="h-3 border-l border-dashed border-line-strong" /><ArrowDown size={14} /></div></div>
)

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95">
        <div className="mx-auto flex h-16 max-w-marketing items-center justify-between px-5 md:px-8">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-7 text-[14px] text-ink-soft md:flex">
            <a className="hover:text-ink" href="#features">Features</a>
            <a className="hover:text-ink" href="#how">How it works</a>
            <a className="hover:text-ink" href="#nlp">The NLP</a>
          </nav>
          <Button to="/app" size="sm" variant="secondary">Open app</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="grid-bg border-b border-line">
        <div className="mx-auto grid max-w-marketing items-center gap-14 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow mb-5">NLP-powered resume analysis</p>
            <h1 className="t-display max-w-[14ch]">Know what your resume is saying.</h1>
            <p className="t-lead mt-6 max-w-prose">SmartResume uses natural language processing to analyze your resume, identify relevant skills, and compare your profile with real job descriptions.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to="/app/upload" size="lg" icon={ArrowRight}>Analyze Your Resume</Button>
              <Button href="#how" size="lg" variant="secondary">See How It Works</Button>
            </div>
            <p className="t-small mt-6 text-ink-muted">Runs locally. No external AI service. Your resume stays on your machine.</p>
          </div>
          <div className="mx-auto w-full max-w-sm lg:max-w-none"><HeroVisual /></div>
        </div>
      </section>

      {/* What it does */}
      <section className="mx-auto max-w-marketing px-5 py-20 md:px-8 md:py-24">
        <p className="eyebrow mb-3">What SmartResume does</p>
        <h2 className="t-h2 max-w-[22ch]">Your resume, understood as data.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {[['See what it says', 'Skills, sections, keywords and experience, pulled out of your document and shown in plain language.'],
            ['See what the job asks for', 'Paste a job description and find out which skills match and which were not detected.'],
            ['Know what to do next', 'A transparent score and prioritised suggestions, each tied to something we actually found.']].map(([t, d]) => (
            <div key={t} className="border-t border-ink pt-4"><h3 className="t-h4">{t}</h3><p className="mt-2 text-ink-soft">{d}</p></div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 border-y border-line bg-surface">
        <div className="mx-auto max-w-marketing px-5 py-20 md:px-8 md:py-24">
          <p className="eyebrow mb-3">Key features</p>
          <h2 className="t-h2 max-w-[24ch]">Everything is computed, nothing is guessed.</h2>
          <dl className="mt-10 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([t, d], i) => (
              <div key={t} className="border-b border-r border-line p-6">
                <dt className="mono mb-3 text-ink-muted">{String(i + 1).padStart(2, '0')}</dt>
                <dd><h3 className="t-h4">{t}</h3><p className="mt-1.5 text-ink-soft">{d}</p></dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-marketing scroll-mt-16 px-5 py-20 md:px-8 md:py-24">
        <p className="eyebrow mb-3">How it works</p>
        <h2 className="t-h2">Four steps, about a minute.</h2>
        <ol className="relative mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
          <span className="absolute left-4 right-4 top-[15px] hidden border-t border-dashed border-line-strong md:block" aria-hidden />
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="relative">
              <span className="mono relative z-10 inline-flex h-8 items-center bg-canvas pr-3 text-ink">{n}</span>
              <h3 className="t-h4 mt-3">{t}</h3>
              <p className="mt-1.5 text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* NLP explanation */}
      <section id="nlp" className="scroll-mt-16 border-y border-line bg-surface">
        <div className="mx-auto grid max-w-marketing gap-12 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow mb-3">The NLP</p>
            <h2 className="t-h2">Real language processing, running locally.</h2>
            <p className="mt-4 text-ink-soft">No chatbot and no generative AI. SmartResume uses classic, explainable NLP techniques, so every result can be traced back to your text.</p>
            <pre className="mono mt-8 overflow-x-auto rounded-lg border border-line bg-surface-soft p-5 text-ink-soft" aria-label="Pipeline diagram">{`TEXT
 │
 ├── Tokens
 │
 ├── Skills
 │
 ├── Keywords
 │
 └── Entities`}</pre>
          </div>
          <dl className="divide-y divide-line self-start border-y border-line">
            {NLP.map(([t, d]) => (
              <div key={t} className="grid gap-1 py-4 sm:grid-cols-[170px_1fr] sm:gap-6"><dt className="mono pt-0.5 text-ink">{t}</dt><dd className="text-ink-soft">{d}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-marketing px-5 py-20 text-center md:px-8 md:py-28">
        <h2 className="t-h1 mx-auto max-w-[18ch]">See what your resume is saying.</h2>
        <p className="t-lead mx-auto mt-4 max-w-prose">Upload a PDF, DOCX or TXT file and get your results in seconds.</p>
        <div className="mt-8 flex justify-center gap-3"><Button to="/app/upload" size="lg" icon={ArrowRight}>Analyze Your Resume</Button></div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-marketing flex-col items-start justify-between gap-4 px-5 py-8 text-[13px] text-ink-muted md:flex-row md:items-center md:px-8">
          <Logo />
          <p>Scores are automated text analysis, not an ATS score or a hiring prediction.</p>
          <Link to="/app" className="hover:text-ink">Open app</Link>
        </div>
      </footer>
    </div>
  )
}
