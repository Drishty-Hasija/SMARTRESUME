// REST client for the SmartResume FastAPI backend.
// All failures become ApiError with a message that is safe to show to users.
const BASE = import.meta.env.VITE_API_URL || ''

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', hint = null, details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.hint = hint
    this.details = details
  }
}

const NETWORK_ERROR = () =>
  new ApiError("We can't reach the SmartResume server.", {
    code: 'network',
    hint: 'Make sure the backend is running (uvicorn app.main:app --port 8000) and try again.',
  })

function toApiError(status, data) {
  const e = data && data.error
  return new ApiError(e?.message || 'Something went wrong. Please try again.', {
    status, code: e?.code || 'error', hint: e?.hint || null, details: e?.details || null,
  })
}

async function request(path, { method = 'GET', json, form, signal } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: json !== undefined ? JSON.stringify(json) : form,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw NETWORK_ERROR()
  }
  if (res.status === 204) return null
  let data = null
  try { data = await res.json() } catch { /* non-JSON body */ }
  if (!res.ok) throw toApiError(res.status, data)
  return data
}

// XMLHttpRequest is used for uploads so the UI can show real upload progress.
function upload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', BASE + path)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onerror = () => reject(NETWORK_ERROR())
    xhr.onload = () => {
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(toApiError(xhr.status, data))
    }
    xhr.send(form)
  })
}

const fileForm = (file, extra = {}) => {
  const form = new FormData()
  form.append('file', file)
  Object.entries(extra).forEach(([k, v]) => v && form.append(k, v))
  return form
}

const qs = (params = {}) => {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v) })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const api = {
  health: () => request('/api/health'),
  dashboard: () => request('/api/dashboard'),
  history: (params) => request(`/api/history${qs(params)}`),
  skills: () => request('/api/skills'),
  loadSample: () => request('/api/samples/load', { method: 'POST' }),
  getUser: () => request('/api/user'),
  updateUser: (body) => request('/api/user', { method: 'PUT', json: body }),

  resumes: () => request('/api/resumes'),
  resume: (id) => request(`/api/resumes/${id}`),
  uploadResume: (file, onProgress) => upload('/api/resumes/upload', fileForm(file), onProgress),
  reanalyze: (id) => request(`/api/resumes/${id}/analyze`, { method: 'POST' }),
  deleteResume: (id) => request(`/api/resumes/${id}`, { method: 'DELETE' }),

  jobs: () => request('/api/jobs'),
  job: (id) => request(`/api/jobs/${id}`),
  createJob: (title, description) => request('/api/jobs', { method: 'POST', json: { title: title || null, description } }),
  uploadJob: (file, title) => upload('/api/jobs/upload', fileForm(file, { title })),
  deleteJob: (id) => request(`/api/jobs/${id}`, { method: 'DELETE' }),

  match: (resume_id, job_id) => request('/api/match', { method: 'POST', json: { resume_id, job_id } }),
  getMatch: (id) => request(`/api/match/${id}`),
  matches: (resumeId) => request(`/api/match${qs({ resume_id: resumeId })}`),
}
