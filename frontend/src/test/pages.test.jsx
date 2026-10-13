import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { validateFile } from '../hooks/useResumeUpload'

// Fixtures are REAL responses captured from the FastAPI backend (see tests/README).
import dashboard from './fixtures/dashboard.json'
import history from './fixtures/history.json'
import job from './fixtures/job.json'
import jobs from './fixtures/jobs.json'
import match from './fixtures/match.json'
import resume from './fixtures/resume.json'
import resumes from './fixtures/resumes.json'
import skills from './fixtures/skills.json'
import user from './fixtures/user.json'

const res = (data, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) })

function mockFetch(handlers) {
  const calls = []
  vi.stubGlobal('fetch', vi.fn((url, opts = {}) => {
    const method = opts.method || 'GET'
    const path = url.split('?')[0]
    calls.push({ url, method, body: opts.body })
    const h = handlers[`${method} ${url}`] ?? handlers[`${method} ${path}`]
    if (h === undefined) return res({ error: { message: `unmocked ${method} ${url}` } }, 500)
    return typeof h === 'function' ? h({ url, body: opts.body }) : res(h)
  }))
  return calls
}

const base = { 'GET /api/user': user, 'GET /api/health': { status: 'ok' }, 'GET /api/skills': skills }
const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

beforeEach(() => { window.scrollTo = vi.fn() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Landing', () => {
  it('shows the product promise and primary CTA', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: /know what your resume is saying/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /analyze your resume/i })[0]).toHaveAttribute('href', '/app/upload')
    expect(screen.getByText(/illustrative example, not real data/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /real language processing/i })).toBeInTheDocument()
  })
})

