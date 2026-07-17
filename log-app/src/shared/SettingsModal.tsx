import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DeleteConfirmationModal } from './DeleteConfirmationModal'
import { WEEKDAYS } from './habits'
import type { FixedTagSetting, HabitSetting } from './types'

export type SettingsModalTarget = 'tag' | 'habit'
export type SettingsModalMode = 'add' | 'manage'

type SettingsModalProps = {
  target: SettingsModalTarget
  mode: SettingsModalMode
  onClose: () => void
  onSettingsChanged: () => void | Promise<void>
}

type PendingDeletion =
  | { target: 'tag'; item: FixedTagSetting }
  | { target: 'habit'; item: HabitSetting }

const ALL_WEEKDAYS = WEEKDAYS.map((weekday) => weekday.value)

function getModalTitle(target: SettingsModalTarget, mode: SettingsModalMode) {
  if (target === 'tag') {
    return mode === 'add' ? 'タグを追加' : 'タグを編集・削除'
  }

  return mode === 'add' ? '習慣を追加' : '習慣を編集・削除'
}

export function SettingsModal({
  target,
  mode,
  onClose,
  onSettingsChanged,
}: SettingsModalProps) {
  const [fixedTags, setFixedTags] = useState<FixedTagSetting[]>([])
  const [habits, setHabits] = useState<HabitSetting[]>([])
  const [newName, setNewName] = useState('')
  const [newHabitWeekdays, setNewHabitWeekdays] = useState<number[]>(ALL_WEEKDAYS)
  const [message, setMessage] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const isWorkingRef = useRef(isWorking)
  const onCloseRef = useRef(onClose)
  const pendingDeletionRef = useRef<PendingDeletion | null>(null)
  const titleId = useId()

  useEffect(() => {
    isWorkingRef.current = isWorking
  }, [isWorking])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    pendingDeletionRef.current = pendingDeletion
  }, [pendingDeletion])

  const loadSettings = useCallback(async () => {
    const settings = await window.logApp.listSettings()
    setFixedTags(settings.fixedTags)
    setHabits(settings.habits)
  }, [])

  useEffect(() => {
    let isMounted = true

    setIsWorking(true)
    loadSettings()
      .catch((error) => {
        console.error('設定の取得に失敗しました:', error)
        if (isMounted) {
          setMessage('設定の取得に失敗しました。SQLite の接続状態を確認してください。')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsWorking(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [loadSettings])

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      const firstFocusableElement = mode === 'add'
        ? firstInputRef.current
        : dialogRef.current?.querySelector<HTMLElement>(
            'input:not(:disabled), button:not(:disabled)',
          )
      firstFocusableElement?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (pendingDeletionRef.current) {
        return
      }

      if (event.key === 'Escape' && !isWorkingRef.current) {
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled)',
        ) ?? [],
      )

      if (focusableElements.length === 0) {
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElementRef.current?.focus()
    }
  }, [mode])

  const refreshAfterChange = async (nextMessage: string) => {
    await loadSettings()
    await onSettingsChanged()
    setMessage(nextMessage)
  }

  const handleAdd = async () => {
    const trimmedName = newName.trim()

    if (!trimmedName) {
      setMessage(target === 'tag' ? 'タグ名を入力してください。' : '習慣名を入力してください。')
      return
    }
    if (target === 'habit' && newHabitWeekdays.length === 0) {
      setMessage('実行する曜日を選択してください。')
      return
    }

    setIsWorking(true)
    setMessage('')

    try {
      if (target === 'tag') {
        await window.logApp.addFixedTag(trimmedName)
        await refreshAfterChange('タグを追加しました。')
      } else {
        await window.logApp.addHabit(trimmedName, newHabitWeekdays)
        setNewHabitWeekdays(ALL_WEEKDAYS)
        await refreshAfterChange('習慣を追加しました。')
      }
      setNewName('')
      firstInputRef.current?.focus()
    } catch (error) {
      console.error(`${target === 'tag' ? 'タグ' : '習慣'}の追加に失敗しました:`, error)
      setMessage(`${target === 'tag' ? 'タグ' : '習慣'}の追加に失敗しました。`)
    } finally {
      setIsWorking(false)
    }
  }

  const handleUpdateTag = async (tag: FixedTagSetting) => {
    if (!tag.name.trim()) {
      setMessage('タグ名を入力してください。')
      return
    }

    setIsWorking(true)
    setMessage('')

    try {
      await window.logApp.updateFixedTag(tag.id, tag.name.trim())
      await refreshAfterChange('タグを更新しました。')
    } catch (error) {
      console.error('タグの更新に失敗しました:', error)
      setMessage('タグの更新に失敗しました。')
    } finally {
      setIsWorking(false)
    }
  }

  const handleUpdateHabit = async (habit: HabitSetting) => {
    if (!habit.name.trim()) {
      setMessage('習慣名を入力してください。')
      return
    }
    if (habit.weekdays.length === 0) {
      setMessage('実行する曜日を選択してください。')
      return
    }

    setIsWorking(true)
    setMessage('')

    try {
      await window.logApp.updateHabit(habit.id, habit.name.trim(), habit.weekdays)
      await refreshAfterChange('習慣を更新しました。')
    } catch (error) {
      console.error('習慣の更新に失敗しました:', error)
      setMessage('習慣の更新に失敗しました。')
    } finally {
      setIsWorking(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDeletion) {
      return
    }

    setIsWorking(true)
    setMessage('')

    try {
      if (pendingDeletion.target === 'tag') {
        await window.logApp.deleteFixedTag(pendingDeletion.item.id)
        await refreshAfterChange('固定タグから外しました。過去の履歴タグは保持されます。')
      } else {
        await window.logApp.deleteHabit(pendingDeletion.item.id)
        await refreshAfterChange('習慣を削除しました。')
      }
    } catch (error) {
      console.error(`${pendingDeletion.target === 'tag' ? 'タグ' : '習慣'}の削除に失敗しました:`, error)
      setMessage(`${pendingDeletion.target === 'tag' ? 'タグ' : '習慣'}の削除に失敗しました。`)
    } finally {
      setIsWorking(false)
      setPendingDeletion(null)
    }
  }

  const renderWeekdaySelector = (
    selectedWeekdays: number[],
    onChange: (weekdays: number[]) => void,
    ariaLabel: string,
  ) => (
    <div className="weekday-selector" role="group" aria-label={ariaLabel}>
      {WEEKDAYS.map((weekday) => {
        const isSelected = selectedWeekdays.includes(weekday.value)

        return (
          <button
            aria-pressed={isSelected}
            className={isSelected ? 'active' : ''}
            key={weekday.value}
            type="button"
            disabled={isWorking}
            onClick={() =>
              onChange(
                isSelected
                  ? selectedWeekdays.filter((value) => value !== weekday.value)
                  : [...selectedWeekdays, weekday.value].sort(),
              )
            }
          >
            {weekday.label}
          </button>
        )
      })}
    </div>
  )

  const modal = (
    <div
      className="settings-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isWorking && !pendingDeletion) {
          onClose()
        }
      }}
    >
      <section
        aria-busy={isWorking}
        aria-labelledby={titleId}
        aria-modal="true"
        className="settings-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="settings-modal-header">
          <h3 id={titleId}>{getModalTitle(target, mode)}</h3>
          <button
            aria-label="閉じる"
            className="settings-modal-close"
            type="button"
            disabled={isWorking}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {message ? <p className="settings-modal-message">{message}</p> : null}

        {mode === 'add' ? (
          <form
            className="settings-add-form settings-modal-add-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAdd()
            }}
          >
            <label className="settings-field">
              <span>{target === 'tag' ? 'タグ名' : '習慣名'}</span>
              <input
                ref={firstInputRef}
                type="text"
                placeholder={target === 'tag' ? '例: 仕事' : '例: 筋トレ'}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </label>
            {target === 'habit' ? (
              <div className="settings-schedule-field">
                <span>実行曜日</span>
                {renderWeekdaySelector(
                  newHabitWeekdays,
                  setNewHabitWeekdays,
                  '新しい習慣の実行曜日',
                )}
              </div>
            ) : null}
            <div className="settings-modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={isWorking}
                onClick={onClose}
              >
                キャンセル
              </button>
              <button className="settings-add-button" type="submit" disabled={isWorking}>
                {isWorking ? '追加中...' : '追加する'}
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-existing-section settings-modal-existing-section">
            <div className="settings-list-heading">
              <h4>{target === 'tag' ? '登録済みの固定タグ' : '登録済みの習慣'}</h4>
              <span>{target === 'tag' ? fixedTags.length : habits.length}件</span>
            </div>
            <div className="settings-list settings-modal-list">
              {target === 'tag' && fixedTags.length > 0
                ? fixedTags.map((tag) => (
                    <div className="settings-item settings-item-compact" key={tag.id}>
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
                          disabled={isWorking}
                          onClick={() => void handleUpdateTag(tag)}
                        >
                          更新
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          disabled={isWorking}
                          onClick={() => setPendingDeletion({ target: 'tag', item: tag })}
                        >
                          解除
                        </button>
                      </div>
                    </div>
                  ))
                : null}
              {target === 'habit' && habits.length > 0
                ? habits.map((habit) => (
                    <div className="settings-item settings-habit-item" key={habit.id}>
                      <div className="settings-item-main">
                        <input
                          aria-label={`${habit.name}の習慣名`}
                          type="text"
                          value={habit.name}
                          onChange={(event) =>
                            setHabits((currentHabits) =>
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
                            disabled={isWorking}
                            onClick={() => void handleUpdateHabit(habit)}
                          >
                            更新
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            disabled={isWorking}
                            onClick={() => setPendingDeletion({ target: 'habit', item: habit })}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <div className="settings-schedule-field">
                        <span>実行曜日</span>
                        {renderWeekdaySelector(
                          habit.weekdays,
                          (weekdays) =>
                            setHabits((currentHabits) =>
                              currentHabits.map((currentHabit) =>
                                currentHabit.id === habit.id
                                  ? { ...currentHabit, weekdays }
                                  : currentHabit,
                              ),
                            ),
                          `${habit.name}の実行曜日`,
                        )}
                      </div>
                    </div>
                  ))
                : null}
              {(target === 'tag' ? fixedTags.length === 0 : habits.length === 0) ? (
                <p className="settings-empty-message">
                  {target === 'tag'
                    ? '固定タグはまだ登録されていません。'
                    : '習慣はまだ登録されていません。'}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {pendingDeletion ? (
        <DeleteConfirmationModal
          confirmLabel={pendingDeletion.target === 'tag' ? '固定タグから外す' : '削除する'}
          description={
            pendingDeletion.target === 'tag'
              ? `「${pendingDeletion.item.name}」を固定タグから外します。過去の履歴に付いたタグは保持されます。`
              : `習慣項目「${pendingDeletion.item.name}」と実行記録を削除します。この操作は元に戻せません。`
          }
          isDeleting={isWorking}
          title={pendingDeletion.target === 'tag' ? '固定タグを外しますか？' : '習慣項目を削除しますか？'}
          onCancel={() => setPendingDeletion(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  )

  return createPortal(modal, document.body)
}
