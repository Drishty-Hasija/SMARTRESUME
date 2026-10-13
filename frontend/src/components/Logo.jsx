import { Link } from 'react-router-dom'

/** Document mark with a small node/connection motif. Works in monochrome. */
export function LogoMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden fill="none">
      <rect width="32" height="32" rx="6" fill="#171717" />
      <path d="M9 7h10l5 5v13H9z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="13" cy="17" r="1.6" fill="#fff" />
      <circle cx="20" cy="21" r="1.6" fill="#2563EB" />
      <path d="M13 17l7 4" stroke="#fff" strokeWidth="1.4" />
    </svg>
  )
}

export default function Logo({ to = '/', className = '', compact = false }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className}`} aria-label="SmartResume home">
      <LogoMark />
      {!compact && <span className="text-[17px]">SmartResume</span>}
    </Link>
  )
}
