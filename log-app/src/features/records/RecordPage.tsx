import { type FocusEvent, type KeyboardEvent, useCallback, useEffect, useState } from 'react'
import {
  createInitialBulletPointLine,
  insertBulletPointLine,
} from '../../shared/bulletPoints'
import { getTodayString } from '../../shared/date'
import { SettingsModal, type SettingsModalMode } from '../../shared/SettingsModal'
import { SettingsShortcuts } from '../../shared/SettingsShortcuts'
import type { FeaturePageProps, FixedTagSetting } from '../../shared/types'

// 習慣チェックを含めない、軽いメモ用の記録画面。
export function RecordPage({ isActive }: FeaturePageProps) {
  const [date, setDate] = useState(getTodayString)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [bulletPoints, setBulletPoints] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [fixedTags, setFixedTags] = useState<FixedTagSetting[]>([])
  const [selectedFixedTagIds, setSelectedFixedTagIds] = useState<number[]>([])
  const [openTagSettingsMode, setOpenTagSettingsMode] = useState<SettingsModalMode | null>(null)

  // 記録画面でも日記と同じ固定タグを共有して使う。
  const loadRecordSettings = useCallback(async () => {
    try {
      const settings = await window.logApp.listSettings()
      setFixedTags(settings.fixedTags)
      setSelectedFixedTagIds((currentIds) =>
        currentIds.filter((id) => settings.fixedTags.some((tag) => tag.id === id)),
      )
    } catch (error) {
      console.error('記録用設定の取得に失敗しました:', error)
      setMessage('設定の取得に失敗しました。SQLite の接続状態を確認してください。')
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      void loadRecordSettings()
    }
  }, [isActive, loadRecordSettings])

  const resetRecordForm = () => {
    setDate(getTodayString())
    setTitle('')
    setTags('')
    setContent('')
    setBulletPoints('')
    setSelectedFixedTagIds([])
  }

  // 箇条書きメモで Enter を押した時、次の行に「・ 」を入れる。
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

  // 空の箇条書きメモ欄に入った時、最初の行にも「・ 」を入れる。
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

  // 日付、タグ、本文だけを記録として保存する。
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
    if (!content.trim() && !bulletPoints.trim()) {
      setMessage('記録内容か箇条書きメモを入力してください。')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const result = await window.logApp.saveEntry({
        kind: 'record',
        date,
        title,
        tags: mergedTags,
        content,
        bulletPoints,
        habits: [],
      })

      setMessage(`記録を保存しました。ID: ${result.id} / タグ: ${result.tagCount}件`)
      resetRecordForm()
    } catch (error) {
      console.error('記録の保存に失敗しました:', error)
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
      <h2>記録</h2>

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
        <div className="field-heading">
          <label htmlFor="record-tags">タグ</label>
          <SettingsShortcuts
            target="タグ"
            onAdd={() => setOpenTagSettingsMode('add')}
            onManage={() => setOpenTagSettingsMode('manage')}
          />
        </div>
        {/* 固定タグは日記と記録で共有し、自由入力タグと一緒に保存する。 */}
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
          id="record-tags"
          type="text"
          placeholder="自由入力タグ（例: 仕事, アイデア）"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </div>

      {/* 短い出来事を本文から分けて保存し、履歴検索でも見つけられるようにする。 */}
      <label className="field">
        <span>箇条書きメモ</span>
        <textarea
          rows={4}
          placeholder="・ 気になったアイデア"
          value={bulletPoints}
          onFocus={handleBulletPointsFocus}
          onKeyDown={handleBulletPointsKeyDown}
          onChange={(event) => setBulletPoints(event.target.value)}
        />
      </label>

      <label className="field">
        <span>記録内容</span>
        <textarea
          rows={5}
          placeholder="残しておきたいことを書きます。"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </label>

      <div className="form-actions">
        <button type="submit" disabled={isSaving}>
          {isSaving ? '保存中...' : '保存する'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isSaving}
          onClick={() => {
            resetRecordForm()
            setMessage('')
          }}
        >
          クリア
        </button>
        {message ? <p className="save-message">{message}</p> : null}
      </div>

      {openTagSettingsMode ? (
        <SettingsModal
          mode={openTagSettingsMode}
          target="tag"
          onClose={() => setOpenTagSettingsMode(null)}
          onSettingsChanged={loadRecordSettings}
        />
      ) : null}
    </form>
  )
}
