import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cx } from '../utils/format'

const VARIANTS = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' }
const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' }

/** One button for the whole product. Renders <a>/<Link> when `to`/`href` is given. */
export default function Button({ variant = 'primary', size = 'md', loading = false, to, href, icon: Icon, className, children, disabled, ...rest }) {
  const cls = cx('btn', VARIANTS[variant], SIZES[size], className)
  const content = (
    <>
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </>
  )
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>
  if (href) return <a href={href} className={cls} {...rest}>{content}</a>
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  )
}