describe('Dashboard', () => {
  it('renders backend numbers: score, skills, latest match, recent analyses', async () => {
    mockFetch({ ...base, 'GET /api/dashboard': dashboard })
    renderAt('/app')
    expect(await screen.findByRole('heading', { name: /welcome back, student/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '99 out of 100' })).toBeInTheDocument()
    expect(screen.getByText(/skills detected/i)).toBeInTheDocument()
    expect(screen.getByText('Good alignment')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /recent analyses/i })).toBeInTheDocument()
    expect(screen.getAllByText('sample_resume.pdf').length).toBeGreaterThan(0)
  })

  it('shows an empty state when nothing has been analyzed', async () => {
    mockFetch({ ...base, 'GET /api/dashboard': { ...dashboard, totals: { resumes: 0, jobs: 0, matches: 0, average_score: null, best_match: null }, latest_resume: null, latest_analysis: null, latest_match: null, top_skills: [], recent: [] } })
    renderAt('/app')
    expect(await screen.findByText('No resume analyzed yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /upload resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try with sample data/i })).toBeInTheDocument()
  })

  it('shows a human error when the server is down', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    renderAt('/app')
    expect(await screen.findByText(/can't reach the smartresume server/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByText(/TypeError|Failed to fetch/)).not.toBeInTheDocument()
  })
})

describe('Resume analysis', () => {
  it('renders every report section in order, from real analysis data', async () => {
    mockFetch({ ...base, 'GET /api/resumes': resumes, 'GET /api/resumes/1': resume })
    renderAt('/app/analysis/1')
    expect(await screen.findByRole('heading', { level: 1, name: 'sample_resume.pdf' })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    const order = ['Detected skills', 'Resume sections', 'Top resume keywords', 'What we understood about you', 'Suggestions']
    expect(order.map((t) => headings.indexOf(t))).toEqual([...order.map((t) => headings.indexOf(t))].sort((a, b) => a - b))
    order.forEach((t) => expect(headings).toContain(t))
    expect(screen.getByText('Resume analysis score')).toBeInTheDocument()
    expect(screen.getByText('Section Completeness')).toBeInTheDocument()
    expect(screen.getAllByText('Python').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(3) // text status, not colour alone
    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument()
  })

  it('re-analyzes on request', async () => {
    const calls = mockFetch({ ...base, 'GET /api/resumes': resumes, 'GET /api/resumes/1': resume, 'POST /api/resumes/1/analyze': resume })
    renderAt('/app/analysis/1')
    fireEvent.click(await screen.findByRole('button', { name: /re-analyze/i }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url === '/api/resumes/1/analyze')).toBe(true))
  })

  it('shows an empty state with no resumes', async () => {
    mockFetch({ ...base, 'GET /api/resumes': [] })
    renderAt('/app/analysis')
    expect(await screen.findByText('No resume analyzed yet')).toBeInTheDocument()
  })
})

describe('Upload', () => {
  it('rejects unsupported files on the client with a friendly message', async () => {
    mockFetch(base)
    renderAt('/app/upload')
    const input = await screen.findByLabelText(/upload resume/i, { selector: 'input' })
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unsupported file type (.png).')
    expect(alert).toHaveTextContent('Upload a PDF, DOCX or TXT file.')
    expect(screen.getByRole('button', { name: /try another file/i })).toBeInTheDocument()
  })

  it('uploads, shows progress then a completed state with next actions', async () => {
    mockFetch(base)
    class FakeXHR {
      constructor() { this.upload = {} }
      open() {}
      send() {
        setTimeout(() => {
          this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 })
          this.status = 201
          this.responseText = JSON.stringify(resume)
          this.onload()
        }, 20)
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)
    renderAt('/app/upload')
    const input = await screen.findByLabelText(/upload resume/i, { selector: 'input' })
    fireEvent.change(input, { target: { files: [new File(['hello'], 'cv.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText('Resume analyzed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view analysis/i })).toHaveAttribute('href', '/app/analysis/1')
    expect(screen.getByRole('link', { name: /match a job/i })).toHaveAttribute('href', '/app/match?resume=1')
  })

  it('surfaces server errors from the upload API', async () => {
    mockFetch(base)
    class FakeXHR {
      constructor() { this.upload = {} }
      open() {}
      send() { setTimeout(() => { this.status = 422; this.responseText = JSON.stringify({ error: { code: 'insufficient_text', message: 'This resume contains too little text to analyse.', hint: 'Export a text-based PDF.' } }); this.onload() }, 10) }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)
    renderAt('/app/upload')
    const input = await screen.findByLabelText(/upload resume/i, { selector: 'input' })
    fireEvent.change(input, { target: { files: [new File(['hi'], 'cv.txt')] } })
    expect(await screen.findByText(/too little text/i)).toBeInTheDocument()
    expect(screen.getByText('Export a text-based PDF.')).toBeInTheDocument()
  })

  it('validateFile covers type, empty and size', () => {
    expect(validateFile(new File(['x'], 'a.exe'))).toMatchObject({ message: expect.stringContaining('Unsupported') })
    expect(validateFile(new File([], 'a.pdf'))).toMatchObject({ message: 'This file is empty.' })
    expect(validateFile(new File(['x'], 'noext'))).not.toBeNull()
    expect(validateFile(new File(['x'], 'ok.DOCX'))).toBeNull()
    const big = new File(['x'], 'big.pdf'); Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    expect(validateFile(big)).toMatchObject({ message: expect.stringContaining('larger than 10 MB') })
  })
})

describe('Job matching', () => {
  const handlers = () => ({ ...base, 'GET /api/resumes': resumes, 'GET /api/jobs': jobs, 'GET /api/resumes/1': resume, 'POST /api/jobs': () => res(job, 201), 'POST /api/match': () => res(match, 201) })

  it('validates an empty job description, then runs a real comparison flow', async () => {
    const calls = mockFetch(handlers())
    renderAt('/app/match')
    const run = await screen.findByRole('button', { name: /compare resume with job/i })
    await screen.findByLabelText('Extracted resume text')
    fireEvent.click(run)
    expect(await screen.findByText('The job description is empty.')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)

    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: 'Junior developer. Python, React, Docker, AWS required.' } })
    fireEvent.click(screen.getByRole('button', { name: /compare resume with job/i }))
    expect(await screen.findByRole('heading', { name: /matching skills/i }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Good alignment')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /missing \/ not detected/i })).toBeInTheDocument()
    expect(screen.getAllByText('Docker').length).toBeGreaterThan(0)
    expect(screen.getByText(/not a prediction of hiring outcomes/i)).toBeInTheDocument()
    const post = calls.find((c) => c.url === '/api/match')
    expect(JSON.parse(post.body)).toEqual({ resume_id: 1, job_id: job.id })
  })

  it('opens a saved match from a link', async () => {
    mockFetch({ ...handlers(), 'GET /api/match/1': match })
    renderAt('/app/match?match=1')
    expect(await screen.findByRole('heading', { name: match.job_title })).toBeInTheDocument()
    expect(screen.getByText('Skill match')).toBeInTheDocument()
    expect(screen.getByText('Text similarity')).toBeInTheDocument()
  })

  it('asks for a resume first when none exist', async () => {
    mockFetch({ ...base, 'GET /api/resumes': [], 'GET /api/jobs': [] })
    renderAt('/app/match')
    expect(await screen.findByText('Upload a resume first')).toBeInTheDocument()
  })

  it('shows API errors without raw output', async () => {
    mockFetch({ ...handlers(), 'POST /api/jobs': () => res({ error: { code: 'insufficient_text', message: 'This job description contains too little text to analyse.', hint: 'Paste the full posting.' } }, 422) })
    renderAt('/app/match')
    await screen.findByLabelText('Extracted resume text')
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: 'short text here' } })
    fireEvent.click(screen.getByRole('button', { name: /compare resume with job/i }))
    expect(await screen.findByText(/too little text/i)).toBeInTheDocument()
  })
})

