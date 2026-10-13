import { useCallback, useEffect, useRef, useState } from 'react'

/** Run an async loader on mount / when deps change. Returns {data, error, loading, reload}. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const alive = useRef(true)
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    return loader()
      .then((data) => alive.current && setState({ data, error: null, loading: false }))
      .catch((error) => alive.current && setState({ data: null, error, loading: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    alive.current = true
    run()
    return () => { alive.current = false }
  }, [run])
  return { ...state, reload: run }
}

/** Debounce a fast-changing value (e.g. a search box). */
export function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

/** Animate a number from 0 to `target` (respects prefers-reduced-motion). */
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !target) { setValue(target || 0); return undefined }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}
