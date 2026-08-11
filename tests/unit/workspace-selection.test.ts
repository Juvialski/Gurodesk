import { describe, expect, it } from 'vitest'
import { workspaceSelectionStorageKey } from '../../src/hooks/useWorkspaceSelection'

describe('workspace context storage', () => {
  it('isolates remembered context by authenticated user', () => {
    expect(workspaceSelectionStorageKey('teacher-a')).not.toBe(workspaceSelectionStorageKey('teacher-b'))
    expect(workspaceSelectionStorageKey('teacher@example.com')).toContain('teacher%40example.com')
  })

  it('uses a separate anonymous scope while authentication is loading', () => {
    expect(workspaceSelectionStorageKey(null)).toBe('gurodesk.workspace.selection.v1.anonymous')
  })
})
