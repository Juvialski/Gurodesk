import { ShieldAlert, ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { isAdminUser } from '../../lib/adminAuth'

export type AdminGuardProps = {
  children: ReactNode
  fallbackToHome?: boolean
}

export function AdminGuard({ children, fallbackToHome = false }: AdminGuardProps) {
  const { user, profile, loading, authLoading, isDemo } = useApp()

  if (authLoading || loading) {
    return (
      <div className="loading-screen">
        <span className="loader" />
        <strong>Verifying administrator access…</strong>
      </div>
    )
  }

  const authorized = isAdminUser(user, profile, isDemo)

  if (!authorized) {
    if (fallbackToHome) {
      return <Navigate to="/" replace />
    }

    return (
      <div className="admin-forbidden-wrap" style={{ padding: '32px 16px', maxWidth: '640px', margin: '40px auto' }}>
        <section className="panel" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <ShieldAlert size={28} aria-hidden="true" />
          </div>
          <span className="eyebrow" style={{ color: '#dc2626' }}>Administrator Access Restricted</span>
          <h1 style={{ fontSize: '22px', margin: '8px 0 12px', color: 'var(--navy)' }}>Access Denied</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            The Admin Dashboard is restricted strictly to authorized administrator accounts.
            {user?.email ? (
              <> Your signed-in email (<strong>{user.email}</strong>) does not have administrator privileges.</>
            ) : (
              <> Please sign in with an authorized administrator account.</>
            )}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/" className="button primary">
              <ArrowLeft size={16} /> Return to Workspace Home
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return <>{children}</>
}
