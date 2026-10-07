import type React from 'react'

/**
 * Keydown policy for a text field embedded in a Radix dropdown/submenu: text keys must stay in
 * the field instead of triggering menu typeahead, while the keys that navigate the menu pass through.
 * ArrowLeft is only claimed while the caret can still move, so keyboard users are never trapped.
 */
export function keepTextKeysInMenuInput(
  event: React.KeyboardEvent<HTMLInputElement>,
  passthroughKeys: readonly string[] = ['ArrowDown', 'ArrowUp']
): void {
  if (event.key === 'ArrowLeft') {
    const { selectionStart, selectionEnd } = event.currentTarget
    if (!(selectionStart === 0 && selectionEnd === 0)) {
      event.stopPropagation()
    }
    return
  }
  if (!passthroughKeys.includes(event.key)) {
    event.stopPropagation()
  }
}
