import { type FocusEvent, type KeyboardEvent, useCallback, useEffect, useState } from 'react'
import {
  createInitialBulletPointLine,
  insertBulletPointLine,
} from '../../shared/bulletPoints'
import type { EntryKind, FeaturePageProps } from '../../shared/types'

type HistoryEntry = {
  id: number
  kind: EntryKind
  date: string
  title: string
  content: string
  bulletPoints: string
  tags: string[]
}

type HistorySearchFilters = {
  kind: EntryKind
  keyword: string
  tag: string
  startDate: string
  endDate: string
}

type HistoryEditDraft = {
  id: number
  kind: EntryKind
  date: string
  title: string
  content: string
  bulletPoints: string
  tags: string
}

const ENTRY_KIND_LABELS: Record<EntryKind, string> = {
  diary: '日記',
  record: '記録',
}

function createEmptyFilters(kind: EntryKind): HistorySearchFilters {
  return {
    kind,
    keyword: '',
    tag: '',
    startDate: '',
    endDate: '',
  }
}

function splitBulletPoints(bulletPoints: string) {
  return bulletPoints
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-・*]\s*/, '').trim())
    .filter(Boolean)
}

export function HistoryPage({ isActive }: FeaturePageProps) {
  const [historyKind, setHistoryKind] = useState<EntryKind>('diary')
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [historyMessage, setHistoryMessage] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isMutatingHistory, setIsMutatingHistory] = useState(false)
  const [historyKeyword, setHistoryKeyword] = useState('')
  const [historyTag, setHistoryTag] = useState('')
  const [historyStartDate, setHistoryStartDate] = useState('')
  const [historyEndDate, setHistoryEndDate] = useState('')
  const [historySearchFilters, setHistorySearchFilters] =
    useState<HistorySearchFilters>(() => createEmptyFilters('diary'))
  const [historyEditDraft, setHistoryEditDraft] = useState<HistoryEditDraft | null>(null)
  const [pendingHistoryDeletion, setPendingHistoryDeletion] = useState<HistoryEntry | null>(null)
  const [expandedHistoryDetailIds, setExpandedHistoryDetailIds] = useState<number[]>([])

  const selectedTag = historySearchFilters.tag
  const historyTags = [...new Set(historyEntries.flatMap((entry) => entry.tags))].sort()

  const toggleHistoryDetail = (entryId: number) => {
    setExpandedHistoryDetailIds((currentIds) =>
      currentIds.includes(entryId)
        ? currentIds.filter((currentId) => currentId !== entryId)
        : [...currentIds, entryId],
    )
  }

  const loadHistoryEntries = useCallback(async () => {
    setIsLoadingHistory(true)
    setHistoryMessage('')

    try {
      const entries = await window.logApp.listEntries(historySearchFilters)
      setHistoryEntries(entries)

      if (entries.length === 0) {
        const hasSearchCondition = Object.entries(historySearchFilters).some(
          ([key, value]) => key !== 'kind' && value !== undefined && value !== '',
        )
        setHistoryMessage(
          hasSearchCondition
            ? `検索条件に一致する${ENTRY_KIND_LABELS[historyKind]}がありません。`
            : `まだ${ENTRY_KIND_LABELS[historyKind]}がありません。`,
        )
      }
    } catch (error) {
      console.error('履歴の取得に失敗しました:', error)
      setHistoryMessage('履歴の取得に失敗しました。SQLite の接続状態を確認してください。')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [historyKind, historySearchFilters])

  useEffect(() => {
    if (isActive) {
      void loadHistoryEntries()
    }
  }, [isActive, loadHistoryEntries])

  const handleHistorySearch = () => {
    if (historyStartDate && historyEndDate && historyStartDate > historyEndDate) {
      setHistoryMessage('開始日は終了日以前の日付を指定してください。')
      return
    }

    setHistoryEditDraft(null)
    setPendingHistoryDeletion(null)
    setExpandedHistoryDetailIds([])
    setHistorySearchFilters({
      kind: historyKind,
      keyword: historyKeyword.trim(),
      tag: historyTag.trim(),
      startDate: historyStartDate,
      endDate: historyEndDate,
    })
  }

  const resetHistorySearch = () => {
    setHistoryKeyword('')
    setHistoryTag('')
    setHistoryStartDate('')
    setHistoryEndDate('')
    setHistoryEditDraft(null)
    setPendingHistoryDeletion(null)
    setExpandedHistoryDetailIds([])
    setHistorySearchFilters(createEmptyFilters(historyKind))
  }

  const handleKindChange = (kind: EntryKind) => {
    setHistoryKind(kind)
    setHistoryKeyword('')
    setHistoryTag('')
    setHistoryStartDate('')
    setHistoryEndDate('')
    setHistoryEditDraft(null)
    setPendingHistoryDeletion(null)
    setExpandedHistoryDetailIds([])
    setHistorySearchFilters(createEmptyFilters(kind))
  }

  const applyHistoryTagFilter = (tag: string) => {
    setHistoryTag(tag)
    setHistoryEditDraft(null)
    setPendingHistoryDeletion(null)
    setExpandedHistoryDetailIds([])
    setHistorySearchFilters((currentFilters) => ({
      ...currentFilters,
      kind: historyKind,
      tag,
    }))
  }

  const startHistoryEdit = (entry: HistoryEntry) => {
    setHistoryEditDraft({
      id: entry.id,
      kind: entry.kind,
      date: entry.date,
      title: entry.title,
      content: entry.content,
      bulletPoints: entry.bulletPoints,
      tags: entry.tags.join(', '),
    })
    setPendingHistoryDeletion(null)
    setExpandedHistoryDetailIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== entry.id),
    )
    setHistoryMessage('')
  }

  const handleEditBulletPointsKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!historyEditDraft || event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()

    const textArea = event.currentTarget
    const nextBulletPoints = insertBulletPointLine(
      textArea.value,
      textArea.selectionStart,
      textArea.selectionEnd,
    )

    setHistoryEditDraft({
      ...historyEditDraft,
      bulletPoints: nextBulletPoints.value,
    })
    requestAnimationFrame(() => {
      textArea.setSelectionRange(nextBulletPoints.caretPosition, nextBulletPoints.caretPosition)
    })
  }

  const handleEditBulletPointsFocus = (event: FocusEvent<HTMLTextAreaElement>) => {
    if (!historyEditDraft) {
      return
    }

    const initialBulletPoints = createInitialBulletPointLine(historyEditDraft.bulletPoints)

    if (!initialBulletPoints) {
      return
    }

    const textArea = event.currentTarget

    setHistoryEditDraft({
      ...historyEditDraft,
      bulletPoints: initialBulletPoints.value,
    })
    requestAnimationFrame(() => {
      textArea.setSelectionRange(
        initialBulletPoints.caretPosition,
        initialBulletPoints.caretPosition,
      )
    })
  }

  const handleUpdateHistoryEntry = async () => {
    if (!historyEditDraft) {
      return
    }
    if (!historyEditDraft.date) {
      setHistoryMessage('日付を入力してください。')
      return
    }

    setIsMutatingHistory(true)
    setHistoryMessage('')

    try {
      const result = await window.logApp.updateEntry({
        id: historyEditDraft.id,
        date: historyEditDraft.date,
        title: historyEditDraft.title,
        content: historyEditDraft.content,
        bulletPoints: historyEditDraft.bulletPoints,
        tags: historyEditDraft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      const updatedKindLabel = ENTRY_KIND_LABELS[historyEditDraft.kind]
      setHistoryEditDraft(null)
      await loadHistoryEntries()
      setHistoryMessage(`${updatedKindLabel}を更新しました。タグ: ${result.tagCount}件`)
    } catch (error) {
      console.error('履歴の更新に失敗しました:', error)
      setHistoryMessage('履歴の更新に失敗しました。')
    } finally {
      setIsMutatingHistory(false)
    }
  }

  const handleDeleteHistoryEntry = async () => {
    if (!pendingHistoryDeletion) {
      return
    }

    setIsMutatingHistory(true)
    setHistoryMessage('')

    try {
      await window.logApp.deleteEntry(pendingHistoryDeletion.id)
      const deletedKindLabel = ENTRY_KIND_LABELS[pendingHistoryDeletion.kind]
      setPendingHistoryDeletion(null)
      setHistoryEditDraft(null)
      await loadHistoryEntries()
      setHistoryMessage(`${deletedKindLabel}を削除しました。`)
    } catch (error) {
      console.error('履歴の削除に失敗しました:', error)
      setHistoryMessage('履歴の削除に失敗しました。')
    } finally {
      setIsMutatingHistory(false)
    }
  }

  return (
    <section className="history-section" hidden={!isActive}>
      <div className="section-heading">
        <h2>履歴</h2>
        <button
          className="secondary-button"
          type="button"
          disabled={isLoadingHistory || isMutatingHistory}
          onClick={() => void loadHistoryEntries()}
        >
          {isLoadingHistory ? '読み込み中...' : '更新'}
        </button>
      </div>

      <div className="history-kind-tabs" aria-label="履歴の種類">
        {(
          [
            ['diary', '日記'],
            ['record', '記録'],
          ] as const
        ).map(([kind, label]) => (
          <button
            aria-pressed={historyKind === kind}
            className={historyKind === kind ? 'active' : ''}
            key={kind}
            type="button"
            onClick={() => handleKindChange(kind)}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        className="history-search-form"
        onSubmit={(event) => {
          event.preventDefault()
          handleHistorySearch()
        }}
      >
        <label className="history-search-keyword">
          <span>キーワード</span>
          <input
            type="search"
            placeholder={`${ENTRY_KIND_LABELS[historyKind]}のキーワードを検索`}
            value={historyKeyword}
            onChange={(event) => setHistoryKeyword(event.target.value)}
          />
        </label>
        <label>
          <span>タグ名（完全一致）</span>
          <input
            type="search"
            placeholder="例: 仕事"
            value={historyTag}
            onChange={(event) => setHistoryTag(event.target.value)}
          />
        </label>
        <label>
          <span>開始日</span>
          <input
            type="date"
            value={historyStartDate}
            onChange={(event) => setHistoryStartDate(event.target.value)}
          />
        </label>
        <label>
          <span>終了日</span>
          <input
            type="date"
            value={historyEndDate}
            onChange={(event) => setHistoryEndDate(event.target.value)}
          />
        </label>
        <div className="history-search-actions">
          <button type="submit" disabled={isLoadingHistory || isMutatingHistory}>
            検索
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isLoadingHistory || isMutatingHistory}
            onClick={resetHistorySearch}
          >
            条件クリア
          </button>
        </div>
      </form>

      {historyTags.length > 0 ? (
        <div className="tag-filter" aria-label="タグで絞り込み">
          <button
            className={!selectedTag ? 'active' : ''}
            type="button"
            onClick={() => applyHistoryTagFilter('')}
          >
            すべて
          </button>
          {historyTags.map((tag) => (
            <button
              className={selectedTag === tag ? 'active' : ''}
              key={tag}
              type="button"
              onClick={() => applyHistoryTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {historyMessage ? <p className="history-message">{historyMessage}</p> : null}
      {!historyMessage ? (
        <p className="history-result-count">表示件数: {historyEntries.length}件</p>
      ) : null}

      <div className="history-list">
        {historyEntries.map((entry) => {
          const isEditing = historyEditDraft?.id === entry.id
          const isPendingDeletion = pendingHistoryDeletion?.id === entry.id
          const isDetailOpen = expandedHistoryDetailIds.includes(entry.id)
          const bulletPointItems = splitBulletPoints(entry.bulletPoints)
          const detailPanelId = `history-detail-${entry.id}`

          return (
            <article className="history-item" key={entry.id}>
              {isEditing && historyEditDraft ? (
                <div className="history-edit-form">
                  <label>
                    <span>日付</span>
                    <input
                      type="date"
                      value={historyEditDraft.date}
                      onChange={(event) =>
                        setHistoryEditDraft({
                          ...historyEditDraft,
                          date: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>タイトル</span>
                    <input
                      type="text"
                      placeholder="無題"
                      value={historyEditDraft.title}
                      onChange={(event) =>
                        setHistoryEditDraft({
                          ...historyEditDraft,
                          title: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="history-edit-wide">
                    <span>タグ</span>
                    <input
                      type="text"
                      value={historyEditDraft.tags}
                      onChange={(event) =>
                        setHistoryEditDraft({
                          ...historyEditDraft,
                          tags: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="history-edit-wide">
                    <span>{entry.kind === 'diary' ? '出来事・日記' : '記録内容'}</span>
                    <textarea
                      rows={4}
                      value={historyEditDraft.content}
                      onChange={(event) =>
                        setHistoryEditDraft({
                          ...historyEditDraft,
                          content: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="history-edit-wide">
                    <span>箇条書きメモ</span>
                    <textarea
                      rows={4}
                      value={historyEditDraft.bulletPoints}
                      onFocus={handleEditBulletPointsFocus}
                      onKeyDown={handleEditBulletPointsKeyDown}
                      onChange={(event) =>
                        setHistoryEditDraft({
                          ...historyEditDraft,
                          bulletPoints: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="history-actions history-edit-wide">
                    <button
                      type="button"
                      disabled={isMutatingHistory}
                      onClick={() => void handleUpdateHistoryEntry()}
                    >
                      {isMutatingHistory ? '更新中...' : '更新する'}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isMutatingHistory}
                      onClick={() => setHistoryEditDraft(null)}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="history-item-header">
                    <div>
                      <time dateTime={entry.date}>{entry.date}</time>
                      <h3>{entry.title || '無題'}</h3>
                    </div>
                    <strong>{ENTRY_KIND_LABELS[entry.kind]}</strong>
                  </div>
                  {entry.content ? <p className="history-item-content">{entry.content}</p> : null}
                  {!entry.content ? (
                    <p className="history-item-content">
                      {ENTRY_KIND_LABELS[entry.kind]}本文はありません。
                    </p>
                  ) : null}
                  {isDetailOpen ? (
                    <div className="history-detail-panel" id={detailPanelId}>
                      <strong className="history-detail-heading">箇条書きメモ</strong>
                      {bulletPointItems.length > 0 ? (
                        <ul className="history-bullet-list">
                          {bulletPointItems.map((item, index) => (
                            <li key={`${entry.id}-${index}-${item}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="history-detail-empty">箇条書きメモはありません。</p>
                      )}
                    </div>
                  ) : null}
                  {entry.tags.length > 0 ? (
                    <div className="history-tags">
                      {entry.tags.map((tag) => (
                        <button
                          key={`${entry.id}-${tag}`}
                          type="button"
                          onClick={() => applyHistoryTagFilter(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="history-actions">
                    <button
                      aria-controls={detailPanelId}
                      aria-expanded={isDetailOpen}
                      className="secondary-button"
                      type="button"
                      disabled={isMutatingHistory}
                      onClick={() => toggleHistoryDetail(entry.id)}
                    >
                      {isDetailOpen ? '詳細を閉じる' : '詳細'}
                    </button>
                    <button
                      type="button"
                      disabled={isMutatingHistory}
                      onClick={() => startHistoryEdit(entry)}
                    >
                      編集
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={isMutatingHistory}
                      onClick={() => {
                        setPendingHistoryDeletion(entry)
                        setHistoryEditDraft(null)
                      }}
                    >
                      削除
                    </button>
                  </div>
                </>
              )}

              {isPendingDeletion ? (
                <div className="history-delete-confirmation">
                  <p>この{ENTRY_KIND_LABELS[pendingHistoryDeletion.kind]}を削除しますか？</p>
                  <div>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isMutatingHistory}
                      onClick={() => setPendingHistoryDeletion(null)}
                    >
                      キャンセル
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={isMutatingHistory}
                      onClick={() => void handleDeleteHistoryEntry()}
                    >
                      {isMutatingHistory ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
