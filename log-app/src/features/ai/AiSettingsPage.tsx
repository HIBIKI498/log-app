import { useCallback, useEffect, useState } from 'react'
import { DeleteConfirmationModal } from '../../shared/DeleteConfirmationModal'
import type { FeaturePageProps } from '../../shared/types'

type WorkingAction = 'loading' | 'testing' | 'saving' | 'deleting' | null

export function AiSettingsPage({ isActive }: FeaturePageProps) {
  const [settings, setSettings] = useState<AiSettingsSummary | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [message, setMessage] = useState('')
  const [workingAction, setWorkingAction] = useState<WorkingAction>(null)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const isWorking = workingAction !== null

  const loadSettings = useCallback(async () => {
    setWorkingAction('loading')
    setMessage('')

    try {
      const loadedSettings = await window.logApp.getAiSettings()
      setSettings(loadedSettings)
      setModel(loadedSettings.model)
    } catch (error) {
      console.error('AI設定の取得に失敗しました:', error)
      setMessage(error instanceof Error ? error.message : 'AI設定を取得できませんでした。')
    } finally {
      setWorkingAction(null)
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      void loadSettings()
    } else {
      setIsDeleteConfirmationOpen(false)
    }
  }, [isActive, loadSettings])

  const validateInput = () => {
    if (!model) {
      setMessage('使用するOpenAIモデルを選択してください。')
      return false
    }

    if (!apiKey.trim() && !settings?.configured) {
      setMessage('OpenAI APIキーを入力してください。')
      return false
    }

    return true
  }

  const handleTestConnection = async () => {
    if (!validateInput()) {
      return
    }

    setWorkingAction('testing')
    setMessage('')

    try {
      await window.logApp.testOpenAiConnection({ apiKey, model })
      setMessage('OpenAI APIへの接続を確認できました。')
    } catch (error) {
      console.error('OpenAI APIへの接続確認に失敗しました:', error)
      setMessage(error instanceof Error ? error.message : 'OpenAI APIへ接続できませんでした。')
    } finally {
      setWorkingAction(null)
    }
  }

  const handleSave = async () => {
    if (!validateInput()) {
      return
    }

    setWorkingAction('saving')
    setMessage('')

    try {
      const savedSettings = await window.logApp.saveAiSettings({ apiKey, model })
      setSettings(savedSettings)
      setApiKey('')
      setMessage('AI設定を保存しました。日記ページでAIアシストを利用できます。')
    } catch (error) {
      console.error('AI設定の保存に失敗しました:', error)
      setMessage(error instanceof Error ? error.message : 'AI設定を保存できませんでした。')
    } finally {
      setWorkingAction(null)
    }
  }

  const handleDelete = async () => {
    setWorkingAction('deleting')
    setMessage('')

    try {
      const nextSettings = await window.logApp.deleteAiSettings()
      setSettings(nextSettings)
      setModel(nextSettings.model)
      setApiKey('')
      setIsDeleteConfirmationOpen(false)
      setMessage('保存済みのOpenAI APIキーを削除しました。')
    } catch (error) {
      console.error('OpenAI APIキーの削除に失敗しました:', error)
      setMessage(error instanceof Error ? error.message : 'APIキーを削除できませんでした。')
    } finally {
      setWorkingAction(null)
    }
  }

  return (
    <section className="ai-settings-page" hidden={!isActive}>
      <div className="section-heading">
        <div>
          <h2>AI設定</h2>
          <p className="section-description">
            日記の作成・文章修正に使用するOpenAI APIを設定します。
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={isWorking}
          onClick={() => void loadSettings()}
        >
          {workingAction === 'loading' ? '読み込み中...' : '更新'}
        </button>
      </div>

      {message ? <p className="ai-settings-message" role="status">{message}</p> : null}

      <div className="ai-settings-layout">
        <section className="ai-settings-card" aria-busy={isWorking}>
          <div className="ai-settings-card-heading">
            <div>
              <h3>OpenAI API</h3>
              <p>APIキーと、日記の生成に使用するモデルを登録します。</p>
            </div>
            <span className={`ai-settings-badge ${settings?.configured ? 'configured' : ''}`}>
              {!settings ? '確認中' : settings.configured ? '設定済み' : '未設定'}
            </span>
          </div>

          <form
            className="ai-settings-page-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSave()
            }}
          >
            <label className="settings-field">
              <span>OpenAI APIキー</span>
              <input
                autoComplete="off"
                disabled={isWorking || !settings}
                placeholder={settings?.configured ? '変更する場合のみ入力' : 'sk-...'}
                spellCheck={false}
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <p className="ai-settings-help">
              保存済みのキーは画面へ再表示しません。空欄のまま保存すると、現在のキーを維持します。
            </p>

            <label className="settings-field">
              <span>使用モデル</span>
              <select
                disabled={isWorking || !settings}
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

            <div className="ai-settings-page-actions">
              {settings?.configured ? (
                <button
                  className="ai-settings-delete-button"
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
                disabled={isWorking || !settings}
                onClick={() => void handleTestConnection()}
              >
                {workingAction === 'testing' ? '確認中...' : '接続テスト'}
              </button>
              <button
                className="ai-settings-save-button"
                type="submit"
                disabled={isWorking || !settings}
              >
                {workingAction === 'saving' ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        </section>

        <aside className="ai-settings-info-card">
          <h3>データの取り扱い</h3>
          <ul>
            <li>APIキーはこの端末内で暗号化して保存します。</li>
            <li>AIアシスト実行時だけ、日記画面の入力内容をOpenAI APIへ送信します。</li>
            <li>AIの提案は確認してから反映し、日記へ自動保存しません。</li>
          </ul>
        </aside>
      </div>

      {isActive && isDeleteConfirmationOpen ? (
        <DeleteConfirmationModal
          confirmLabel="APIキーを削除"
          description="この端末に保存されているOpenAI APIキーを削除します。再びAI機能を使うには、APIキーの再設定が必要です。"
          isDeleting={workingAction === 'deleting'}
          title="OpenAI APIキーを削除しますか？"
          onCancel={() => setIsDeleteConfirmationOpen(false)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </section>
  )
}
