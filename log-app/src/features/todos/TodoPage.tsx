import { useCallback, useEffect, useRef, useState } from 'react'
import { getTodayString } from '../../shared/date'
import { DeleteConfirmationModal } from '../../shared/DeleteConfirmationModal'
import type { FeaturePageProps } from '../../shared/types'

type TodoPriority = 'low' | 'normal' | 'high'
type TodoFilter = 'all' | 'active' | 'completed'
type TodoSortMode = 'date' | 'priority'

type TodoItem = {
  id: number
  title: string
  dueDate: string | null
  priority: TodoPriority
  isDone: boolean
  createdAt: string
}

const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  low: '低',
  normal: '通常',
  high: '高',
}

const TODO_PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 1,
  normal: 2,
  low: 3,
}

type TodoGroup = {
  key: string
  label: string
  todos: TodoItem[]
}

function formatTodoDueDate(dueDate: string) {
  const [, month, day] = dueDate.split('-').map((part) => Number(part))
  return `${month}月${day}日`
}

function compareTodoDueDates(left: TodoItem, right: TodoItem) {
  if (left.dueDate && right.dueDate) {
    return left.dueDate.localeCompare(right.dueDate)
  }
  if (left.dueDate) {
    return -1
  }
  if (right.dueDate) {
    return 1
  }
  return 0
}

function compareTodosByPriority(left: TodoItem, right: TodoItem) {
  const priorityDiff = TODO_PRIORITY_ORDER[left.priority] - TODO_PRIORITY_ORDER[right.priority]

  if (priorityDiff !== 0) {
    return priorityDiff
  }

  return compareTodoDueDates(left, right) || right.id - left.id
}

function compareTodosByDate(left: TodoItem, right: TodoItem) {
  return (
    compareTodoDueDates(left, right) ||
    Number(left.isDone) - Number(right.isDone) ||
    TODO_PRIORITY_ORDER[left.priority] - TODO_PRIORITY_ORDER[right.priority] ||
    right.id - left.id
  )
}

function groupTodosByDueDate(todoItems: TodoItem[]): TodoGroup[] {
  const groups = new Map<string, TodoItem[]>()

  for (const todo of todoItems) {
    const key = todo.dueDate ?? 'unlimited'
    groups.set(key, [...(groups.get(key) ?? []), todo])
  }

  return [...groups.entries()].map(([key, groupedTodos]) => ({
    key,
    label: key === 'unlimited' ? '無期限' : formatTodoDueDate(key),
    todos: groupedTodos,
  }))
}

