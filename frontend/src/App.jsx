import { Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Analysis from './pages/Analysis'
import AnalysisDetails from './pages/AnalysisDetails'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import JobMatch from './pages/JobMatch'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import Settings from './pages/Settings'
import Upload from './pages/Upload'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="upload" element={<Upload />} />
        <Route path="analysis" element={<Analysis />} />
        <Route path="analysis/:id" element={<Analysis />} />
        <Route path="match" element={<JobMatch />} />
        <Route path="history" element={<History />} />
        <Route path="history/:id" element={<AnalysisDetails />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
