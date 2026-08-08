import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AppUser, BackendMode, Profile, TeacherAssignment } from '../types/app'
import { demoStore } from '../lib/demoStore'
import {
  addTeacherAssignment,
  deleteTeacherAssignment,
  loadTeacherWorkspace,
  saveTeacherProfile,
} from '../lib/repository'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AppContextValue = {
  backendMode: BackendMode
  backendConfigured: boolean
  loading: boolean
  authLoading: boolean
  user: AppUser | null
  profile: Profile | null
  assignments: TeacherAssignment[]
  error: string | null
  isDemo: boolean
  enterDemo: (withSampleData?: boolean) => Promise<void>
  leaveDemo: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<string>
  signOut: () => Promise<void>
  refreshWorkspace: () => Promise<void>
  updateProfile: (profile: Profile) => Promise<void>
  createAssignment: (assignment: Omit<TeacherAssignment, 'id'>) => Promise<void>
  removeAssignment: (id: string) => Promise<void>
  clearError: () => void
}

const AppContext = createContext<AppContextValue | undefined>(undefined)
const DEMO_SESSION_KEY = 'gurodesk.demo.session.v1'

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [demoActive, setDemoActive] = useState(
    () => localStorage.getItem(DEMO_SESSION_KEY) === 'true',
  )
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isDemo = demoActive || !isSupabaseConfigured
  const user: AppUser | null = isDemo
    ? demoActive
      ? demoStore.user
      : null
    : session?.user
      ? { id: session.user.id, email: session.user.email ?? null }
      : null

  const refreshWorkspace = useCallback(async () => {
    const activeUserId = isDemo ? (demoActive ? demoStore.user.id : null) : session?.user.id
    if (!activeUserId) {
      setProfile(null)
      setAssignments([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const workspace = await loadTeacherWorkspace(activeUserId, isDemo)
      setProfile(workspace.profile)
      setAssignments(workspace.assignments)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load teacher workspace.')
    } finally {
      setLoading(false)
    }
  }, [demoActive, isDemo, session?.user.id])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      setLoading(false)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authLoading) void refreshWorkspace()
  }, [authLoading, refreshWorkspace])

  async function enterDemo(withSampleData = false) {
    localStorage.setItem(DEMO_SESSION_KEY, 'true')
    setDemoActive(true)
    if (withSampleData) {
      const workspace = demoStore.loadDemoWorkspace()
      setProfile(workspace.profile)
      setAssignments(workspace.assignments)
      setLoading(false)
    }
  }

  function leaveDemo() {
    localStorage.removeItem(DEMO_SESSION_KEY)
    setDemoActive(false)
    setProfile(null)
    setAssignments([])
  }

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase is not configured yet.')
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }

  async function signUp(email: string, password: string) {
    if (!supabase) throw new Error('Supabase is not configured yet.')
    setError(null)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) throw signUpError
    return data.session
      ? 'Account created and signed in.'
      : 'Account created. Check your email if confirmation is enabled in Supabase.'
  }

  async function signOut() {
    if (isDemo) {
      leaveDemo()
      return
    }
    if (supabase) await supabase.auth.signOut()
  }

  async function updateProfile(nextProfile: Profile) {
    try {
      const saved = await saveTeacherProfile(nextProfile, isDemo)
      setProfile(saved)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save profile.'
      setError(message)
      throw err
    }
  }

  async function createAssignment(assignment: Omit<TeacherAssignment, 'id'>) {
    try {
      const created = await addTeacherAssignment(assignment, isDemo)
      setAssignments((items) => [...items, created])
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save assignment.'
      setError(message)
      throw err
    }
  }

  async function removeAssignment(id: string) {
    try {
      await deleteTeacherAssignment(id, isDemo)
      setAssignments((items) => items.filter((item) => item.id !== id))
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete assignment.'
      setError(message)
      throw err
    }
  }

  const value = useMemo<AppContextValue>(
    () => ({
      backendMode: isDemo ? 'demo' : 'supabase',
      backendConfigured: isSupabaseConfigured,
      loading,
      authLoading,
      user,
      profile,
      assignments,
      error,
      isDemo,
      enterDemo,
      leaveDemo,
      signIn,
      signUp,
      signOut,
      refreshWorkspace,
      updateProfile,
      createAssignment,
      removeAssignment,
      clearError: () => setError(null),
    }),
    [
      assignments,
      authLoading,
      error,
      isDemo,
      loading,
      profile,
      user,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