describe('History', () => {
  it('lists analyses and sends search / filter / sort to the API', async () => {
    const calls = mockFetch({ ...base, 'GET /api/history': history })
    renderAt('/app/history')
    expect((await screen.findAllByText('sample_resume.pdf')).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /open analysis of sample_resume.pdf/i })[0]).toHaveAttribute('href', '/app/history/1')
    fireEvent.change(screen.getByLabelText(/search by resume/i), { target: { value: 'sample' } })
    await waitFor(() => expect(calls.some((c) => c.url.includes('q=sample'))).toBe(true), { timeout: 2000 })
    fireEvent.change(screen.getByLabelText('File type'), { target: { value: 'pdf' } })
    await waitFor(() => expect(calls.some((c) => c.url.includes('file_type=pdf'))).toBe(true))
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'score' } })
    await waitFor(() => expect(calls.some((c) => c.url.includes('sort=score'))).toBe(true))
  })

  it('distinguishes "no history" from "no results for filters"', async () => {
    mockFetch({ ...base, 'GET /api/history': { items: [], total: 0 } })
    renderAt('/app/history')
    expect(await screen.findByText('No history yet')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('File type'), { target: { value: 'docx' } })
    expect(await screen.findByText('No analyses match your filters')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(await screen.findByText('No history yet')).toBeInTheDocument()
  })
})

describe('Analysis details', () => {
  it('shows the full report and the job matches for the resume', async () => {
    mockFetch({ ...base, 'GET /api/resumes/1': resume })
    renderAt('/app/history/1')
    expect(await screen.findByRole('heading', { level: 1, name: 'sample_resume.pdf' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Job matches' })).toBeInTheDocument()
    expect(screen.getAllByText(resume.matches[0].job_title).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /open match with/i })[0]).toHaveAttribute('href', '/app/match?match=1')
  })

  it('deletes after confirmation and returns to history', async () => {
    const calls = mockFetch({ ...base, 'GET /api/resumes/1': resume, 'DELETE /api/resumes/1': () => Promise.resolve({ ok: true, status: 204, json: () => Promise.reject() }), 'GET /api/history': { items: [], total: 0 } })
    renderAt('/app/history/1')
    fireEvent.click(await screen.findByRole('button', { name: /delete this analysis/i }))
    const dialog = await screen.findByRole('dialog', { name: /delete this analysis/i })
    expect(dialog).toHaveTextContent('permanently removed')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No history yet')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true)
  })

  it('shows a not-found message for an unknown id', async () => {
    mockFetch({ ...base, 'GET /api/resumes/99': () => res({ error: { code: 'not_found', message: 'Resume not found.' } }, 404) })
    renderAt('/app/history/99')
    expect(await screen.findByText('Resume not found.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })
})

describe('Settings', () => {
  it('shows field-level validation errors from the API, then saves', async () => {
    let attempt = 0
    mockFetch({ ...base, 'PUT /api/user': () => (++attempt === 1
      ? res({ error: { code: 'invalid_request', message: 'invalid', details: [{ field: 'email', message: 'Enter a valid email address.' }] } }, 422)
      : res({ ...user, name: 'Aarav', email: 'aarav@example.com' })) })
    renderAt('/app/settings')
    const email = await screen.findByLabelText('Email')
    fireEvent.change(email, { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(email, { target: { value: 'aarav@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('shows installation info', async () => {
    mockFetch(base)
    renderAt('/app/settings')
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(await screen.findByText(/skills in \d+ categories/i)).toBeInTheDocument()
  })
})

describe('Navigation shell', () => {
  it('has the four main destinations, settings and a skip link', async () => {
    mockFetch({ ...base, 'GET /api/history': history })
    renderAt('/app/history')
    await screen.findAllByText('sample_resume.pdf')
    for (const name of ['Dashboard', 'Resume Analysis', 'Job Matching', 'History', 'Settings']) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'History' })[0]).toHaveAttribute('aria-current', 'page')
  })

  it('renders a not-found page for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })
})
