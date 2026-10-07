import { describe, expect, it } from 'vitest'
import { WorktreePsParams, WorktreeSet, WorktreeTagColorSet } from './worktree-params'
import { UiUpdate } from './client-ui-params'

describe('workspace tag RPC params', () => {
  it('accepts replace, null-clear, add and remove on worktree.set', () => {
    expect(
      WorktreeSet.safeParse({ worktree: 'active', tags: ['a'], addTags: ['b'], removeTags: ['c'] })
        .success
    ).toBe(true)
    expect(WorktreeSet.safeParse({ worktree: 'active', tags: null }).success).toBe(true)
  })

  it('reports which tag is invalid and why', () => {
    const result = WorktreeSet.safeParse({ worktree: 'active', addTags: ['ok', 'a,b'] })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error?.issues)).toContain('must not contain commas')
    expect(WorktreeSet.safeParse({ worktree: 'active', tags: [' '] }).success).toBe(false)
    expect(WorktreePsParams.safeParse({ tags: ['x'.repeat(33)] }).success).toBe(false)
  })

  it('validates tag colors against the palette', () => {
    expect(WorktreeTagColorSet.safeParse({ tag: 'api', color: 'rose' }).success).toBe(true)
    expect(WorktreeTagColorSet.safeParse({ tag: 'api', color: 'neutral' }).success).toBe(false)
    expect(UiUpdate.safeParse({ worktreeTagColors: { api: 'blue' } }).success).toBe(true)
    // Why: UiUpdate drops a bad value rather than rejecting the whole payload.
    expect(UiUpdate.parse({ worktreeTagColors: { api: 'pink' } })).not.toHaveProperty(
      'worktreeTagColors'
    )
  })
})
