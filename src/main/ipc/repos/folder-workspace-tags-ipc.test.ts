import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, args: unknown) => unknown>())
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: unknown, args: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))
vi.mock('./repos-changed-notification', () => ({ notifyReposChanged: vi.fn() }))

import { registerFolderWorkspaceHandlers } from './folder-workspace-handlers'
import { FolderWorkspaceUpdateArgs } from './repo-ipc-arg-schemas'

describe('folderWorkspaces:update tags', () => {
  beforeEach(() => handlers.clear())

  it('keeps tags through the IPC schema and rejects invalid ones', () => {
    const parsed = FolderWorkspaceUpdateArgs.parse({
      folderWorkspaceId: 'f1',
      updates: { tags: ['api'] }
    })
    expect(parsed.updates.tags).toEqual(['api'])
    expect(
      FolderWorkspaceUpdateArgs.safeParse({ folderWorkspaceId: 'f1', updates: { tags: ['a,b'] } })
        .success
    ).toBe(false)
  })

  it('stores tags and assigns their colors', async () => {
    let colors: Record<string, string> = {}
    const store = {
      updateFolderWorkspace: vi.fn((_id: string, updates: { tags?: string[] }) => ({
        id: 'f1',
        tags: updates.tags
      })),
      getUI: () => ({ worktreeTagColors: colors }),
      updateUI: vi.fn((updates: { worktreeTagColors?: Record<string, string> }) => {
        colors = { ...colors, ...updates.worktreeTagColors }
      })
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fakes of the members the handler reads.
    registerFolderWorkspaceHandlers({} as never, store as never, {} as never)

    await handlers.get('folderWorkspaces:update')?.(null, {
      folderWorkspaceId: 'f1',
      updates: { tags: ['Docs'] }
    })

    expect(store.updateFolderWorkspace).toHaveBeenCalledWith('f1', { tags: ['Docs'] })
    expect(Object.keys(colors)).toEqual(['docs'])
  })
})
