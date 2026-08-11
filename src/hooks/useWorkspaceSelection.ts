import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

/**
 * The selection used by the teacher-facing workspace controls.
 *
 * IDs are intentionally kept separate from their display labels. This means a
 * context can be restored between visits without pretending that a curriculum
 * period and a grading term are interchangeable records.
 */
export type WorkspaceSelection = {
  assignmentId: string | null
  section: string | null
  gradingTermId: string | null
  curriculumPeriodId: string | null
}

export type WorkspaceSelectionPatch = Partial<WorkspaceSelection>

export const DEFAULT_WORKSPACE_SELECTION: WorkspaceSelection = {
  assignmentId: null,
  section: null,
  gradingTermId: null,
  curriculumPeriodId: null,
}

export const WORKSPACE_SELECTION_STORAGE_KEY = 'gurodesk.workspace.selection.v1'

export function workspaceSelectionStorageKey(userId: string | null | undefined) {
  return `${WORKSPACE_SELECTION_STORAGE_KEY}.${encodeURIComponent(userId || 'anonymous')}`
}

function readStoredSelection(storageKey: string): WorkspaceSelection {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_SELECTION

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return DEFAULT_WORKSPACE_SELECTION
    const parsed = JSON.parse(raw) as Partial<WorkspaceSelection>
    return {
      assignmentId: typeof parsed.assignmentId === 'string' && parsed.assignmentId ? parsed.assignmentId : null,
      section: typeof parsed.section === 'string' && parsed.section ? parsed.section : null,
      gradingTermId: typeof parsed.gradingTermId === 'string' && parsed.gradingTermId ? parsed.gradingTermId : null,
      curriculumPeriodId: typeof parsed.curriculumPeriodId === 'string' && parsed.curriculumPeriodId ? parsed.curriculumPeriodId : null,
    }
  } catch {
    return DEFAULT_WORKSPACE_SELECTION
  }
}

function persistSelection(storageKey: string, selection: WorkspaceSelection) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(selection))
  } catch {
    // Local persistence is a convenience. Private browsing and storage quotas
    // must never prevent the rest of the workspace from opening.
  }
}

type WorkspaceSelectionStore = {
  getSnapshot: () => WorkspaceSelection
  subscribe: (listener: () => void) => () => void
  set: (next: WorkspaceSelection | ((current: WorkspaceSelection) => WorkspaceSelection)) => void
  replace: (next: WorkspaceSelection) => void
}

const stores = new Map<string, WorkspaceSelectionStore>()

function getStore(storageKey: string): WorkspaceSelectionStore {
  const existing = stores.get(storageKey)
  if (existing) return existing

  let current = readStoredSelection(storageKey)
  const listeners = new Set<() => void>()
  const store: WorkspaceSelectionStore = {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: (next) => {
      const resolved = typeof next === 'function' ? next(current) : next
      current = {
        assignmentId: resolved.assignmentId || null,
        section: resolved.section || null,
        gradingTermId: resolved.gradingTermId || null,
        curriculumPeriodId: resolved.curriculumPeriodId || null,
      }
      persistSelection(storageKey, current)
      listeners.forEach((listener) => listener())
    },
    replace: (next) => {
      current = next
      listeners.forEach((listener) => listener())
    },
  }
  stores.set(storageKey, store)
  return store
}

/**
 * Restores the last explicitly chosen workspace context on this device.
 * Consumers can use the returned setter for any page-specific picker without
 * introducing a second source of truth or a database migration.
 */
export function useWorkspaceSelection(userId?: string | null) {
  const storageKey = workspaceSelectionStorageKey(userId)
  const store = getStore(storageKey)
  const selection = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      store.replace(readStoredSelection(storageKey))
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storageKey, store])

  const setSelection = useCallback((next: WorkspaceSelection | ((current: WorkspaceSelection) => WorkspaceSelection)) => {
    store.set(next)
  }, [store])

  const updateSelection = useCallback((patch: WorkspaceSelectionPatch) => {
    store.set((current) => ({ ...current, ...patch }))
  }, [store])

  const clearSelection = useCallback(() => {
    store.set(DEFAULT_WORKSPACE_SELECTION)
  }, [store])

  return useMemo(() => ({
    selection,
    setSelection,
    updateSelection,
    clearSelection,
    hasSelection: Object.values(selection).some(Boolean),
  }), [clearSelection, selection, setSelection, updateSelection])
}
