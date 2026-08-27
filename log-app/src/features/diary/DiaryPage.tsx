import { type FocusEvent, type KeyboardEvent, useCallback, useEffect, useState } from 'react'
import {
  createInitialBulletPointLine,
  insertBulletPointLine,
} from '../../shared/bulletPoints'
import { getIsoWeekday, getTodayString } from '../../shared/date'
import { WEEKDAYS } from '../../shared/habits'
import {
  SettingsModal,
  type SettingsModalMode,
  type SettingsModalTarget,
} from '../../shared/SettingsModal'
import { SettingsShortcuts } from '../../shared/SettingsShortcuts'
import type {
  DiaryDateRequest,
  FeaturePageProps,
  FixedTagSetting,
  HabitSetting,
} from '../../shared/types'
import {
  CONDITION_OPTIONS,
  MOOD_OPTIONS,
  parseWellbeingScore,
  type WellbeingScore,
} from '../../shared/wellbeing'
import { AiDraftPreviewModal } from './AiDraftPreviewModal'

type DiaryPageProps = FeaturePageProps & {
  onOpenAiSettings: () => void
  requestedDate: DiaryDateRequest | null
}

type OpenSettingsModal = {
  target: SettingsModalTarget
  mode: SettingsModalMode
}

type AiDraftPreview = {
  draft: AiDiaryDraft
  mode: 'generate' | 'rewrite'
}

