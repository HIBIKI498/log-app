type SettingsShortcutTarget = 'タグ' | '習慣'

type SettingsShortcutsProps = {
  target: SettingsShortcutTarget
  onAdd: () => void
  onManage: () => void
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
      <path d="m19.4 13.5 1.1 1.9-2.1 3.6h-2.2l-1.2.7-1.1 1.8H9.7l-1.1-1.8-1.2-.7H5.2l-2.1-3.6 1.1-1.9v-1.4L3.1 10.2l2.1-3.6h2.2l1.2-.7 1.1-1.8h4.2L15 5.9l1.2.7h2.2l2.1 3.6-1.1 1.9v1.4Z" />
    </svg>
  )
}

// 入力画面から、その項目専用の追加・管理モーダルを開くショートカット。
export function SettingsShortcuts({ target, onAdd, onManage }: SettingsShortcutsProps) {
  return (
    <div className="settings-shortcuts">
      <button
        aria-label={`${target}を追加`}
        className="settings-shortcut-button"
        title={`${target}を追加`}
        type="button"
        onClick={onAdd}
      >
        <PlusIcon />
      </button>
      <button
        aria-label={`${target}を編集・削除`}
        className="settings-shortcut-button"
        title={`${target}を編集・削除`}
        type="button"
        onClick={onManage}
      >
        <GearIcon />
      </button>
    </div>
  )
}
