import { Database, FlaskConical } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

export function StatusBadge() {
  const { backendMode } = useApp()
  const demo = backendMode === 'demo'
  return (
    <span className={`status-badge ${demo ? 'status-demo' : 'status-live'}`}>
      {demo ? <FlaskConical size={14} /> : <Database size={14} />}
      {demo ? 'Demo data' : 'Supabase live'}
    </span>
  )
}
