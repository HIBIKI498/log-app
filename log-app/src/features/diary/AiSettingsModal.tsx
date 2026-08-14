import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DeleteConfirmationModal } from '../../shared/DeleteConfirmationModal'

type AiSettingsModalProps = {
  onClose: () => void
  onSettingsChanged: (settings: AiSettingsSummary) => void
}

export function AiSettingsModal({ onClose, onSettingsChanged }: AiSettingsModalProps) {
  const [settings, setSettings] = useState<AiSettingsSummary | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [message, setMessage] = useState('')
  const [isWorking, setIsWorking] = useState(true)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const isWorkingRef = useRef(isWorking)
  const isDeleteConfirmationOpenRef = useRef(isDeleteConfirmationOpen)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    isWorkingRef.current = isWorking
  }, [isWorking])

  useEffect(() => {
    isDeleteConfirmationOpenRef.current = isDeleteConfirmationOpen
  }, [isDeleteConfirmationOpen])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    let isMounted = true

    window.logApp.getAiSettings()
      .then((loadedSettings) => {
        if (!isMounted) {
          return
        }

        setSettings(loadedSettings)
        setModel(loadedSettings.model)
      })
      .catch((error) => {
        console.error('AI設定の取得に失敗しました:', error)
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : 'AI設定を取得できませんでした。')
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
  }, [])

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => apiKeyInputRef.current?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDeleteConfirmationOpenRef.current) {
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
          'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
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

  const handleTestConnection = async () => {
    if (!model) {
      setMessage('使用するOpenAIモデルを選択してください。')
      return
    }
    if (!apiKey.trim() && !settings?.configured) {
      setMessage('OpenAI APIキーを入力してください。')
      return
    }

    setIsWorking(true)
    setMessage('')

    try {
      await window.logApp.testOpenAiConnection({ apiKey, model })
      setMessage('OpenAI APIへの接続を確認できました。')
    } catch (error) {
      console.error('OpenAI APIへの接続確認に失敗しました:', error)
      setMessage(error instanceof Error ? error.message : 'OpenAI APIへ接続できませんでした。')
    } finally {
      setIsWorking(false)
    }
  }

  const handleSave = async () => {
    if (!model) {
      setMessage('使用するOpenAIモデルを選択してください。')
      return
    }
    if (!apiKey.trim() && !settings?.configured) {
      setMessage('OpenAI APIキーを入力してください。')
      return
    }

    setIsWorking(true)
    setMessage('')

    try {
      const savedSettings = await window.logApp.saveAiSettings({ apiKey, model })
      setSettings(savedSettings)
      setApiKey('')
      onSettingsChanged(savedSettings)
      setMessage('AI設定を保存しました。')
    } catch (error) {
      console.error('AI設定の保存に失敗しました:', error)
      setMessage(error instanceof Error ? error.message : 'AI設定を保存できませんでした。')
    } finally {
      setIsWorking(false)
    }
  }

  const handleDelete = async () => {
    setIsWorking(true)
    setMessage('')

    try {
      const nextSettings = await window.logApp.deleteAiSettings()
      setSettings(nextSettings)
      setModel(nextSettings.model)
      setApiKey('')
      setIsDeleteConfirmationOpen(false)
      onSettingsChanged(nextSettings)
      setMessage('保存済みのOpenAI APIキーを削除しました。')
    } catch (error) {
      console.error('OpenAI APIキーの削除に失敗しました:', error)
      setMessage(error instanceof Error ? error.message : 'APIキーを削除できませんでした。')
    } finally {
      setIsWorking(false)
    }
  }

  const modal = (
    <div
      className="settings-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isWorking && !isDeleteConfirmationOpen) {
          onClose()
        }
      }}
    >
      <section
        aria-busy={isWorking}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="settings-modal ai-settings-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="settings-modal-header">
          <h3 id={titleId}>OpenAI設定</h3>
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

        <p className="ai-settings-description" id={descriptionId}>
          APIキーはこの端末内で暗号化して保存します。AI実行時は、日記画面の入力内容をOpenAI APIへ送信します。
        </p>

        {message ? <p className="settings-modal-message" role="status">{message}</p> : null}

        <form
          className="ai-settings-form"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void handleSave()
          }}
        >
          <label className="settings-field">
            <span>OpenAI APIキー</span>
            <input
              autoComplete="off"
              placeholder={settings?.configured ? '変更する場合のみ入力' : 'sk-...'}
              ref={apiKeyInputRef}
              spellCheck={false}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>

          <label className="settings-field">
            <span>使用モデル</span>
            <select
              disabled={!settings}
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {(settings?.modelOptions ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <p className={`ai-settings-status ${settings?.configured ? 'configured' : ''}`}>
            APIキー: {settings?.configured ? '設定済み' : '未設定'}
          </p>

          <div className="ai-settings-actions">
            {settings?.configured ? (
              <button
                className="danger-button"
                type="button"
                disabled={isWorking}
                onClick={() => setIsDeleteConfirmationOpen(true)}
              >
                APIキーを削除
              </button>
            ) : null}
            <span className="ai-settings-actions-spacer" />
            <button
              className="secondary-button"
              type="button"
              disabled={isWorking}
              onClick={() => void handleTestConnection()}
            >
              {isWorking ? '確認中...' : '接続テスト'}
            </button>
            <button className="ai-modal-primary" type="submit" disabled={isWorking}>
              {isWorking ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>

        {isDeleteConfirmationOpen ? (
          <DeleteConfirmationModal
            confirmLabel="APIキーを削除"
            description="この端末に保存されているOpenAI APIキーを削除します。再びAI機能を使うには、APIキーの再設定が必要です。"
            isDeleting={isWorking}
            title="OpenAI APIキーを削除しますか？"
            onCancel={() => setIsDeleteConfirmationOpen(false)}
            onConfirm={() => void handleDelete()}
          />
        ) : null}
      </section>
    </div>
  )

  return createPortal(modal, document.body)
}
