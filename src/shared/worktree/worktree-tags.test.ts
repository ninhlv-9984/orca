import { describe, expect, it } from 'vitest'
import {
  addWorkspaceTags,
  matchesWorkspaceTagFilter,
  normalizeWorkspaceTag,
  normalizeWorkspaceTagColors,
  normalizeWorkspaceTags,
  pickColorsForUncoloredWorkspaceTags,
  pickLeastUsedWorkspaceTagColor,
  removeWorkspaceTags,
  validateWorkspaceTag,
  WORKSPACE_TAG_COLOR_IDS
} from './worktree-tags'

describe('workspace tag rules', () => {
  it('trims and rejects empty, comma and over-long tags', () => {
    expect(normalizeWorkspaceTag('  api  ')).toBe('api')
    expect(normalizeWorkspaceTag('   ')).toBeNull()
    expect(normalizeWorkspaceTag('a,b')).toBeNull()
    expect(normalizeWorkspaceTag('x'.repeat(32))).toBe('x'.repeat(32))
    expect(normalizeWorkspaceTag('x'.repeat(33))).toBeNull()
    expect(normalizeWorkspaceTag(7)).toBeNull()
  })

  it('explains why a tag is invalid', () => {
    expect(validateWorkspaceTag('a,b')).toEqual({
      ok: false,
      error: expect.stringContaining('comma')
    })
    expect(validateWorkspaceTag('x'.repeat(33))).toEqual({
      ok: false,
      error: expect.stringContaining('32')
    })
  })

  it('dedupes case-insensitively keeping first-seen casing, empty becomes undefined', () => {
    expect(normalizeWorkspaceTags(['Api', 'api', ' web ', 'API'])).toEqual(['Api', 'web'])
    expect(normalizeWorkspaceTags([])).toBeUndefined()
    expect(normalizeWorkspaceTags(['', ' '])).toBeUndefined()
    expect(normalizeWorkspaceTags('nope')).toBeUndefined()
  })

  it('adds and removes case-insensitively', () => {
    expect(addWorkspaceTags(['Api'], ['api', 'web'])).toEqual(['Api', 'web'])
    expect(addWorkspaceTags(undefined, ['web'])).toEqual(['web'])
    expect(removeWorkspaceTags(['Api', 'web'], ['API'])).toEqual(['web'])
    expect(removeWorkspaceTags(['Api'], ['api'])).toBeUndefined()
    expect(removeWorkspaceTags(undefined, ['api'])).toBeUndefined()
  })

  it('matches a tag filter with OR semantics', () => {
    expect(matchesWorkspaceTagFilter(['Api'], [])).toBe(true)
    expect(matchesWorkspaceTagFilter(undefined, ['api'])).toBe(false)
    expect(matchesWorkspaceTagFilter(['Api', 'web'], ['WEB', 'zzz'])).toBe(true)
    expect(matchesWorkspaceTagFilter(['Api'], ['web'])).toBe(false)
  })
})

describe('workspace tag colors', () => {
  it('keeps only valid names and palette ids, lowercasing keys', () => {
    expect(
      normalizeWorkspaceTagColors({ Api: 'blue', web: 'neutral', 'a,b': 'rose', x: 3 })
    ).toEqual({ api: 'blue' })
    expect(normalizeWorkspaceTagColors(null)).toEqual({})
    expect(normalizeWorkspaceTagColors([])).toEqual({})
  })

  it('picks among the least-used colors with an injected rng', () => {
    const used = { a: 'blue', b: 'blue', c: 'sky', d: 'violet', e: 'amber', f: 'emerald' } as const
    expect(pickLeastUsedWorkspaceTagColor(used, () => 0)).toBe('rose')
    expect(pickLeastUsedWorkspaceTagColor({}, () => 0)).toBe(WORKSPACE_TAG_COLOR_IDS[0])
    expect(pickLeastUsedWorkspaceTagColor({}, () => 0.999)).toBe('rose')
    expect(pickLeastUsedWorkspaceTagColor({ a: 'blue' }, () => 0)).toBe('sky')
  })

  it('colors only uncolored tags and spreads new ones across colors', () => {
    const added = pickColorsForUncoloredWorkspaceTags(
      ['Api', 'web', 'API'],
      { web: 'rose' },
      () => 0
    )
    expect(added).toEqual({ api: 'blue' })
    expect(pickColorsForUncoloredWorkspaceTags(['web'], { web: 'rose' })).toEqual({})
    const spread = pickColorsForUncoloredWorkspaceTags(['a', 'b', 'c'], {}, () => 0)
    expect(new Set(Object.values(spread)).size).toBe(3)
  })
})
