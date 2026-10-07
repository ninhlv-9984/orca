import { translate } from '@/i18n/i18n'
import {
  MAX_WORKSPACE_TAG_LENGTH,
  type WorkspaceTagErrorCode
} from '../../../../shared/worktree/worktree-tags'

/** Localized text for a shared-validator failure; `fallback` is the validator's English message. */
export function describeWorkspaceTagError(
  code: WorkspaceTagErrorCode,
  tag: string,
  fallback: string
): string {
  switch (code) {
    case 'empty':
      return translate('auto.components.sidebar.WorkspaceTags.errorEmpty', 'Tag must not be empty.')
    case 'control':
      return translate(
        'auto.components.sidebar.WorkspaceTags.errorControl',
        'Tag must not contain control characters.'
      )
    case 'comma':
      return translate(
        'auto.components.sidebar.WorkspaceTags.errorComma',
        'Tag "{{value0}}" must not contain commas.',
        { value0: tag }
      )
    case 'too-long':
      return translate(
        'auto.components.sidebar.WorkspaceTags.errorTooLong',
        'Tag "{{value0}}" is longer than {{value1}} characters.',
        { value0: tag, value1: MAX_WORKSPACE_TAG_LENGTH }
      )
    case 'not-string':
      return fallback
  }
}
