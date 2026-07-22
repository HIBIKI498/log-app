import { useCallback, useEffect, useState } from 'react'
import { DeleteConfirmationModal } from '../../shared/DeleteConfirmationModal'
import { WEEKDAYS } from '../../shared/habits'
import { TagEntryKindSelector } from '../../shared/TagEntryKindSelector'
import type {
  EntryKind,
  FeaturePageProps,
  FixedTagSetting,
  HabitSetting,
} from '../../shared/types'

type PendingDeletion =
  | {
      kind: 'fixedTag'
      item: FixedTagSetting
    }
  | {
      kind: 'habit'
      item: HabitSetting
    }

type DeletionModalContent = {
  confirmLabel: string
  description: string
  title: string
}

function createDeletionModalContent(pendingDeletion: PendingDeletion): DeletionModalContent {
  switch (pendingDeletion.kind) {
    case 'fixedTag':
      return {
        confirmLabel: '固定タグから外す',
        description: `「${pendingDeletion.item.name}」を固定タグから外します。過去の履歴に付いたタグは保持されます。`,
        title: '固定タグを外しますか？',
      }
    case 'habit':
      return {
        confirmLabel: '削除する',
        description: `習慣項目「${pendingDeletion.item.name}」と実行記録を削除します。この操作は元に戻せません。`,
        title: '習慣項目を削除しますか？',
      }
  }
}

