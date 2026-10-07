import { describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import {
  recordCreatedWorktreeLineage,
  type WorktreeLineageRecordingResolution
} from './runtime-worktree-lineage-recording'
import type { RuntimeStore } from './runtime-store-contract'

function makeStore(parentTags?: string[]) {
  const written: Record<string, Partial<WorktreeMeta>> = {}
  let colors: Record<string, string> = {}
  const store = {
    getWorktreeMeta: (id: string) => (id === 'repo::/parent' ? { tags: parentTags } : undefined),
    setWorktreeMeta: vi.fn((id: string, updates: Partial<WorktreeMeta>) => {
      written[id] = { ...written[id], ...updates }
      return written[id]
    }),
    getUI: () => ({ worktreeTagColors: colors }),
    updateUI: vi.fn((updates: { worktreeTagColors?: Record<string, string> }) => {
      colors = { ...colors, ...updates.worktreeTagColors }
    }),
    setWorktreeLineage: vi.fn((_id: string, lineage: unknown) => lineage),
    setWorkspaceLineage: vi.fn((lineage: unknown) => lineage)
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fake of the store members the recorder reads.
  return { store: store as unknown as RuntimeStore, written, getColors: () => colors }
}

const child = { id: 'repo::/child', instanceId: 'child-instance' }

function worktreeParent(): WorktreeLineageRecordingResolution {
  return {
    kind: 'lineage',
    parent: {
      type: 'worktree',
      workspaceKey: 'worktree:repo::/parent',
      worktree: { id: 'repo::/parent' },
      instanceId: 'parent-instance'
    },
    origin: 'manual',
    capture: { source: 'manual-action', confidence: 'explicit' }
  }
}

describe('recordCreatedWorktreeLineage tag inheritance', () => {
  it('copies a worktree parent tags to the child and colors them', () => {
    const { store, written, getColors } = makeStore(['Api', 'web'])
    recordCreatedWorktreeLineage(store, child, worktreeParent())
    expect(written[child.id]?.tags).toEqual(['Api', 'web'])
    expect(Object.keys(getColors()).sort()).toEqual(['api', 'web'])
  })

  it('copies a folder parent tags', () => {
    const { store, written } = makeStore()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the recorder reads only the parent's tags.
    const folderWorkspace = { id: 'folder-1', tags: ['docs'] } as unknown as FolderWorkspace
    recordCreatedWorktreeLineage(store, child, {
      kind: 'lineage',
      parent: {
        type: 'folder',
        workspaceKey: 'folder:folder-1',
        folderWorkspace,
        instanceId: null
      },
      origin: 'manual',
      capture: { source: 'manual-action', confidence: 'explicit' }
    })
    expect(written[child.id]?.tags).toEqual(['docs'])
  })

  it('writes nothing when the parent has no tags or no parent resolved', () => {
    const untagged = makeStore()
    recordCreatedWorktreeLineage(untagged.store, child, worktreeParent())
    expect(untagged.store.setWorktreeMeta).not.toHaveBeenCalled()
    const orphan = makeStore(['api'])
    recordCreatedWorktreeLineage(orphan.store, child, { kind: 'none', warnings: [] })
    expect(orphan.store.setWorktreeMeta).not.toHaveBeenCalled()
  })
})
