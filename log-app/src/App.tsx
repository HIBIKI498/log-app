import { useState } from 'react'
import { AiSettingsPage } from './features/ai'
import { DiaryPage } from './features/diary'
import { HistoryPage } from './features/history'
import { ReportsPage } from './features/reports'
import { TagsPage } from './features/tags'
import { TodoPage } from './features/todos'
import type { DiaryDateRequest } from './shared/types'

type ActiveView = 'diary' | 'history' | 'reports' | 'todos' | 'tags' | 'ai-settings'

const NAVIGATION_ITEMS: Array<{ id: ActiveView; label: string }> = [
  { id: 'todos', label: 'ToDo' },
  { id: 'diary', label: '日記' },
  { id: 'history', label: '履歴' },
  { id: 'reports', label: 'レポート' },
  { id: 'tags', label: 'タグ' },
  { id: 'ai-settings', label: 'AI設定' },
]

function NavigationIcon({ view }: { view: ActiveView }) {
  switch (view) {
    case 'todos':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
          <path d="m8 12 2.4 2.4L16.5 8.5" />
        </svg>
      )
    case 'diary':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M6 3.5h11.5A2.5 2.5 0 0 1 20 6v14.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5Z" />
          <path d="M7.5 8.5h8M7.5 12h6" />
        </svg>
      )
    case 'history':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4.3 8.5A8.5 8.5 0 1 1 3.5 14" />
          <path d="M4.3 4v4.5H8.8M12 7.5V12l3 2" />
        </svg>
      )
    case 'reports':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 20V10.5h4V20M10 20V4h4v16M16 20v-7h4v7M3 20.5h18" />
        </svg>
      )
    case 'tags':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 4.5h7.2L20 13.3 13.3 20 4.5 11.2Z" />
          <circle cx="8.2" cy="8.3" r="1.2" />
        </svg>
      )
    case 'ai-settings':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3.5c.5 4.4 2.1 6 6.5 6.5-4.4.5-6 2.1-6.5 6.5-.5-4.4-2.1-6-6.5-6.5 4.4-.5 6-2.1 6.5-6.5Z" />
          <path d="M19 15.5c.2 1.7.8 2.3 2.5 2.5-1.7.2-2.3.8-2.5 2.5-.2-1.7-.8-2.3-2.5-2.5 1.7-.2 2.3-.8 2.5-2.5Z" />
        </svg>
      )
  }
}

// アプリ全体の枠と画面切り替えを担当し、機能処理はfeatures配下へ委譲する。
function App() {
  const [activeView, setActiveView] = useState<ActiveView>('todos')
  const [diaryDateRequest, setDiaryDateRequest] = useState<DiaryDateRequest | null>(null)

  const openDiaryForDate = (date: string) => {
    setDiaryDateRequest((currentRequest) => ({
      date,
      requestId: (currentRequest?.requestId ?? 0) + 1,
    }))
    setActiveView('diary')
  }

  return (
    <main className="app-shell">
      <section className="app-container">
        <header className="app-header">
          <div className="app-brand">
            <span className="app-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path d="M8 7v18h17" />
                <path d="m11 20 4-5 4 3 6-8" />
              </svg>
            </span>
            <div className="app-header-copy">
              <h1>log-app</h1>
              <p>日記、習慣、ToDoをまとめて管理します。</p>
            </div>
          </div>
          <span className="app-storage-status">
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="M4.75 7V5.25a3.25 3.25 0 0 1 6.5 0V7" />
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
            </svg>
            この端末に保存
          </span>
        </header>

        <nav className="view-tabs" aria-label="画面切り替え">
          {NAVIGATION_ITEMS.map((item) => (
            <button
              aria-current={activeView === item.id ? 'page' : undefined}
              className={activeView === item.id ? 'active' : ''}
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              <NavigationIcon view={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ページをマウントしたまま切り替え、入力途中の状態を保持する。 */}
        <DiaryPage
          isActive={activeView === 'diary'}
          onOpenAiSettings={() => setActiveView('ai-settings')}
          requestedDate={diaryDateRequest}
        />
        <HistoryPage
          isActive={activeView === 'history'}
          onCreateDiary={openDiaryForDate}
        />
        <ReportsPage isActive={activeView === 'reports'} />
        <TodoPage isActive={activeView === 'todos'} />
        <TagsPage isActive={activeView === 'tags'} />
        <AiSettingsPage isActive={activeView === 'ai-settings'} />
      </section>
    </main>
  )
}

export default App
