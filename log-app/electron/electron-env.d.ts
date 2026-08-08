/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string
    VITE_PUBLIC: string
    SQLITE_DB_PATH?: string
  }
}

type WellbeingScore = 1 | 2 | 3 | 4 | 5

type SaveEntryInput = {
  date: string
  title: string
  tags: string[]
  content: string
  bulletPoints: string
  breakfast: string
  lunch: string
  dinner: string
  moodScore: WellbeingScore | null
  conditionScore: WellbeingScore | null
  habits: Array<{
    id: number
    isDone: boolean
  }>
}

type SaveEntryResult = {
  id: number
  tagCount: number
  habitLogCount: number
}

type EntryHistoryItem = {
  id: number
  date: string
  title: string
  content: string
  bulletPoints: string
  breakfast: string
  lunch: string
  dinner: string
  moodScore: WellbeingScore | null
  conditionScore: WellbeingScore | null
  tags: string[]
}

type EntrySearchFilters = {
  keyword?: string
  tag?: string
  startDate?: string
  endDate?: string
  resultLimit?: number | null
}

type UpdateEntryInput = {
  id: number
  date: string
  title: string
  tags: string[]
  content: string
  bulletPoints: string
  breakfast: string
  lunch: string
  dinner: string
  moodScore: WellbeingScore | null
  conditionScore: WellbeingScore | null
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
  fixedTags: Array<SettingsItem & { isFixed: boolean }>
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

interface Window {
  logApp: {
    addTodo(todo: TodoInput): Promise<{ id: number }>
    addFixedTag(name: string): Promise<{ id: number }>
    addHabit(name: string, weekdays: number[]): Promise<{ id: number }>
    deleteFixedTag(id: number): Promise<{ id: number }>
    deleteHabit(id: number): Promise<{ id: number }>
    deleteTodo(id: number): Promise<{ id: number }>
    deleteEntry(id: number): Promise<{ id: number }>
    listEntries(filters?: EntrySearchFilters): Promise<EntryHistoryItem[]>
    listEntryTags(): Promise<string[]>
    listHabitAchievementReports(): Promise<HabitAchievementReportItem[]>
    listSettings(): Promise<SettingsData>
    listTodos(): Promise<TodoItem[]>
    saveEntry(entry: SaveEntryInput): Promise<SaveEntryResult>
    updateFixedTag(id: number, name: string): Promise<{ id: number }>
    updateHabit(id: number, name: string, weekdays: number[]): Promise<{ id: number }>
    updateTodoStatus(id: number, isDone: boolean): Promise<{ id: number }>
    updateTodo(id: number, todo: TodoInput): Promise<{ id: number }>
    updateEntry(entry: UpdateEntryInput): Promise<{ id: number; tagCount: number }>
  }
}
