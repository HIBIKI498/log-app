import type { EntryKind } from './types'

type TagEntryKindSelectorProps = {
  entryKinds: EntryKind[]
  disabled: boolean
  ariaLabel: string
  onChange: (entryKinds: EntryKind[]) => void
}

const ENTRY_KIND_OPTIONS: Array<{ kind: EntryKind; label: string }> = [
  { kind: 'diary', label: '日記' },
  { kind: 'record', label: '記録' },
]

function getSelectionDescription(entryKinds: EntryKind[]) {
  if (entryKinds.includes('diary') && entryKinds.includes('record')) {
    return '日記と記録で共有'
  }
  if (entryKinds.includes('diary')) {
    return '日記のみ'
  }
  if (entryKinds.includes('record')) {
    return '記録のみ'
  }

  return '使用する画面を選択してください'
}

// 固定タグを日記・記録のどちらに表示するか選択する。
export function TagEntryKindSelector({
  entryKinds,
  disabled,
  ariaLabel,
  onChange,
}: TagEntryKindSelectorProps) {
  return (
    <div className="settings-tag-target-field">
      <span>使用する画面</span>
      <div className="tag-target-selector" role="group" aria-label={ariaLabel}>
        {ENTRY_KIND_OPTIONS.map(({ kind, label }) => {
          const isChecked = entryKinds.includes(kind)

          return (
            <label key={kind}>
              <input
                type="checkbox"
                checked={isChecked}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    isChecked
                      ? entryKinds.filter((entryKind) => entryKind !== kind)
                      : [...entryKinds, kind],
                  )
                }
              />
              <span>{label}</span>
            </label>
          )
        })}
      </div>
      <small>{getSelectionDescription(entryKinds)}</small>
    </div>
  )
}
