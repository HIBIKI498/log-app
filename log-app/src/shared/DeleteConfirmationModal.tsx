import { useEffect, useId, useRef } from 'react'

type DeleteConfirmationModalProps = {
  title: string
  description: string
  confirmLabel: string
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

// 削除や解除などの破壊的な操作を実行する前に、内容を確認するためのモーダル。
export function DeleteConfirmationModal({
  title,
  description,
  confirmLabel,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteConfirmationModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const isDeletingRef = useRef(isDeleting)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    isDeletingRef.current = isDeleting
  }, [isDeleting])

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const focusFirstButton = () => {
      const firstButton = dialogRef.current?.querySelector<HTMLButtonElement>(
        'button:not(:disabled)',
      )
      firstButton?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeletingRef.current) {
        onCancel()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const buttons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      )

      if (buttons.length === 0) {
        return
      }

      const firstButton = buttons[0]
      const lastButton = buttons[buttons.length - 1]

      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault()
        lastButton.focus()
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault()
        firstButton.focus()
      }
    }

    focusFirstButton()
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElementRef.current?.focus()
    }
  }, [onCancel])

  return (
    <div
      className="confirmation-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onCancel()
        }
      }}
    >
      <section
        aria-busy={isDeleting}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirmation-modal"
        ref={dialogRef}
        role="alertdialog"
      >
        <h3 id={titleId}>{title}</h3>
        <p id={descriptionId}>{description}</p>
        <div className="confirmation-modal-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? '削除中...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
