import { ipcRenderer, contextBridge } from 'electron'

type EntryKind = 'diary' | 'record'

type SaveEntryInput = {
  kind: EntryKind
  date: string
  title: string
  tags: string[]
  content: string
  bulletPoints: string
  habits: Array<{
    id: number
    isDone: boolean
  }>
}

type EntryHistoryItem = {
  id: number
  kind: EntryKind
  date: string
  title: string
  content: string
  bulletPoints: string
  tags: string[]
}

type EntrySearchFilters = {
  kind?: EntryKind
  keyword?: string
  tag?: string
  startDate?: string
  endDate?: string
}

type UpdateEntryInput = {
  id: number
  date: string
  title: string
  tags: string[]
  content: string
  bulletPoints: string
}

type HabitAchievementReportItem = {
  id: number
  name: string
  doneCount: number
  totalCount: number
  achievementRate: number
}

type SettingsItem = {
  id: number
  name: string
}

type HabitSettingItem = SettingsItem & {
  weekdays: number[]
}

type SettingsData = {
  fixedTags: Array<SettingsItem & { isFixed: boolean; entryKinds: EntryKind[] }>
  habits: HabitSettingItem[]
}

type TodoPriority = 'low' | 'normal' | 'high'

type TodoInput = {
  title: string
  dueDate: string
  priority: TodoPriority
}

type TodoItem = Omit<TodoInput, 'dueDate'> & {
  id: number
  dueDate: string | null
  isDone: boolean
  createdAt: string
}

contextBridge.exposeInMainWorld('logApp', {
  addTodo(todo: TodoInput) {
    return ipcRenderer.invoke('todos:add', todo) as Promise<{ id: number }>
  },
  addFixedTag(name: string, entryKinds: EntryKind[]) {
    return ipcRenderer.invoke('settings:add-fixed-tag', name, entryKinds) as Promise<{ id: number }>
  },
  addHabit(name: string, weekdays: number[]) {
    return ipcRenderer.invoke('settings:add-habit', name, weekdays) as Promise<{ id: number }>
  },
  deleteFixedTag(id: number) {
    return ipcRenderer.invoke('settings:delete-fixed-tag', id) as Promise<{ id: number }>
  },
  deleteHabit(id: number) {
    return ipcRenderer.invoke('settings:delete-habit', id) as Promise<{ id: number }>
  },
  deleteTodo(id: number) {
    return ipcRenderer.invoke('todos:delete', id) as Promise<{ id: number }>
  },
  deleteEntry(id: number) {
    return ipcRenderer.invoke('entries:delete', id) as Promise<{ id: number }>
  },
  listEntries(filters: EntrySearchFilters = {}) {
    return ipcRenderer.invoke('entries:list', filters) as Promise<EntryHistoryItem[]>
  },
  listEntryTags(kind: EntryKind) {
    return ipcRenderer.invoke('entries:list-tags', kind) as Promise<string[]>
  },
  listHabitAchievementReports() {
    return ipcRenderer.invoke(
      'reports:habit-achievements',
    ) as Promise<HabitAchievementReportItem[]>
  },
  listSettings() {
    return ipcRenderer.invoke('settings:list') as Promise<SettingsData>
  },
  listTodos() {
    return ipcRenderer.invoke('todos:list') as Promise<TodoItem[]>
  },
  saveEntry(entry: SaveEntryInput) {
    return ipcRenderer.invoke('entries:save', entry)
  },
  updateFixedTag(id: number, name: string, entryKinds: EntryKind[]) {
    return ipcRenderer.invoke('settings:update-fixed-tag', id, name, entryKinds) as Promise<{ id: number }>
  },
  updateHabit(id: number, name: string, weekdays: number[]) {
    return ipcRenderer.invoke('settings:update-habit', id, name, weekdays) as Promise<{
      id: number
    }>
  },
  updateTodoStatus(id: number, isDone: boolean) {
    return ipcRenderer.invoke('todos:update-status', id, isDone) as Promise<{ id: number }>
  },
  updateTodo(id: number, todo: TodoInput) {
    return ipcRenderer.invoke('todos:update', id, todo) as Promise<{ id: number }>
  },
  updateEntry(entry: UpdateEntryInput) {
    return ipcRenderer.invoke('entries:update', entry) as Promise<{
      id: number
      tagCount: number
    }>
  },
})
