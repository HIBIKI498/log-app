import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

type AiDraftPreviewModalProps = {
  currentTitle: string
  currentContent: string
  draft: AiDiaryDraft
  mode: 'generate' | 'rewrite'
  onApply: () => void
  onClose: () => void
}

export function AiDraftPreviewModal({
  currentTitle,
  currentContent,
  draft,
  mode,
  onApply,
  onClose,
}: AiDraftPreviewModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, input, textarea',
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
  }, [])

  const modal = (
    <div
      className="settings-modal-backdrop ai-preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="settings-modal ai-preview-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="settings-modal-header">
          <h3 id={titleId}>{mode === 'generate' ? 'AIが作成した日記' : 'AIが整えた文章'}</h3>
          <button
            aria-label="閉じる"
            className="settings-modal-close"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="ai-preview-description">
          内容を確認してください。「本文に反映」を押すまで、入力中の日記は変更されません。
        </p>

        <div className="ai-preview-grid">
          <section className="ai-preview-card">
            <h4>現在の内容</h4>
            <label className="ai-preview-field">
              <span>タイトル</span>
              <input readOnly value={currentTitle} />
            </label>
            <label className="ai-preview-field">
              <span>本文</span>
              <textarea readOnly rows={12} value={currentContent} />
            </label>
          </section>

          <section className="ai-preview-card generated">
            <h4>AIの提案</h4>
            <label className="ai-preview-field">
              <span>タイトル</span>
              <input readOnly value={draft.title} />
            </label>
            <label className="ai-preview-field">
              <span>本文</span>
              <textarea readOnly rows={12} value={draft.content} />
            </label>
          </section>
        </div>

        <div className="ai-preview-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            破棄する
          </button>
          <button className="ai-modal-primary" type="button" onClick={onApply}>
            本文に反映
          </button>
        </div>
      </section>
    </div>
  )

  return createPortal(modal, document.body)
}