export function DiaryPage({ isActive, onOpenAiSettings, requestedDate }: DiaryPageProps) {
  const [date, setDate] = useState(getTodayString)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [bulletPoints, setBulletPoints] = useState('')
  const [breakfast, setBreakfast] = useState('')
  const [lunch, setLunch] = useState('')
  const [dinner, setDinner] = useState('')
  const [moodScore, setMoodScore] = useState<WellbeingScore | null>(null)
  const [conditionScore, setConditionScore] = useState<WellbeingScore | null>(null)
  const [habitChecks, setHabitChecks] = useState<Record<number, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [fixedTags, setFixedTags] = useState<FixedTagSetting[]>([])
  const [selectedFixedTagIds, setSelectedFixedTagIds] = useState<number[]>([])
  const [habitSettings, setHabitSettings] = useState<HabitSetting[]>([])
  const [openSettingsModal, setOpenSettingsModal] = useState<OpenSettingsModal | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettingsSummary | null>(null)
  const [aiWorkingMode, setAiWorkingMode] = useState<'generate' | 'rewrite' | null>(null)
  const [aiMessage, setAiMessage] = useState('')
  const [aiDraftPreview, setAiDraftPreview] = useState<AiDraftPreview | null>(null)
  const isAiWorking = aiWorkingMode !== null

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

  const loadAiSettings = useCallback(async () => {
    try {
      const settings = await window.logApp.getAiSettings()
      setAiSettings(settings)
      setAiMessage((currentMessage) => (
        settings.configured && currentMessage === '最初にOpenAI APIキーを設定してください。'
          ? 'OpenAI APIキーを設定しました。AIアシストを利用できます。'
          : currentMessage
      ))
    } catch (error) {
      console.error('AI設定の取得に失敗しました:', error)
      setAiMessage('AI設定を取得できませんでした。')
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      void loadDiarySettings()
      void loadAiSettings()
    }
  }, [isActive, loadAiSettings, loadDiarySettings])

  useEffect(() => {
    if (!requestedDate) {
      return
    }

    setDate(requestedDate.date)
    setMessage(`${requestedDate.date}の日記を入力できます。`)
  }, [requestedDate])

  const getMergedTags = () => {
    const customTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    const selectedFixedTags = fixedTags
      .filter((tag) => selectedFixedTagIds.includes(tag.id))
      .map((tag) => tag.name)

    return [...new Set([...selectedFixedTags, ...customTags])]
  }

  const resetDiaryForm = () => {
    setDate(getTodayString())
    setTitle('')
    setTags('')
    setContent('')
    setBulletPoints('')
    setBreakfast('')
    setLunch('')
    setDinner('')
    setMoodScore(null)
    setConditionScore(null)
    setSelectedFixedTagIds([])
    setHabitChecks(Object.fromEntries(habitSettings.map((habit) => [habit.id, false])))
    setAiDraftPreview(null)
    setAiMessage('')
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

  const handleAiRequest = async (mode: 'generate' | 'rewrite') => {
    if (!aiSettings?.configured) {
      setAiMessage('最初にOpenAI APIキーを設定してください。')
      onOpenAiSettings()
      return
    }

    if (mode === 'rewrite' && !content.trim()) {
      setAiMessage('文章を整えるには、先に日記本文を入力してください。')
      return
    }

    setAiWorkingMode(mode)
    setAiMessage('')

    try {
      const draft = await window.logApp.generateDiaryDraft({
        mode,
        date,
        title,
        tags: getMergedTags(),
        content,
        bulletPoints,
        breakfast,
        lunch,
        dinner,
        moodScore,
        conditionScore,
      })

      setAiDraftPreview({ draft, mode })
    } catch (error) {
      console.error('AIによる日記作成に失敗しました:', error)
      setAiMessage(error instanceof Error ? error.message : 'AIによる日記作成に失敗しました。')
    } finally {
      setAiWorkingMode(null)
    }
  }

  const handleSave = async () => {
    const mergedTags = getMergedTags()

    if (!date) {
      setMessage('日付を入力してください。')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const result = await window.logApp.saveEntry({
        date,
        title,
        tags: mergedTags,
        content,
        bulletPoints,
        breakfast,
        lunch,
        dinner,
        moodScore,
        conditionScore,
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

        // 設定モーダルなど、子コンポーネントのフォーム送信では日記を保存しない。
        if (event.target !== event.currentTarget) {
          return
        }

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

      <fieldset className="wellbeing-fieldset">
        <legend>今日の調子（任意）</legend>
        <div className="wellbeing-input-grid">
          <label>
            <span>気分</span>
            <select
              value={moodScore ?? ''}
              onChange={(event) => setMoodScore(parseWellbeingScore(event.target.value))}
            >
              <option value="">未設定</option>
              {MOOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.emoji} {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>体調</span>
            <select
              value={conditionScore ?? ''}
              onChange={(event) => setConditionScore(parseWellbeingScore(event.target.value))}
            >
              <option value="">未設定</option>
              {CONDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.emoji} {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="meal-fieldset">
        <legend>今日の食事（任意）</legend>
        <div className="meal-input-grid">
          <label>
            <span>朝食</span>
            <textarea
              rows={2}
              placeholder="例: トースト、ヨーグルト"
              value={breakfast}
              onChange={(event) => setBreakfast(event.target.value)}
            />
          </label>
          <label>
            <span>昼食</span>
            <textarea
              rows={2}
              placeholder="例: おにぎり、みそ汁"
              value={lunch}
              onChange={(event) => setLunch(event.target.value)}
            />
          </label>
          <label>
            <span>夕食</span>
            <textarea
              rows={2}
              placeholder="例: カレー、サラダ"
              value={dinner}
              onChange={(event) => setDinner(event.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <div className="field">
        <div className="field-heading">
          <label htmlFor="diary-tags">タグ</label>
          <SettingsShortcuts
            target="タグ"
            onAdd={() => setOpenSettingsModal({ target: 'tag', mode: 'add' })}
            onManage={() => setOpenSettingsModal({ target: 'tag', mode: 'manage' })}
          />
        </div>
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

      <section className="ai-assist-panel" aria-labelledby="ai-assist-heading">
        <div className="ai-assist-header">
          <div className="ai-assist-title-row">
            <h3 id="ai-assist-heading">AIアシスト</h3>
            <span className={aiSettings?.configured ? 'configured' : ''}>
              {!aiSettings ? '設定確認中' : aiSettings.configured ? '利用可能' : '未設定'}
            </span>
          </div>
          <button
            className="secondary-button ai-assist-settings-button"
            type="button"
            disabled={isAiWorking || isSaving}
            onClick={onOpenAiSettings}
          >
            AI設定を開く
          </button>
        </div>
        <p className="ai-assist-description">
          箇条書きメモや食事、タグから本文を作成したり、入力済みの文章を読みやすく整えたりできます。
        </p>
        <div className="ai-assist-actions">
          <button
            type="button"
            disabled={isAiWorking || isSaving}
            onClick={() => void handleAiRequest('generate')}
          >
            {aiWorkingMode === 'generate' ? '本文を作成中...' : 'AIで本文を作る'}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isAiWorking || isSaving || !content.trim()}
            onClick={() => void handleAiRequest('rewrite')}
          >
            {aiWorkingMode === 'rewrite' ? '文章を調整中...' : 'AIで文章を整える'}
          </button>
        </div>
        <p className="ai-assist-notice">
          実行時に現在の入力内容をOpenAI APIへ送信します。提案は確認後に反映され、自動保存されません。
        </p>
        {aiMessage ? <p className="ai-assist-message" role="status">{aiMessage}</p> : null}
      </section>

      <section className="habit-fieldset" aria-labelledby="today-habits-heading">
        <div className="habit-fieldset-header">
          <h3 id="today-habits-heading">
            今日の習慣（{WEEKDAYS.find((weekday) => weekday.value === selectedDateWeekday)?.label ?? '-'}）
          </h3>
          <SettingsShortcuts
            target="習慣"
            onAdd={() => setOpenSettingsModal({ target: 'habit', mode: 'add' })}
            onManage={() => setOpenSettingsModal({ target: 'habit', mode: 'manage' })}
          />
        </div>
        <div className="habit-check-list">
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
        </div>
      </section>

      <div className="form-actions">
        <button type="submit" disabled={isSaving || isAiWorking}>
          {isSaving ? '保存中...' : '保存する'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isSaving || isAiWorking}
          onClick={() => {
            resetDiaryForm()
            setMessage('')
          }}
        >
          クリア
        </button>
        {message ? <p className="save-message">{message}</p> : null}
      </div>

      {openSettingsModal ? (
        <SettingsModal
          mode={openSettingsModal.mode}
          target={openSettingsModal.target}
          onClose={() => setOpenSettingsModal(null)}
          onSettingsChanged={loadDiarySettings}
        />
      ) : null}

      {aiDraftPreview ? (
        <AiDraftPreviewModal
          currentContent={content}
          currentTitle={title}
          draft={aiDraftPreview.draft}
          mode={aiDraftPreview.mode}
          onApply={() => {
            setTitle(aiDraftPreview.draft.title)
            setContent(aiDraftPreview.draft.content)
            setAiDraftPreview(null)
            setAiMessage('AIの提案を本文に反映しました。内容を確認してから保存してください。')
          }}
          onClose={() => setAiDraftPreview(null)}
        />
      ) : null}
    </form>
  )
}