// ToDoの追加、編集、完了切り替え、絞り込み、削除を担当するページ。
export function TodoPage({ isActive }: FeaturePageProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoDueDate, setNewTodoDueDate] = useState('')
  const [isNewTodoUnlimited, setIsNewTodoUnlimited] = useState(true)
  const [newTodoPriority, setNewTodoPriority] = useState<TodoPriority>('normal')
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('active')
  const [todoSortMode, setTodoSortMode] = useState<TodoSortMode>('date')
  const [todoMessage, setTodoMessage] = useState('')
  const [addTodoMessage, setAddTodoMessage] = useState('')
  const [isLoadingTodos, setIsLoadingTodos] = useState(false)
  const [isAddTodoModalOpen, setIsAddTodoModalOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [editTodoTitle, setEditTodoTitle] = useState('')
  const [editTodoDueDate, setEditTodoDueDate] = useState('')
  const [isEditTodoUnlimited, setIsEditTodoUnlimited] = useState(true)
  const [editTodoPriority, setEditTodoPriority] = useState<TodoPriority>('normal')
  const [editTodoMessage, setEditTodoMessage] = useState('')
  const [pendingTodoDeletion, setPendingTodoDeletion] = useState<TodoItem | null>(null)
  const newTodoTitleInputRef = useRef<HTMLInputElement>(null)
  const editTodoTitleInputRef = useRef<HTMLInputElement>(null)

  const activeTodoCount = todos.filter((todo) => !todo.isDone).length
  const completedTodoCount = todos.length - activeTodoCount
  const visibleTodos = todos.filter((todo) => {
    if (todoFilter === 'active') {
      return !todo.isDone
    }
    if (todoFilter === 'completed') {
      return todo.isDone
    }
    return true
  })
  const sortedVisibleTodos = [...visibleTodos].sort((left, right) => {
    if (todoSortMode === 'date') {
      return compareTodosByDate(left, right)
    }
    if (left.isDone !== right.isDone) {
      return left.isDone ? 1 : -1
    }

    return compareTodosByPriority(left, right)
  })
  const visibleTodoGroups = groupTodosByDueDate(sortedVisibleTodos)

  // タスクを未完了と期限の近い順で取得する。
  const loadTodos = useCallback(async () => {
    setIsLoadingTodos(true)
    setTodoMessage('')

    try {
      const todoItems = await window.logApp.listTodos()
      setTodos(todoItems)

      if (todoItems.length === 0) {
        setTodoMessage('タスクはまだありません。')
      }
    } catch (error) {
      console.error('ToDoの取得に失敗しました:', error)
      setTodoMessage('ToDoの取得に失敗しました。SQLite の接続状態を確認してください。')
    } finally {
      setIsLoadingTodos(false)
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      void loadTodos()
    }
  }, [isActive, loadTodos])

  useEffect(() => {
    if (!isAddTodoModalOpen) {
      return
    }

    requestAnimationFrame(() => {
      newTodoTitleInputRef.current?.focus()
    })
  }, [isAddTodoModalOpen])

  useEffect(() => {
    if (!isAddTodoModalOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoadingTodos) {
        setIsAddTodoModalOpen(false)
        setAddTodoMessage('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAddTodoModalOpen, isLoadingTodos])

  useEffect(() => {
    if (!editingTodo) {
      return
    }

    requestAnimationFrame(() => {
      editTodoTitleInputRef.current?.focus()
    })
  }, [editingTodo])

  useEffect(() => {
    if (!editingTodo) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoadingTodos) {
        setEditingTodo(null)
        setEditTodoMessage('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editingTodo, isLoadingTodos])

  const resetNewTodoForm = () => {
    setNewTodoTitle('')
    setNewTodoDueDate('')
    setIsNewTodoUnlimited(true)
    setNewTodoPriority('normal')
  }

  const closeAddTodoModal = () => {
    if (isLoadingTodos) {
      return
    }

    setIsAddTodoModalOpen(false)
    setAddTodoMessage('')
    resetNewTodoForm()
  }

  const openEditTodoModal = (todo: TodoItem) => {
    setEditingTodo(todo)
    setEditTodoTitle(todo.title)
    setEditTodoDueDate(todo.dueDate ?? '')
    setIsEditTodoUnlimited(!todo.dueDate)
    setEditTodoPriority(todo.priority)
    setEditTodoMessage('')
  }

  const closeEditTodoModal = () => {
    if (isLoadingTodos) {
      return
    }

    setEditingTodo(null)
    setEditTodoMessage('')
  }

  // 新しいタスクを保存し、入力欄と一覧を更新する。
  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) {
      setAddTodoMessage('タスク名を入力してください。')
      return
    }
    if (!isNewTodoUnlimited && !newTodoDueDate) {
      setAddTodoMessage('期限の日付を入力するか、無期限を選択してください。')
      return
    }

    setIsLoadingTodos(true)
    setAddTodoMessage('')

    try {
      await window.logApp.addTodo({
        title: newTodoTitle,
        dueDate: isNewTodoUnlimited ? '' : newTodoDueDate,
        priority: newTodoPriority,
      })
      resetNewTodoForm()
      setIsAddTodoModalOpen(false)
      await loadTodos()
      setTodoMessage('タスクを追加しました。')
    } catch (error) {
      console.error('ToDoの追加に失敗しました:', error)
      setAddTodoMessage('タスクの追加に失敗しました。')
    } finally {
      setIsLoadingTodos(false)
    }
  }

  // チェック状態をSQLiteへ保存し、タスクを並べ直す。
  const handleToggleTodo = async (todo: TodoItem) => {
    setIsLoadingTodos(true)
    setTodoMessage('')

    try {
      await window.logApp.updateTodoStatus(todo.id, !todo.isDone)
      await loadTodos()
    } catch (error) {
      console.error('ToDoの更新に失敗しました:', error)
      setTodoMessage('タスクの状態を更新できませんでした。')
    } finally {
      setIsLoadingTodos(false)
    }
  }

  // 編集したタスク名、期限、優先度をSQLiteへ保存する。
  const handleUpdateTodo = async () => {
    if (!editingTodo) {
      return
    }
    if (!editTodoTitle.trim()) {
      setEditTodoMessage('タスク名を入力してください。')
      return
    }
    if (!isEditTodoUnlimited && !editTodoDueDate) {
      setEditTodoMessage('期限の日付を入力するか、無期限を選択してください。')
      return
    }

    setIsLoadingTodos(true)
    setEditTodoMessage('')

    try {
      await window.logApp.updateTodo(editingTodo.id, {
        title: editTodoTitle,
        dueDate: isEditTodoUnlimited ? '' : editTodoDueDate,
        priority: editTodoPriority,
      })
      setEditingTodo(null)
      await loadTodos()
      setTodoMessage('タスクを更新しました。')
    } catch (error) {
      console.error('ToDoの編集に失敗しました:', error)
      setEditTodoMessage('タスクを更新できませんでした。')
    } finally {
      setIsLoadingTodos(false)
    }
  }

  // 削除確認後にタスクを削除する。
  const handleDeleteTodo = async () => {
    if (!pendingTodoDeletion) {
      return
    }

    setIsLoadingTodos(true)
    setTodoMessage('')

    try {
      await window.logApp.deleteTodo(pendingTodoDeletion.id)
      setPendingTodoDeletion(null)
      await loadTodos()
      setTodoMessage('タスクを削除しました。')
    } catch (error) {
      console.error('ToDoの削除に失敗しました:', error)
      setTodoMessage('タスクを削除できませんでした。')
    } finally {
      setIsLoadingTodos(false)
    }
  }

  const renderTodoItem = (todo: TodoItem) => {
    const isOverdue = !todo.isDone && Boolean(todo.dueDate) && todo.dueDate! < getTodayString()

    return (
      <article
        className={`todo-item priority-${todo.priority}${
          todo.isDone ? ' completed' : ''
        }${isOverdue ? ' overdue' : ''}`}
        key={todo.id}
      >
        <label className="todo-check">
          <input
            type="checkbox"
            checked={todo.isDone}
            disabled={isLoadingTodos}
            onChange={() => void handleToggleTodo(todo)}
          />
          <span>{todo.title}</span>
        </label>
        <div className="todo-meta">
          <span className={`todo-priority ${todo.priority}`}>
            優先度: {TODO_PRIORITY_LABELS[todo.priority]}
          </span>
          {todo.dueDate ? (
            <time
              className={`todo-due-date${isOverdue ? ' overdue' : ''}`}
              dateTime={todo.dueDate}
            >
              {isOverdue ? '期限切れ: ' : '期限: '}
              {formatTodoDueDate(todo.dueDate)}
            </time>
          ) : (
            <span className="todo-due-date">無期限</span>
          )}
        </div>
        <div className="todo-item-actions">
          <button
            className="todo-edit-button"
            type="button"
            disabled={isLoadingTodos}
            onClick={() => openEditTodoModal(todo)}
          >
            修正
          </button>
          <button
            className="todo-delete-button"
            type="button"
            disabled={isLoadingTodos}
            onClick={() => setPendingTodoDeletion(todo)}
          >
            削除
          </button>
        </div>
      </article>
    )
  }

  return (
    <section className="todo-section" hidden={!isActive}>
      <div className="section-heading">
        <div>
          <h2>ToDo</h2>
          <p className="section-description">やることと期限をまとめて管理します。</p>
        </div>
        <div className="section-heading-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={isLoadingTodos}
            onClick={() => void loadTodos()}
          >
            {isLoadingTodos ? '読み込み中...' : '更新'}
          </button>
          <button
            className="todo-add-button"
            type="button"
            disabled={isLoadingTodos}
            onClick={() => {
              setAddTodoMessage('')
              setIsAddTodoModalOpen(true)
            }}
          >
            追加
          </button>
        </div>
      </div>

      {isAddTodoModalOpen ? (
        <div
          className="todo-add-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddTodoModal()
            }
          }}
        >
          <section
            aria-labelledby="todo-add-modal-title"
            aria-modal="true"
            className="todo-add-modal"
            role="dialog"
          >
            <div className="todo-add-modal-header">
              <h3 id="todo-add-modal-title">ToDoを追加</h3>
              <button
                className="secondary-button"
                type="button"
                disabled={isLoadingTodos}
                onClick={closeAddTodoModal}
              >
                閉じる
              </button>
            </div>

            {/* タスク名、期限または無期限、優先度を入力してSQLiteへ保存する。 */}
            <form
              className="todo-add-modal-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleAddTodo()
              }}
            >
              <label className="todo-form-field todo-title-field">
                <span>タスク名</span>
                <input
                  ref={newTodoTitleInputRef}
                  type="text"
                  placeholder="例: 資料を提出する"
                  value={newTodoTitle}
                  onChange={(event) => setNewTodoTitle(event.target.value)}
                />
              </label>
              <div className="todo-due-field">
                <div className="todo-due-heading">
                  <span>期限</span>
                  <label className="todo-unlimited-option">
                    <input
                      type="checkbox"
                      checked={isNewTodoUnlimited}
                      onChange={(event) => {
                        const isUnlimited = event.target.checked
                        setIsNewTodoUnlimited(isUnlimited)

                        if (isUnlimited) {
                          setNewTodoDueDate('')
                        }
                      }}
                    />
                    <span>無期限</span>
                  </label>
                </div>
                <input
                  type="date"
                  aria-label="ToDoの期限"
                  disabled={isNewTodoUnlimited}
                  value={newTodoDueDate}
                  onChange={(event) => setNewTodoDueDate(event.target.value)}
                />
              </div>
              <label className="todo-form-field">
                <span>優先度</span>
                <select
                  className={`todo-priority-select priority-${newTodoPriority}`}
                  value={newTodoPriority}
                  onChange={(event) => setNewTodoPriority(event.target.value as TodoPriority)}
                >
                  <option value="low">低</option>
                  <option value="normal">通常</option>
                  <option value="high">高</option>
                </select>
              </label>

              {addTodoMessage ? <p className="todo-add-modal-message">{addTodoMessage}</p> : null}

              <div className="todo-add-modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isLoadingTodos}
                  onClick={closeAddTodoModal}
                >
                  キャンセル
                </button>
                <button className="todo-add-button" type="submit" disabled={isLoadingTodos}>
                  {isLoadingTodos ? '追加中...' : '追加する'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editingTodo ? (
        <div
          className="todo-add-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditTodoModal()
            }
          }}
        >
          <section
            aria-labelledby="todo-edit-modal-title"
            aria-modal="true"
            className="todo-add-modal"
            role="dialog"
          >
            <div className="todo-add-modal-header">
              <h3 id="todo-edit-modal-title">ToDoを修正</h3>
              <button
                className="secondary-button"
                type="button"
                disabled={isLoadingTodos}
                onClick={closeEditTodoModal}
              >
                閉じる
              </button>
            </div>

            <form
              className="todo-add-modal-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleUpdateTodo()
              }}
            >
              <label className="todo-form-field todo-title-field">
                <span>タスク名</span>
                <input
                  ref={editTodoTitleInputRef}
                  type="text"
                  value={editTodoTitle}
                  onChange={(event) => setEditTodoTitle(event.target.value)}
                />
              </label>
              <div className="todo-due-field">
                <div className="todo-due-heading">
                  <span>期限</span>
                  <label className="todo-unlimited-option">
                    <input
                      type="checkbox"
                      checked={isEditTodoUnlimited}
                      onChange={(event) => {
                        const isUnlimited = event.target.checked
                        setIsEditTodoUnlimited(isUnlimited)

                        if (isUnlimited) {
                          setEditTodoDueDate('')
                        }
                      }}
                    />
                    <span>無期限</span>
                  </label>
                </div>
                <input
                  aria-label="修正するToDoの期限"
                  type="date"
                  disabled={isEditTodoUnlimited}
                  value={editTodoDueDate}
                  onChange={(event) => setEditTodoDueDate(event.target.value)}
                />
              </div>
              <label className="todo-form-field">
                <span>優先度</span>
                <select
                  className={`todo-priority-select priority-${editTodoPriority}`}
                  value={editTodoPriority}
                  onChange={(event) => setEditTodoPriority(event.target.value as TodoPriority)}
                >
                  <option value="low">低</option>
                  <option value="normal">通常</option>
                  <option value="high">高</option>
                </select>
              </label>

              {editTodoMessage ? <p className="todo-add-modal-message">{editTodoMessage}</p> : null}

              <div className="todo-add-modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isLoadingTodos}
                  onClick={closeEditTodoModal}
                >
                  キャンセル
                </button>
                <button className="todo-add-button" type="submit" disabled={isLoadingTodos}>
                  {isLoadingTodos ? '更新中...' : '更新する'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <div className="todo-overview" aria-label="タスク件数">
        <span>
          すべて <strong>{todos.length}</strong>
        </span>
        <span>
          未完了 <strong>{activeTodoCount}</strong>
        </span>
        <span>
          完了 <strong>{completedTodoCount}</strong>
        </span>
      </div>

      <div className="todo-toolbar">
        <div className="todo-toolbar-controls">
          <div className="todo-filter" aria-label="ToDo表示切り替え">
            {(
              [
                ['active', '未完了'],
                ['completed', '完了'],
                ['all', 'すべて'],
              ] as Array<[TodoFilter, string]>
            ).map(([filter, label]) => (
              <button
                aria-pressed={todoFilter === filter}
                className={todoFilter === filter ? 'active' : ''}
                key={filter}
                type="button"
                onClick={() => setTodoFilter(filter)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="todo-sort" aria-label="ToDo並び替え">
            {(
              [
                ['date', '日付順'],
                ['priority', '重要度順'],
              ] as Array<[TodoSortMode, string]>
            ).map(([sortMode, label]) => (
              <button
                aria-pressed={todoSortMode === sortMode}
                className={todoSortMode === sortMode ? 'active' : ''}
                key={sortMode}
                type="button"
                onClick={() => setTodoSortMode(sortMode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="todo-visible-count">{sortedVisibleTodos.length}件表示</span>
      </div>

      {todoMessage ? <p className="todo-message">{todoMessage}</p> : null}

      {pendingTodoDeletion ? (
        <DeleteConfirmationModal
          confirmLabel="削除する"
          description={`ToDo「${pendingTodoDeletion.title}」を削除します。この操作は元に戻せません。`}
          isDeleting={isLoadingTodos}
          title="ToDoを削除しますか？"
          onCancel={() => setPendingTodoDeletion(null)}
          onConfirm={() => void handleDeleteTodo()}
        />
      ) : null}

      {/* 完了状態、期限切れ、優先度をタスクごとの表示へ反映する。 */}
      <div className="todo-list">
        {sortedVisibleTodos.length > 0 ? (
          todoSortMode === 'date' ? (
            visibleTodoGroups.map((group) => (
              <section className="todo-date-group" key={group.key}>
                <div className="todo-date-heading">
                  <h3>{group.label}</h3>
                </div>
                <div className="todo-date-items">{group.todos.map(renderTodoItem)}</div>
              </section>
            ))
          ) : (
            sortedVisibleTodos.map(renderTodoItem)
          )
        ) : (
          <p className="todo-empty-message">
            {todos.length === 0
              ? '新しいタスクを追加してください。'
              : 'この条件に一致するタスクはありません。'}
          </p>
        )}
      </div>
    </section>
  )
}
