import type { WORKSPACE_STATUS_COLOR_IDS } from '../workspace-statuses'

export const MAX_WORKSPACE_TAG_LENGTH = 32

// Why a subset of the status palette: neutral/zinc/conductor ids are not distinguishable tag accents.
export const WORKSPACE_TAG_COLOR_IDS = [
  'blue',
  'sky',
  'violet',
  'amber',
  'emerald',
  'rose'
] as const satisfies readonly (typeof WORKSPACE_STATUS_COLOR_IDS)[number][]

export type WorkspaceTagColorId = (typeof WORKSPACE_TAG_COLOR_IDS)[number]

/** Lowercase tag name -> color id. Keyed by name so a color outlives the last workspace carrying it. */
export type WorkspaceTagColors = Record<string, WorkspaceTagColorId>

export type WorkspaceTagValidation = { ok: true; tag: string } | { ok: false; error: string }

export function workspaceTagKey(tag: string): string {
  return tag.toLowerCase()
}

export function validateWorkspaceTag(raw: unknown): WorkspaceTagValidation {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Tag must be a string.' }
  }
  const tag = raw.trim()
  if (tag.length === 0) {
    return { ok: false, error: 'Tag must not be empty.' }
  }
  if (tag.includes(',')) {
    return { ok: false, error: `Tag "${tag}" must not contain commas.` }
  }
  if (tag.length > MAX_WORKSPACE_TAG_LENGTH) {
    return {
      ok: false,
      error: `Tag "${tag}" is longer than ${MAX_WORKSPACE_TAG_LENGTH} characters.`
    }
  }
  return { ok: true, tag }
}

/** Trimmed tag, or null when it breaks the tag rules. */
export function normalizeWorkspaceTag(raw: unknown): string | null {
  const result = validateWorkspaceTag(raw)
  return result.ok ? result.tag : null
}

/** Dedupes case-insensitively, keeping the first-seen casing. Invalid entries are dropped. */
export function normalizeWorkspaceTagList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const seen = new Set<string>()
  const tags: string[] = []
  for (const entry of raw) {
    const tag = normalizeWorkspaceTag(entry)
    if (tag === null || seen.has(workspaceTagKey(tag))) {
      continue
    }
    seen.add(workspaceTagKey(tag))
    tags.push(tag)
  }
  return tags
}

/** Stored shape: the normalized list, or undefined when empty (never `[]`). */
export function normalizeWorkspaceTags(raw: unknown): string[] | undefined {
  const tags = normalizeWorkspaceTagList(raw)
  return tags.length > 0 ? tags : undefined
}

export function addWorkspaceTags(
  existing: readonly string[] | undefined,
  toAdd: readonly string[]
): string[] | undefined {
  return normalizeWorkspaceTags([...(existing ?? []), ...toAdd])
}

export function removeWorkspaceTags(
  existing: readonly string[] | undefined,
  toRemove: readonly string[]
): string[] | undefined {
  const removed = new Set(toRemove.map((tag) => workspaceTagKey(tag.trim())))
  return normalizeWorkspaceTags(
    (existing ?? []).filter((tag) => !removed.has(workspaceTagKey(tag)))
  )
}

/** OR match; an empty filter matches everything. */
export function matchesWorkspaceTagFilter(
  tags: readonly string[] | undefined,
  filter: readonly string[]
): boolean {
  if (filter.length === 0) {
    return true
  }
  const wanted = new Set(filter.map((tag) => workspaceTagKey(tag.trim())))
  return (tags ?? []).some((tag) => wanted.has(workspaceTagKey(tag)))
}

export function isWorkspaceTagColorId(value: unknown): value is WorkspaceTagColorId {
  return WORKSPACE_TAG_COLOR_IDS.some((id) => id === value)
}

/** Drops invalid names/colors and lowercases keys. */
export function normalizeWorkspaceTagColors(raw: unknown): WorkspaceTagColors {
  const colors: WorkspaceTagColors = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return colors
  }
  for (const [name, color] of Object.entries(raw)) {
    const tag = normalizeWorkspaceTag(name)
    if (tag !== null && isWorkspaceTagColorId(color)) {
      colors[workspaceTagKey(tag)] = color
    }
  }
  return colors
}

/** Picks uniformly among the colors used by the fewest tags. `random` returns [0, 1). */
export function pickLeastUsedWorkspaceTagColor(
  colors: WorkspaceTagColors,
  random: () => number = Math.random
): WorkspaceTagColorId {
  const usage = new Map<WorkspaceTagColorId, number>(WORKSPACE_TAG_COLOR_IDS.map((id) => [id, 0]))
  for (const color of Object.values(colors)) {
    usage.set(color, (usage.get(color) ?? 0) + 1)
  }
  const least = Math.min(...usage.values())
  const candidates = WORKSPACE_TAG_COLOR_IDS.filter((id) => usage.get(id) === least)
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
}

/** Colors for tags that have none yet; empty when nothing is missing. */
export function pickColorsForUncoloredWorkspaceTags(
  tags: readonly string[] | undefined,
  colors: WorkspaceTagColors,
  random: () => number = Math.random
): WorkspaceTagColors {
  const added: WorkspaceTagColors = {}
  for (const tag of tags ?? []) {
    const key = workspaceTagKey(tag)
    if (colors[key] !== undefined || added[key] !== undefined) {
      continue
    }
    added[key] = pickLeastUsedWorkspaceTagColor({ ...colors, ...added }, random)
  }
  return added
}
