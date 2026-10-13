import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

export const MAX_MB = 10
export const ACCEPTED = ['pdf', 'docx', 'txt']
export const PROCESS_STEPS = ['Uploading', 'Extracting text', 'Processing language', 'Detecting skills', 'Calculating results']

export function validateFile(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (!ACCEPTED.includes(ext)) return { message: `Unsupported file type${ext ? ` (.${ext})` : ''}.`, hint: 'Upload a PDF, DOCX or TXT file.' }
  if (file.size === 0) return { message: 'This file is empty.', hint: 'Choose a file that contains your resume.' }
  if (file.size > MAX_MB * 1024 * 1024) return { message: `This file is larger than ${MAX_MB} MB.`, hint: 'Try exporting a smaller version.' }
  return null
}

/**
 * Upload state machine: idle -> uploading -> processing -> complete | error.
 * Upload progress is real (XHR). Server-side stages are shown as a progressive
 * checklist while the single analysis request is in flight.
 */
export function useResumeUpload() {
  const [state, setState] = useState({ status: 'idle', progress: 0, step: 0, fileName: '', error: null, result: null })
  const timer = useRef(null)
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null }
  useEffect(() => stop, [])

  const reset = useCallback(() => { stop(); setState({ status: 'idle', progress: 0, step: 0, fileName: '', error: null, result: null }) }, [])

  const start = useCallback(async (file) => {
    const invalid = validateFile(file)
    if (invalid) { setState({ status: 'error', progress: 0, step: 0, fileName: file.name, error: invalid, result: null }); return null }
    setState({ status: 'uploading', progress: 0, step: 0, fileName: file.name, error: null, result: null })
    try {
      const result = await api.uploadResume(file, (p) => {
        setState((s) => ({ ...s, progress: p }))
        if (p >= 100) {
          setState((s) => ({ ...s, status: 'processing', step: Math.max(s.step, 1) }))
          stop()
          timer.current = setInterval(() => setState((s) => (s.status === 'processing' && s.step < PROCESS_STEPS.length - 1 ? { ...s, step: s.step + 1 } : s)), 650)
        }
      })
      stop()
      setState({ status: 'complete', progress: 100, step: PROCESS_STEPS.length, fileName: file.name, error: null, result })
      return result
    } catch (err) {
      stop()
      setState({ status: 'error', progress: 0, step: 0, fileName: file.name, error: { message: err.message, hint: err.hint }, result: null })
      return null
    }
  }, [])

  return { ...state, start, reset }
}
