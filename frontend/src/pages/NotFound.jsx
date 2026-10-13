import { Compass } from 'lucide-react'
import Button from '../components/Button'
import { EmptyState } from '../components/States'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24">
      <EmptyState icon={Compass} title="Page not found" action={<Button to="/app">Go to dashboard</Button>}>
        The page you're looking for doesn't exist or has moved.
      </EmptyState>
    </div>
  )
}
