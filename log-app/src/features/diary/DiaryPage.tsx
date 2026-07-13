import { type FocusEvent, type KeyboardEvent, useCallback, useEffect, useState } from 'react'
import {
  createInitialBulletPointLine,
  insertBulletPointLine,
} from '../../shared/bulletPoints'
import { getIsoWeekday, getTodayString } from '../../shared/date'
import { WEEKDAYS } from '../../shared/habits'
import type { FeaturePageProps, FixedTagSetting, HabitSetting } from '../../shared/types'

export function DiaryPage({ isActive }: FeaturePageProps) {
  const [date, setDate] = useState(getTodayString)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [bulletPoints, setBulletPoints] = useState('')
  const [habitChecks, setHabitChecks] = useState<Record<number, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [fixedTags, setFixedTags] = useState<FixedTagSetting[]>([])
  const [selectedFixedTagIds, setSelectedFixedTagIds] = useState<number[]>([])
  const [habitSettings, setHabitSettings] = useState<HabitSetting[]>([])

  const selectedDateWeekday = getIsoWeekday(date)
  const scheduledHabitSettings = habitSettings.filter((habit) =>
    habit.weekdays.includes(selectedDateWeekday),
  )

  const loadDiarySettings = useCallback(async () => {
    try {
      const settings = await window.logApp.listSettings()
      setFixedTags(settings.fixedTags)
      setSelectedFixedTagIds((currentIds) =>
        currentIds.filter((id) => settings.fixedTags.some((tag) => tag.id === id)),
      )
      setHabitSettings(settings.habits)
      setHabitChecks((currentChecks) =>
        Object.fromEntries(
          settings.habits.map((habit) => [habit.id, currentChecks[habit.id] ?? false]),
        ),
      )
    } catch (error) {
      console.error('日記用設定の取得に失敗しました:', error)
      setMessage('設定の取得に失敗しました。SQLite の接続状態を確認してください。')
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      void loadDiarySettings()
    }
  }, [isActive, loadDiarySettings])

  const resetDiaryForm = () => {
    setDate(getTodayString())
    setTitle('')
    setTags('')
    setContent('')
    setBulletPoints('')
    setSelectedFixedTagIds([])
    setHabitChecks(Object.fromEntries(habitSettings.map((habit) => [habit.id, false])))
  }

  const handleBulletPointsKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()

    const textArea = event.currentTarget
    const nextBulletPoints = insertBulletPointLine(
      textArea.value,
      textArea.selectionStart,
      textArea.selectionEnd,
    )

    setBulletPoints(nextBulletPoints.value)
    requestAnimationFrame(() => {
      textArea.setSelectionRange(nextBulletPoints.caretPosition, nextBulletPoints.caretPosition)
    })
  }

  const handleBulletPointsFocus = (event: FocusEvent<HTMLTextAreaElement>) => {
    const initialBulletPoints = createInitialBulletPointLine(bulletPoints)

    if (!initialBulletPoints) {
      return
    }

    const textArea = event.currentTarget

    setBulletPoints(initialBulletPoints.value)
    requestAnimationFrame(() => {
      textArea.setSelectionRange(
        initialBulletPoints.caretPosition,
        initialBulletPoints.caretPosition,
      )
    })
  }

  const handleSave = async () => {
    const customTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    const selectedFixedTags = fixedTags
      .filter((tag) => selectedFixedTagIds.includes(tag.id))
      .map((tag) => tag.name)
    const mergedTags = [...new Set([...selectedFixedTags, ...customTags])]

    if (!date) {
      setMessage('日付を入力してください。')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const result = await window.logApp.saveEntry({
        kind: 'diary',
        date,
        title,
        tags: mergedTags,
        content,
        bulletPoints,
        habits: scheduledHabitSettings.map((habit) => ({
          id: habit.id,
          isDone: habitChecks[habit.id] ?? false,
        })),
      })

      setMessage(
        `保存しました。ID: ${result.id} / タグ: ${result.tagCount}件 / 習慣: ${result.habitLogCount}件`,
      )
      resetDiaryForm()
    } catch (error) {
      console.error('日記の保存に失敗しました:', error)
      setMessage('保存に失敗しました。SQLite の接続状態を確認してください。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      className="log-form"
      hidden={!isActive}
      onSubmit={(event) => {
        event.preventDefault()
        void handleSave()
      }}
    >
      <h2>今日の日記</h2>

      <label className="field">
        <span>日付</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>

      <label className="field">
        <span>タイトル</span>
        <input
          type="text"
          placeholder="無題"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <div className="field">
        <label htmlFor="diary-tags">タグ</label>
        {fixedTags.length > 0 ? (
          <div className="fixed-tag-selector" aria-label="固定タグを選択">
            {fixedTags.map((tag) => {
              const isSelected = selectedFixedTagIds.includes(tag.id)

              return (
                <button
                  aria-pressed={isSelected}
                  className={isSelected ? 'active' : ''}
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setSelectedFixedTagIds((currentIds) =>
                      isSelected
                        ? currentIds.filter((id) => id !== tag.id)
                        : [...currentIds, tag.id],
                    )
                  }
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        ) : null}
        <input
          id="diary-tags"
          type="text"
          placeholder="自由入力タグ（例: 仕事, 買い物）"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </div>

      <label className="field">
        <span>箇条書きメモ</span>
        <textarea
          rows={4}
          placeholder="・ 朝に散歩した"
          value={bulletPoints}
          onFocus={handleBulletPointsFocus}
          onKeyDown={handleBulletPointsKeyDown}
          onChange={(event) => setBulletPoints(event.target.value)}
        />
      </label>

      <label className="field">
        <span>出来事・日記</span>
        <textarea
          rows={4}
          placeholder="今日はどんな一日でしたか？"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </label>

      <fieldset className="habit-fieldset">
        <legend>
          今日の習慣（{WEEKDAYS.find((weekday) => weekday.value === selectedDateWeekday)?.label ?? '-'}）
        </legend>
        {scheduledHabitSettings.length > 0 ? (
          scheduledHabitSettings.map((habit) => (
            <label key={habit.id}>
              <input
                type="checkbox"
                checked={habitChecks[habit.id] ?? false}
                onChange={(event) =>
                  setHabitChecks((currentChecks) => ({
                    ...currentChecks,
                    [habit.id]: event.target.checked,
                  }))
                }
              />
              {habit.name}
            </label>
          ))
        ) : (
          <p className="empty-habit-message">この曜日に予定されている習慣はありません。</p>
        )}
      </fieldset>

      <div className="form-actions">
        <button type="submit" disabled={isSaving}>
          {isSaving ? '保存中...' : '保存する'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isSaving}
          onClick={() => {
            resetDiaryForm()
            setMessage('')
          }}
        >
          クリア
        </button>
        {message ? <p className="save-message">{message}</p> : null}
      </div>
    </form>
  )
}
