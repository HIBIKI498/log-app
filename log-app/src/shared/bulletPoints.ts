export const BULLET_POINT_PREFIX = '・ '

type BulletInsertResult = {
  value: string
  caretPosition: number
}

// 空の箇条書きメモ欄を開いた時、最初の行にも点を自動挿入する。
export function createInitialBulletPointLine(value: string): BulletInsertResult | null {
  if (value.length > 0) {
    return null
  }

  return {
    value: BULLET_POINT_PREFIX,
    caretPosition: BULLET_POINT_PREFIX.length,
  }
}

// 箇条書きメモ欄で改行した時、次の行に点を自動挿入する。
export function insertBulletPointLine(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): BulletInsertResult {
  const insertText = `\n${BULLET_POINT_PREFIX}`
  const nextValue = `${value.slice(0, selectionStart)}${insertText}${value.slice(selectionEnd)}`
  const caretPosition = selectionStart + insertText.length

  return {
    value: nextValue,
    caretPosition,
  }
}