export function TagsPage({ isActive }: FeaturePageProps) {
  const [fixedTags, setFixedTags] = useState<FixedTagSetting[]>([])
  const [habitSettings, setHabitSettings] = useState<HabitSetting[]>([])
  const [newFixedTagName, setNewFixedTagName] = useState('')
  const [newFixedTagEntryKinds, setNewFixedTagEntryKinds] = useState<EntryKind[]>([
    'diary',
    'record',
  ])
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitWeekdays, setNewHabitWeekdays] = useState<number[]>(
    WEEKDAYS.map((weekday) => weekday.value),
  )
  const [settingsMessage, setSettingsMessage] = useState('')
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)

  const handleCancelDeletion = useCallback(() => {
    setPendingDeletion(null)
  }, [])

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true)
    setSettingsMessage('')

    try {
      const settings = await window.logApp.listSettings()
      setFixedTags(settings.fixedTags)
      setHabitSettings(settings.habits)

      if (settings.fixedTags.length === 0 && settings.habits.length === 0) {
        setSettingsMessage('タグ項目がまだありません。')
      }
    } catch (error) {
      console.error('タグ設定の取得に失敗しました:', error)
      setSettingsMessage('タグ設定の取得に失敗しました。SQLite の接続状態を確認してください。')
    } finally {
      setIsLoadingSettings(false)
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      void loadSettings()
    }
  }, [isActive, loadSettings])

  const handleAddFixedTag = async () => {
    if (!newFixedTagName.trim()) {
      setSettingsMessage('固定タグ名を入力してください。')
      return
    }
    if (newFixedTagEntryKinds.length === 0) {
      setSettingsMessage('タグを使用する画面を選択してください。')
      return
    }

    setIsLoadingSettings(true)
    setSettingsMessage('')

    try {
      await window.logApp.addFixedTag(newFixedTagName, newFixedTagEntryKinds)
      setNewFixedTagName('')
      setNewFixedTagEntryKinds(['diary', 'record'])
      await loadSettings()
      setSettingsMessage('固定タグを保存しました。')
    } catch (error) {
      console.error('固定タグの追加に失敗しました:', error)
      setSettingsMessage('固定タグの追加に失敗しました。')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleUpdateFixedTag = async (tag: FixedTagSetting) => {
    if (!tag.name.trim()) {
      setSettingsMessage('固定タグ名を入力してください。')
      return
    }
    if (tag.entryKinds.length === 0) {
      setSettingsMessage('タグを使用する画面を選択してください。')
      return
    }

    setIsLoadingSettings(true)
    setSettingsMessage('')

    try {
      await window.logApp.updateFixedTag(tag.id, tag.name, tag.entryKinds)
      await loadSettings()
      setSettingsMessage('固定タグを更新しました。')
    } catch (error) {
      console.error('固定タグの更新に失敗しました:', error)
      setSettingsMessage('固定タグの更新に失敗しました。')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleDeleteFixedTag = async (tag: FixedTagSetting) => {
    setIsLoadingSettings(true)
    setSettingsMessage('')

    try {
      await window.logApp.deleteFixedTag(tag.id)
      await loadSettings()
      setSettingsMessage('固定タグから外しました。過去の履歴タグは保持されます。')
    } catch (error) {
      console.error('固定タグの解除に失敗しました:', error)
      setSettingsMessage('固定タグの解除に失敗しました。')
    } finally {
      setIsLoadingSettings(false)
      setPendingDeletion(null)
    }
  }

  const handleAddHabit = async () => {
    if (!newHabitName.trim()) {
      setSettingsMessage('習慣名を入力してください。')
      return
    }
    if (newHabitWeekdays.length === 0) {
      setSettingsMessage('実行する曜日を選択してください。')
      return
    }

    setIsLoadingSettings(true)
    setSettingsMessage('')

    try {
      await window.logApp.addHabit(newHabitName, newHabitWeekdays)
      setNewHabitName('')
      setNewHabitWeekdays(WEEKDAYS.map((weekday) => weekday.value))
      await loadSettings()
      setSettingsMessage('習慣項目を保存しました。')
    } catch (error) {
      console.error('習慣項目の追加に失敗しました:', error)
      setSettingsMessage('習慣項目の追加に失敗しました。')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleUpdateHabit = async (habit: HabitSetting) => {
    if (!habit.name.trim()) {
      setSettingsMessage('習慣名を入力してください。')
      return
    }
    if (habit.weekdays.length === 0) {
      setSettingsMessage('実行する曜日を選択してください。')
      return
    }

    setIsLoadingSettings(true)
    setSettingsMessage('')

    try {
      await window.logApp.updateHabit(habit.id, habit.name, habit.weekdays)
      await loadSettings()
      setSettingsMessage('習慣項目を更新しました。')
    } catch (error) {
      console.error('習慣項目の更新に失敗しました:', error)
      setSettingsMessage('習慣項目の更新に失敗しました。')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleDeleteHabit = async (habit: HabitSetting) => {
    setIsLoadingSettings(true)
    setSettingsMessage('')

    try {
      await window.logApp.deleteHabit(habit.id)
      await loadSettings()
      setSettingsMessage('習慣項目を削除しました。')
    } catch (error) {
      console.error('習慣項目の削除に失敗しました:', error)
      setSettingsMessage('習慣項目の削除に失敗しました。')
    } finally {
      setIsLoadingSettings(false)
      setPendingDeletion(null)
    }
  }

  const handleConfirmDeletion = async () => {
    if (!pendingDeletion) {
      return
    }

    if (pendingDeletion.kind === 'fixedTag') {
      await handleDeleteFixedTag(pendingDeletion.item)
      return
    }

    await handleDeleteHabit(pendingDeletion.item)
  }

  const deletionModalContent = pendingDeletion
    ? createDeletionModalContent(pendingDeletion)
    : null

  return (
    <section className="settings-section" hidden={!isActive}>
      <div className="section-heading">
        <h2>タグ</h2>
        <button
          className="secondary-button"
          type="button"
          disabled={isLoadingSettings}
          onClick={() => void loadSettings()}
        >
          {isLoadingSettings ? '読み込み中...' : '更新'}
        </button>
      </div>

      {settingsMessage ? <p className="history-message">{settingsMessage}</p> : null}

      {pendingDeletion && deletionModalContent ? (
        <DeleteConfirmationModal
          confirmLabel={deletionModalContent.confirmLabel}
          description={deletionModalContent.description}
          isDeleting={isLoadingSettings}
          title={deletionModalContent.title}
          onCancel={handleCancelDeletion}
          onConfirm={() => void handleConfirmDeletion()}
        />
      ) : null}

      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>固定タグ</h3>
          </div>

          <form
            className="settings-add-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAddFixedTag()
            }}
          >
            <h4>新しい固定タグを追加</h4>
            <div className="settings-name-row">
              <label className="settings-field">
                <span>タグ名</span>
                <input
                  type="text"
                  placeholder="例: 仕事"
                  value={newFixedTagName}
                  onChange={(event) => setNewFixedTagName(event.target.value)}
                />
              </label>
              <button
                className="settings-add-button"
                type="submit"
                disabled={isLoadingSettings}
              >
                追加
              </button>
            </div>
            <TagEntryKindSelector
              ariaLabel="新しい固定タグを使用する画面"
              disabled={isLoadingSettings}
              entryKinds={newFixedTagEntryKinds}
              onChange={setNewFixedTagEntryKinds}
            />
          </form>

          <div className="settings-existing-section">
            <div className="settings-list-heading">
              <h4>登録済みの固定タグ</h4>
              <span>{fixedTags.length}件</span>
            </div>
            <div className="settings-list">
              {fixedTags.length > 0 ? (
                fixedTags.map((tag) => (
                  <div className="settings-item settings-tag-item" key={tag.id}>
                    <div className="settings-item-main">
                      <input
                        aria-label={`${tag.name}のタグ名`}
                        type="text"
                        value={tag.name}
                        onChange={(event) =>
                          setFixedTags((currentTags) =>
                            currentTags.map((currentTag) =>
                              currentTag.id === tag.id
                                ? { ...currentTag, name: event.target.value }
                                : currentTag,
                            ),
                          )
                        }
                      />
                      <div className="settings-item-actions">
                        <button
                          type="button"
                          disabled={isLoadingSettings}
                          onClick={() => void handleUpdateFixedTag(tag)}
                        >
                          更新
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          disabled={isLoadingSettings}
                          onClick={() => setPendingDeletion({ kind: 'fixedTag', item: tag })}
                        >
                          解除
                        </button>
                      </div>
                    </div>
                    <TagEntryKindSelector
                      ariaLabel={`${tag.name}を使用する画面`}
                      disabled={isLoadingSettings}
                      entryKinds={tag.entryKinds}
                      onChange={(entryKinds) =>
                        setFixedTags((currentTags) =>
                          currentTags.map((currentTag) =>
                            currentTag.id === tag.id
                              ? { ...currentTag, entryKinds }
                              : currentTag,
                          ),
                        )
                      }
                    />
                  </div>
                ))
              ) : (
                <p className="settings-empty-message">固定タグはまだ登録されていません。</p>
              )}
            </div>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>習慣項目</h3>
          </div>

          <form
            className="settings-add-form settings-habit-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAddHabit()
            }}
          >
            <h4>新しい習慣を追加</h4>
            <div className="settings-name-row">
              <label className="settings-field">
                <span>習慣名</span>
                <input
                  type="text"
                  placeholder="例: 筋トレ"
                  value={newHabitName}
                  onChange={(event) => setNewHabitName(event.target.value)}
                />
              </label>
              <button
                className="settings-add-button"
                type="submit"
                disabled={isLoadingSettings}
              >
                追加
              </button>
            </div>
            <div className="settings-schedule-field">
              <span>実行曜日</span>
              <div className="weekday-selector" role="group" aria-label="新しい習慣の実行曜日">
                {WEEKDAYS.map((weekday) => {
                  const isSelected = newHabitWeekdays.includes(weekday.value)

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={isSelected ? 'active' : ''}
                      key={weekday.value}
                      type="button"
                      disabled={isLoadingSettings}
                      onClick={() =>
                        setNewHabitWeekdays((currentWeekdays) =>
                          isSelected
                            ? currentWeekdays.filter((value) => value !== weekday.value)
                            : [...currentWeekdays, weekday.value].sort(),
                        )
                      }
                    >
                      {weekday.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </form>

          <div className="settings-existing-section">
            <div className="settings-list-heading">
              <h4>登録済みの習慣</h4>
              <span>{habitSettings.length}件</span>
            </div>
            <div className="settings-list">
              {habitSettings.length > 0 ? (
                habitSettings.map((habit) => (
                  <div className="settings-item settings-habit-item" key={habit.id}>
                    <div className="settings-item-main">
                      <input
                        aria-label={`${habit.name}の習慣名`}
                        type="text"
                        value={habit.name}
                        onChange={(event) =>
                          setHabitSettings((currentHabits) =>
                            currentHabits.map((currentHabit) =>
                              currentHabit.id === habit.id
                                ? { ...currentHabit, name: event.target.value }
                                : currentHabit,
                            ),
                          )
                        }
                      />
                      <div className="settings-item-actions">
                        <button
                          type="button"
                          disabled={isLoadingSettings}
                          onClick={() => void handleUpdateHabit(habit)}
                        >
                          更新
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          disabled={isLoadingSettings}
                          onClick={() => setPendingDeletion({ kind: 'habit', item: habit })}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                    <div className="settings-schedule-field">
                      <span>実行曜日</span>
                      <div
                        className="weekday-selector"
                        role="group"
                        aria-label={`${habit.name}の実行曜日`}
                      >
                        {WEEKDAYS.map((weekday) => {
                          const isSelected = habit.weekdays.includes(weekday.value)

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={isSelected ? 'active' : ''}
                              key={weekday.value}
                              type="button"
                              disabled={isLoadingSettings}
                              onClick={() =>
                                setHabitSettings((currentHabits) =>
                                  currentHabits.map((currentHabit) =>
                                    currentHabit.id === habit.id
                                      ? {
                                          ...currentHabit,
                                          weekdays: isSelected
                                            ? currentHabit.weekdays.filter(
                                                (value) => value !== weekday.value,
                                              )
                                            : [...currentHabit.weekdays, weekday.value].sort(),
                                        }
                                      : currentHabit,
                                  ),
                                )
                              }
                            >
                              {weekday.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="settings-empty-message">習慣はまだ登録されていません。</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
