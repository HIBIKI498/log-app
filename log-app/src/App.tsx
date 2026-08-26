import { useState } from 'react'
import { AiSettingsPage } from './features/ai'
import { DiaryPage } from './features/diary'
import { HistoryPage } from './features/history'
import { ReportsPage } from './features/reports'
import { TagsPage } from './features/tags'
import { TodoPage } from './features/todos'

type ActiveView = 'diary' | 'history' | 'reports' | 'todos' | 'tags' | 'ai-settings'

const NAVIGATION_ITEMS: Array<{ id: ActiveView; label: string }> = [
  { id: 'todos', label: 'ToDo' },
  { id: 'diary', label: '日記' },
  { id: 'history', label: '履歴' },
  { id: 'reports', label: 'レポート' },
  { id: 'tags', label: 'タグ' },
  { id: 'ai-settings', label: 'AI設定' },
]

// アプリ全体の枠と画面切り替えを担当し、機能処理はfeatures配下へ委譲する。
function App() {
  const [activeView, setActiveView] = useState<ActiveView>('todos')

  return (
    <main className="app-shell">
      <section className="app-container">
        <header className="app-header">
          <h1>log-app</h1>
          <p>日記、習慣、ToDoをまとめて管理します。</p>
        </header>

        <nav className="view-tabs" aria-label="画面切り替え">
          {NAVIGATION_ITEMS.map((item) => (
            <button
              className={activeView === item.id ? 'active' : ''}
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* ページをマウントしたまま切り替え、入力途中の状態を保持する。 */}
        <DiaryPage
          isActive={activeView === 'diary'}
          onOpenAiSettings={() => setActiveView('ai-settings')}
        />
        <HistoryPage isActive={activeView === 'history'} />
        <ReportsPage isActive={activeView === 'reports'} />
        <TodoPage isActive={activeView === 'todos'} />
        <TagsPage isActive={activeView === 'tags'} />
        <AiSettingsPage isActive={activeView === 'ai-settings'} />
      </section>
    </main>
  )
}

export default App
