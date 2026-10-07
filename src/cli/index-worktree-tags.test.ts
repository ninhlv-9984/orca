import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { okFixture, queueFixtures } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

const SET_ARGS = ['worktree', 'set', '--worktree', 'id:repo::/tmp/repo/feature']
const WORKTREE_FIXTURE = {
  worktree: { id: 'repo::/tmp/repo/feature', branch: 'feature/foo', path: '/tmp/repo/feature' }
}

describe('orca cli workspace tags', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  async function expectRejected(argv: string[], message: string): Promise<void> {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const priorExitCode = process.exitCode
    await main(argv, '/tmp/repo')
    expect(callMock).not.toHaveBeenCalled()
    expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(message)
    expect(process.exitCode).toBe(1)
    process.exitCode = priorExitCode
  }

  it('sends repeated --tag/--untag as addTags/removeTags', async () => {
    queueFixtures(callMock, okFixture('req_1', WORKTREE_FIXTURE))
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [...SET_ARGS, '--tag', 'backend', '--tag', 'urgent', '--untag', 'wip', '--json'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'worktree.set',
      expect.objectContaining({
        worktree: 'id:repo::/tmp/repo/feature',
        addTags: ['backend', 'urgent'],
        removeTags: ['wip']
      })
    )
    expect(callMock.mock.calls[0][1]).not.toHaveProperty('tags')
  })

  it('replaces tags with --tags a,b and clears them with --tags null', async () => {
    queueFixtures(
      callMock,
      okFixture('req_1', WORKTREE_FIXTURE),
      okFixture('req_2', WORKTREE_FIXTURE)
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main([...SET_ARGS, '--tags', 'a, b', '--json'], '/tmp/repo')
    await main([...SET_ARGS, '--tags', 'null', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenNthCalledWith(
      1,
      'worktree.set',
      expect.objectContaining({ tags: ['a', 'b'] })
    )
    expect(callMock).toHaveBeenNthCalledWith(
      2,
      'worktree.set',
      expect.objectContaining({ tags: null })
    )
  })

  it('leaves tags out of worktree.set when no tag flag is passed', async () => {
    queueFixtures(callMock, okFixture('req_1', WORKTREE_FIXTURE))
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main([...SET_ARGS, '--comment', 'hi', '--json'], '/tmp/repo')

    const params = callMock.mock.calls[0][1]
    expect(params).not.toHaveProperty('tags')
    expect(params).not.toHaveProperty('addTags')
    expect(params).not.toHaveProperty('removeTags')
  })

  it('rejects invalid tags before calling the runtime', async () => {
    await expectRejected([...SET_ARGS, '--tag', 'x'.repeat(33), '--json'], 'longer than 32')
    await expectRejected([...SET_ARGS, '--tags', 'a,,b', '--json'], 'must not be empty')
    await expectRejected(
      [...SET_ARGS, '--tags', '', '--json'],
      '--tags needs a comma-separated list'
    )
  })

  it('filters worktree ps by repeated --tag', async () => {
    queueFixtures(callMock, okFixture('req_1', { worktrees: [], totalCount: 0, truncated: false }))
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['worktree', 'ps', '--tag', 'Api', '--tag', 'web', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('worktree.ps', { limit: undefined, tags: ['Api', 'web'] })
  })

  it('prints tags in human-readable show and ps output', async () => {
    queueFixtures(
      callMock,
      okFixture('req_1', { worktree: { ...WORKTREE_FIXTURE.worktree, tags: ['api', 'web'] } }),
      okFixture('req_2', {
        worktrees: [
          {
            repo: 'repo',
            branch: 'feature/foo',
            hostId: 'local',
            liveTerminalCount: 0,
            hasAttachedPty: false,
            unread: false,
            path: '/tmp/repo/feature',
            tags: ['api', 'web']
          }
        ],
        totalCount: 1,
        truncated: false
      })
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['worktree', 'show', '--worktree', 'id:repo::/tmp/repo/feature'], '/tmp/repo')
    await main(['worktree', 'ps'], '/tmp/repo')

    const output = logSpy.mock.calls.flat().join('\n')
    expect(output).toContain('tags: api, web')
    expect(output).toMatch(/unread:no {2}tags: api, web/)
  })

  it('lists tags with `worktree tags`', async () => {
    queueFixtures(
      callMock,
      okFixture('req_1', {
        tags: [
          { name: 'api', color: 'blue', count: 2 },
          { name: 'web', color: 'rose', count: 1 }
        ]
      })
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['worktree', 'tags'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('worktree.tags')
    expect(logSpy.mock.calls.flat().join('\n')).toBe('api  blue  2\nweb  rose  1')
  })

  it('sets a tag color with `worktree tag-color`', async () => {
    queueFixtures(callMock, okFixture('req_1', { tag: 'api', color: 'emerald' }))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['worktree', 'tag-color', '--tag', 'api', '--color', 'emerald'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('worktree.setTagColor', {
      tag: 'api',
      color: 'emerald'
    })
    expect(logSpy.mock.calls.flat().join('\n')).toBe('api: emerald')
  })

  it('requires both flags for `worktree tag-color`', async () => {
    await expectRejected(['worktree', 'tag-color', '--tag', 'api'], 'Missing required --color')
  })

  it('rejects empty --tag/--untag values instead of ignoring them', async () => {
    await expectRejected(['worktree', 'ps', '--tag', '', '--json'], '--tag must not be empty')
    await expectRejected([...SET_ARGS, '--untag', '', '--json'], '--untag must not be empty')
  })

  it('rejects a repeated --tag for `worktree tag-color`', async () => {
    await expectRejected(
      ['worktree', 'tag-color', '--tag', 'a', '--tag', 'b', '--color', 'rose'],
      'Pass --tag once'
    )
  })

  it('shows a tag with no color as a dash', async () => {
    queueFixtures(callMock, okFixture('req_1', { tags: [{ name: 'api', count: 1 }] }))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(['worktree', 'tags'], '/tmp/repo')
    expect(logSpy.mock.calls.flat().join('\n')).toBe('api  -  1')
  })

  it('rejects --tag on commands that do not take it', async () => {
    await expectRejected(['worktree', 'list', '--tag', 'api'], '--tag')
  })
})
