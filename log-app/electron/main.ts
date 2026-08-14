import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { backup, DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'
import { autoUpdater } from 'electron-updater'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import path from 'node:path'

import {
  deleteAiSettings,
  getAiSettingsSummary,
  saveAiSettings,
  type AiSettingsInput,
} from './ai/aiSettings'
import {
  generateDiaryDraft,
  testOpenAiConnection,
  type AiDiaryInput,
} from './ai/openAiDiary'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// ローカルの .env を読み込み、SQLite の保存先設定を process.env に反映する。
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.warn(`.env file was not found: ${filePath}`)
    return
  }

  const envText = fs.readFileSync(filePath, 'utf8')

  for (const line of envText.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf('=')

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim()

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(path.join(process.env.APP_ROOT, '.env'))

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
let updateCheckStarted = false
const isDatabaseSmokeTest = process.argv.includes('--database-smoke-test')

app.setName('log-app')

// GitHub Releases の更新をバックグラウンドで取得し、利用者の確認後に静かに適用する。
function setupAutoUpdater() {
  // ポータブル版はインストール先を持たないため、自動更新ではなく実行ファイルを手動で差し替える。
  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE)

  if (!app.isPackaged || isPortable || updateCheckStarted || !win) {
    return
  }

  const updateWindow = win
  updateCheckStarted = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const result = await dialog.showMessageBox(updateWindow, {
      type: 'info',
      title: '更新の準備ができました',
      message: `log-app ${info.version} への更新準備ができました。`,
      detail: '再起動すると、インストーラー画面を表示せずに更新を適用します。「あとで」を選んだ場合は、アプリ終了時に自動で更新します。',
      buttons: ['再起動して更新', 'あとで'],
      defaultId: 0,
      cancelId: 1,
    })

    if (result.response === 0) {
      // サイレント更新を行い、完了後に新しいバージョンを起動する。
      autoUpdater.quitAndInstall(true, true)
    }
  })

  autoUpdater.on('error', (error) => {
    console.error('Auto update failed.', error)
  })

  void autoUpdater.checkForUpdates().catch((error) => {
    console.error('Update check failed.', error)
  })
}

type WellbeingScore = 1 | 2 | 3 | 4 | 5

type EntryInput = {
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

type EntryUpdateInput = {
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

type IdRow = {
  id: number
}

type EntryHistoryRow = {
  id: number
  date: string
  title: string
  content: string
  bulletPoints: string
  breakfast: string
  lunch: string
  dinner: string
  moodScore: number | null
  conditionScore: number | null
  tags: string | null
}

type EntrySearchFilters = {
  keyword?: string
  tag?: string
  startDate?: string
  endDate?: string
  resultLimit?: number | null
}

type HabitAchievementReportRow = {
  id: number
  name: string
  doneCount: number | string
  totalCount: number | string
}

type SettingsTagRow = {
  id: number
  name: string
  isFixed: number
}

type TagNameRow = {
  name: string
}

type SettingsHabitRow = {
  id: number
  name: string
  weekdays: string | null
}

type TodoPriority = 'low' | 'normal' | 'high'

type TodoInput = {
  title: string
  dueDate: string
  priority: TodoPriority
}

type TodoRow = {
  id: number
  title: string
  dueDate: string | null
  priority: TodoPriority
  isDone: number
  createdAt: string
}

// DB 接続設定は .env から読み込み、メインプロセス側だけで使用する。
type SqliteResult = {
  insertId: number
  changes: number
}

class SqliteConnection {
  private readonly database: DatabaseSync

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath)
    this.database.exec('PRAGMA foreign_keys = ON')
    this.database.exec('PRAGMA journal_mode = WAL')
  }

  async execute<T = unknown[]>(sql: string, parameters: SQLInputValue[] = []): Promise<[T]> {
    const statement = this.database.prepare(sql)
    const command = sql.trimStart().split(/\s+/, 1)[0]?.toLowerCase()

    if (command === 'select' || command === 'with') {
      return [statement.all(...parameters) as T]
    }

    const result = statement.run(...parameters)
    return [
      {
        insertId: Number(result.lastInsertRowid ?? 0),
        changes: result.changes,
      } as T,
    ]
  }

  async beginTransaction() {
    this.database.exec('BEGIN')
  }

  async commit() {
    this.database.exec('COMMIT')
  }

  async rollback() {
    this.database.exec('ROLLBACK')
  }

  async backupTo(destinationPath: string) {
    await backup(this.database, destinationPath)
  }

  async end() {
    this.database.close()
  }
}

function getDatabasePath() {
  return process.env.SQLITE_DB_PATH || path.join(app.getPath('userData'), 'log-app.db')
}

function createDatabaseConnection() {
  const databasePath = getDatabasePath()
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  return new SqliteConnection(databasePath)
}

function createRecordRemovalBackupPath(databasePath: string) {
  const parsedPath = path.parse(databasePath)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(
    parsedPath.dir,
    `${parsedPath.name}.before-record-removal-${timestamp}${parsedPath.ext || '.db'}`,
  )
}

async function testDatabaseConnection() {
  const connection = createDatabaseConnection()

  await connection.execute('SELECT 1')
  await connection.end()

  console.log(`SQLite database is ready: ${getDatabasePath()}`)
}

async function testDatabaseReadWrite() {
  const connection = createDatabaseConnection()

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS database_smoke_test (
        value TEXT NOT NULL
      )
    `)
    await connection.execute('DELETE FROM database_smoke_test')
    await connection.execute('INSERT INTO database_smoke_test (value) VALUES (?)', ['ok'])

    const [rows] = await connection.execute<Array<{ value: string }>>(
      'SELECT value FROM database_smoke_test',
    )

    if (rows.length !== 1 || rows[0].value !== 'ok') {
      throw new Error('SQLite read/write verification returned an unexpected result.')
    }

    await connection.execute('DROP TABLE database_smoke_test')
  } finally {
    await connection.end()
  }
}

function createEntriesTableSql(tableName = 'entries') {
  return `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_date TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '無題',
        content TEXT NOT NULL DEFAULT '',
        bullet_points TEXT NOT NULL DEFAULT '',
        breakfast TEXT NOT NULL DEFAULT '',
        lunch TEXT NOT NULL DEFAULT '',
        dinner TEXT NOT NULL DEFAULT '',
        mood_score INTEGER NULL CHECK (mood_score BETWEEN 1 AND 5),
        condition_score INTEGER NULL CHECK (condition_score BETWEEN 1 AND 5),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
}

async function normalizeEntriesSchema(
  connection: SqliteConnection,
  entryColumns: Array<{ name: string }>,
) {
  const expectedColumnNames = new Set([
    'id',
    'log_date',
    'title',
    'content',
    'bullet_points',
    'breakfast',
    'lunch',
    'dinner',
    'mood_score',
    'condition_score',
    'created_at',
    'updated_at',
  ])
  const currentColumnNames = new Set(entryColumns.map((column) => column.name))
  const hasUnexpectedColumns = entryColumns.some(
    (column) => !expectedColumnNames.has(column.name),
  )
  const hasMissingColumns = [...expectedColumnNames].some(
    (columnName) => !currentColumnNames.has(columnName),
  )

  if (!hasUnexpectedColumns && !hasMissingColumns) {
    return
  }

  const selectColumn = (columnName: string, fallback: string) =>
    currentColumnNames.has(columnName) ? columnName : fallback
  const sourceFilter = currentColumnNames.has('entry_type')
    ? "WHERE entry_type <> 'record'"
    : ''

  await connection.execute('PRAGMA foreign_keys = OFF')

  try {
    await connection.beginTransaction()
    await connection.execute(createEntriesTableSql('entries_next'))
    await connection.execute(`
      INSERT INTO entries_next (
        id,
        log_date,
        title,
        content,
        bullet_points,
        breakfast,
        lunch,
        dinner,
        mood_score,
        condition_score,
        created_at,
        updated_at
      )
      SELECT
        ${selectColumn('id', 'NULL')},
        ${selectColumn('log_date', "date('now')")},
        ${selectColumn('title', "'無題'")},
        ${selectColumn('content', "''")},
        ${selectColumn('bullet_points', "''")},
        ${selectColumn('breakfast', "''")},
        ${selectColumn('lunch', "''")},
        ${selectColumn('dinner', "''")},
        ${selectColumn('mood_score', 'NULL')},
        ${selectColumn('condition_score', 'NULL')},
        ${selectColumn('created_at', 'CURRENT_TIMESTAMP')},
        ${selectColumn('updated_at', 'CURRENT_TIMESTAMP')}
      FROM entries
      ${sourceFilter}
    `)
    await connection.execute('DROP TABLE entries')
    await connection.execute('ALTER TABLE entries_next RENAME TO entries')
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.execute('PRAGMA foreign_keys = ON')
  }
}

function createTagsTableSql(tableName = 'tags') {
  return `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_fixed INTEGER NOT NULL DEFAULT 0
      )
    `
}

async function normalizeTagsSchema(
  connection: SqliteConnection,
  tagColumns: Array<{ name: string }>,
) {
  const expectedColumnNames = new Set(['id', 'name', 'is_fixed'])
  const currentColumnNames = new Set(tagColumns.map((column) => column.name))
  const hasUnexpectedColumns = tagColumns.some(
    (column) => !expectedColumnNames.has(column.name),
  )
  const hasMissingColumns = [...expectedColumnNames].some(
    (columnName) => !currentColumnNames.has(columnName),
  )

  if (!hasUnexpectedColumns && !hasMissingColumns) {
    return
  }

  const selectColumn = (columnName: string, fallback: string) =>
    currentColumnNames.has(columnName) ? columnName : fallback

  await connection.execute('PRAGMA foreign_keys = OFF')

  try {
    await connection.beginTransaction()
    await connection.execute(createTagsTableSql('tags_next'))
    await connection.execute(`
      INSERT INTO tags_next (id, name, is_fixed)
      SELECT
        ${selectColumn('id', 'NULL')},
        ${selectColumn('name', "''")},
        ${selectColumn('is_fixed', '0')}
      FROM tags
    `)
    await connection.execute('DROP TABLE tags')
    await connection.execute('ALTER TABLE tags_next RENAME TO tags')
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.execute('PRAGMA foreign_keys = ON')
  }
}

async function migrateAwayRecordFeature(
  connection: SqliteConnection,
  databasePath: string,
  entryColumns: Array<{ name: string }>,
  tagColumns: Array<{ name: string }>,
) {
  const hasEntryType = entryColumns.some((column) => column.name === 'entry_type')
  const hasDiaryTagTarget = tagColumns.some((column) => column.name === 'use_in_diary')
  const hasRecordTagTarget = tagColumns.some((column) => column.name === 'use_in_record')

  if (!hasEntryType && !hasDiaryTagTarget && !hasRecordTagTarget) {
    return
  }

  const backupPath = createRecordRemovalBackupPath(databasePath)
  await connection.backupTo(backupPath)
  console.log(`SQLite backup created before record removal: ${backupPath}`)

  try {
    await connection.beginTransaction()

    if (hasEntryType) {
      await connection.execute(`
        DELETE FROM entry_tags
        WHERE entry_id IN (
          SELECT id
          FROM entries
          WHERE entry_type = 'record'
        )
      `)
      await connection.execute("DELETE FROM entries WHERE entry_type = 'record'")
    }

    if (hasDiaryTagTarget) {
      // 記録専用タグは、日記履歴からも参照されていなければ削除する。
      await connection.execute(`
        DELETE FROM tags
        WHERE use_in_diary = 0
          AND NOT EXISTS (
            SELECT 1
            FROM entry_tags
            WHERE entry_tags.tag_id = tags.id
          )
      `)
      // 日記履歴で使われている記録専用タグは、履歴を守るため通常タグとして残す。
      await connection.execute(`
        UPDATE tags
        SET is_fixed = 0
        WHERE is_fixed = 1
          AND use_in_diary = 0
      `)
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

async function dropTablesOutsideCurrentSchema(connection: SqliteConnection) {
  const currentTableNames = new Set([
    'entries',
    'tags',
    'entry_tags',
    'habits',
    'habit_logs',
    'todos',
    'habit_schedules',
  ])
  const [tables] = await connection.execute<Array<{ name: string }>>(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
  `)
  const tableNamesToDrop = tables
    .map((table) => table.name)
    .filter((tableName) => !currentTableNames.has(tableName))

  if (tableNamesToDrop.length === 0) {
    return
  }

  await connection.execute('PRAGMA foreign_keys = OFF')

  try {
    for (const tableName of tableNamesToDrop) {
      const quotedTableName = tableName.replace(/"/g, '""')
      await connection.execute(`DROP TABLE IF EXISTS "${quotedTableName}"`)
    }
  } finally {
    await connection.execute('PRAGMA foreign_keys = ON')
  }
}

async function ensureDatabaseSchema() {
  const databasePath = getDatabasePath()
  const connection = createDatabaseConnection()

  try {
    await connection.execute(createEntriesTableSql())
    await connection.execute(createTagsTableSql())
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (entry_id, tag_id),
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    const [entryColumns] = await connection.execute<Array<{ name: string }>>(
      "SELECT name FROM pragma_table_info('entries')",
    )
    const [tagColumns] = await connection.execute<Array<{ name: string }>>(
      "SELECT name FROM pragma_table_info('tags')",
    )

    await migrateAwayRecordFeature(connection, databasePath, entryColumns, tagColumns)
    await normalizeEntriesSchema(connection, entryColumns)
    await normalizeTagsSchema(connection, tagColumns)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS habit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_date TEXT NOT NULL,
        habit_id INTEGER NOT NULL,
        is_done INTEGER NOT NULL DEFAULT 0,
        UNIQUE (log_date, habit_id),
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        due_date TEXT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        is_done INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT NULL
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS habit_schedules (
        habit_id INTEGER NOT NULL,
        weekday INTEGER NOT NULL,
        PRIMARY KEY (habit_id, weekday),
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
      )
    `)

    await connection.execute(`
      INSERT OR IGNORE INTO habit_schedules (habit_id, weekday)
      SELECT h.id, weekdays.weekday
      FROM habits h
      CROSS JOIN (
        SELECT 1 AS weekday
        UNION ALL SELECT 2
        UNION ALL SELECT 3
        UNION ALL SELECT 4
        UNION ALL SELECT 5
        UNION ALL SELECT 6
        UNION ALL SELECT 7
      ) AS weekdays
      LEFT JOIN habit_schedules hs ON h.id = hs.habit_id
      WHERE hs.habit_id IS NULL
    `)

    await dropTablesOutsideCurrentSchema(connection)
  } finally {
    await connection.end()
  }
}
async function replaceHabitSchedule(
  connection: SqliteConnection,
  habitId: number,
  weekdays: number[],
) {
  await connection.execute('DELETE FROM habit_schedules WHERE habit_id = ?', [habitId])

  for (const weekday of weekdays) {
    await connection.execute(
      'INSERT INTO habit_schedules (habit_id, weekday) VALUES (?, ?)',
      [habitId, weekday],
    )
  }
}

// IPCから受け取った曜日を月曜=1〜日曜=7の範囲に正規化する。
function normalizeWeekdays(weekdays: number[]) {
  return [...new Set(weekdays)]
    .filter((weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7)
    .sort((left, right) => left - right)
}

// IPCから受け取った優先度を、画面で扱う3種類に制限する。
function normalizeTodoPriority(priority: string): TodoPriority {
  return priority === 'low' || priority === 'high' ? priority : 'normal'
}

// タイトルが空の時は、履歴で見失わないよう「無題」として保存する。
function normalizeEntryTitle(title?: string) {
  const trimmedTitle = title?.trim()
  return trimmedTitle || '無題'
}

// IPCから受け取った評価値を、未設定または1〜5の整数に制限する。
function normalizeWellbeingScore(score: unknown): WellbeingScore | null {
  return typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5
    ? (score as WellbeingScore)
    : null
}

// タグ名から tags の id を取得し、存在しない場合は新しく作成する。
async function findOrCreateTagId(connection: SqliteConnection, tagName: string) {
  const [rows] = await connection.execute<IdRow[]>(
    'SELECT id FROM tags WHERE name = ? LIMIT 1',
    [tagName],
  )

  if (rows[0]) {
    return rows[0].id
  }

  const [result] = await connection.execute<SqliteResult>(
    'INSERT INTO tags (name, is_fixed) VALUES (?, ?)',
    [tagName, 0],
  )

  return result.insertId
}

// 習慣名から habits の id を取得し、存在しない場合は新しく作成する。
async function findOrCreateHabitId(connection: SqliteConnection, habitName: string) {
  const [rows] = await connection.execute<IdRow[]>(
    'SELECT id FROM habits WHERE name = ? LIMIT 1',
    [habitName],
  )

  if (rows[0]) {
    return rows[0].id
  }

  const [result] = await connection.execute<SqliteResult>(
    'INSERT INTO habits (name) VALUES (?)',
    [habitName],
  )

  return result.insertId
}

// 同じ日付・習慣の記録がある場合は更新し、なければ新規作成する。
async function upsertHabitLog(
  connection: SqliteConnection,
  logDate: string,
  habitId: number,
  isDone: boolean,
) {
  const [rows] = await connection.execute<IdRow[]>(
    'SELECT id FROM habit_logs WHERE log_date = ? AND habit_id = ? LIMIT 1',
    [logDate, habitId],
  )

  if (rows[0]) {
    await connection.execute(
      'UPDATE habit_logs SET is_done = ? WHERE id = ?',
      [isDone ? 1 : 0, rows[0].id],
    )
    return rows[0].id
  }

  const [result] = await connection.execute<SqliteResult>(
    'INSERT INTO habit_logs (log_date, habit_id, is_done) VALUES (?, ?, ?)',
    [logDate, habitId, isDone ? 1 : 0],
  )

  return result.insertId
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent) {
  if (
    !win
    || event.sender !== win.webContents
    || event.senderFrame !== win.webContents.mainFrame
  ) {
    throw new Error('Rejected IPC request from an untrusted renderer.')
  }
}

function registerTrustedIpcHandler<Args extends unknown[], Result>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Result,
) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event)
    return listener(event, ...(args as Args))
  })
}

// Renderer から呼び出す保存処理を IPC として登録する。
function registerIpcHandlers() {
  registerTrustedIpcHandler('ai:get-settings', () => getAiSettingsSummary())

  registerTrustedIpcHandler('ai:save-settings', (_event, input: AiSettingsInput) => (
    saveAiSettings(input)
  ))

  registerTrustedIpcHandler('ai:delete-settings', () => deleteAiSettings())

  registerTrustedIpcHandler('ai:test-connection', (_event, input: AiSettingsInput) => (
    testOpenAiConnection(input)
  ))

  registerTrustedIpcHandler('ai:generate-diary', (_event, input: AiDiaryInput) => (
    generateDiaryDraft(input)
  ))

  registerTrustedIpcHandler('entries:list-tags', async () => {
    const connection = createDatabaseConnection()

    try {
      const [rows] = await connection.execute<TagNameRow[]>(
        `
          SELECT DISTINCT t.name
          FROM tags t
          INNER JOIN entry_tags et ON t.id = et.tag_id
          ORDER BY t.name COLLATE NOCASE
        `,
      )

      return rows.map((row) => row.name)
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('todos:list', async () => {
    const connection = createDatabaseConnection()

    try {
      // 未完了、期限の近い順を優先し、完了済みは一覧の後ろに表示する。
      const [rows] = await connection.execute<TodoRow[]>(`
        SELECT
          id,
          title,
          due_date AS dueDate,
          priority,
          is_done AS isDone,
          created_at AS createdAt
        FROM todos
        ORDER BY
          is_done ASC,
          due_date IS NULL ASC,
          due_date ASC,
          CASE priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          id DESC
      `)

      return rows.map((todo) => ({
        id: todo.id,
        title: todo.title,
        dueDate: todo.dueDate,
        priority: normalizeTodoPriority(todo.priority),
        isDone: Boolean(todo.isDone),
        createdAt: todo.createdAt,
      }))
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('todos:add', async (_event, todo: TodoInput) => {
    const title = todo.title.trim()

    if (!title) {
      throw new Error('タスク名を入力してください。')
    }

    const connection = createDatabaseConnection()

    try {
      const [result] = await connection.execute<SqliteResult>(
        'INSERT INTO todos (title, due_date, priority) VALUES (?, ?, ?)',
        [title, todo.dueDate || null, normalizeTodoPriority(todo.priority)],
      )

      return { id: result.insertId }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('todos:update-status', async (_event, id: number, isDone: boolean) => {
    if (!id) {
      throw new Error('更新するタスクを確認してください。')
    }

    const connection = createDatabaseConnection()

    try {
      await connection.execute(
        'UPDATE todos SET is_done = ?, completed_at = ? WHERE id = ?',
        [isDone ? 1 : 0, isDone ? new Date().toISOString() : null, id],
      )

      return { id }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('todos:update', async (_event, id: number, todo: TodoInput) => {
    const title = todo.title.trim()

    if (!id) {
      throw new Error('更新するタスクを確認してください。')
    }
    if (!title) {
      throw new Error('タスク名を入力してください。')
    }

    const connection = createDatabaseConnection()

    try {
      await connection.execute(
        'UPDATE todos SET title = ?, due_date = ?, priority = ? WHERE id = ?',
        [title, todo.dueDate || null, normalizeTodoPriority(todo.priority), id],
      )

      return { id }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('todos:delete', async (_event, id: number) => {
    if (!id) {
      throw new Error('削除するタスクを確認してください。')
    }

    const connection = createDatabaseConnection()

    try {
      await connection.execute('DELETE FROM todos WHERE id = ?', [id])
      return { id }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('reports:habit-achievements', async () => {
    const connection = createDatabaseConnection()

    try {
      // 習慣ごとの達成回数と記録回数を集計し、達成率の計算元を返す。
      const [rows] = await connection.execute<HabitAchievementReportRow[]>(`
        SELECT
          h.id,
          h.name,
          COALESCE(SUM(CASE WHEN hl.is_done = 1 THEN 1 ELSE 0 END), 0) AS doneCount,
          COUNT(hl.id) AS totalCount
        FROM habits h
        LEFT JOIN habit_logs hl ON h.id = hl.habit_id
        GROUP BY h.id, h.name
        ORDER BY h.name
      `)

      return rows.map((row) => {
        const doneCount = Number(row.doneCount ?? 0)
        const totalCount = Number(row.totalCount ?? 0)

        return {
          id: row.id,
          name: row.name,
          doneCount,
          totalCount,
          achievementRate: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0,
        }
      })
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('settings:list', async () => {
    const connection = createDatabaseConnection()

    try {
      // 設定画面で編集する固定タグ、習慣項目をまとめて取得する。
      const [fixedTags] = await connection.execute<SettingsTagRow[]>(
        `
          SELECT
            id,
            name,
            is_fixed AS isFixed
          FROM tags
          WHERE is_fixed = ?
          ORDER BY name
        `,
        [1],
      )
      const [habits] = await connection.execute<SettingsHabitRow[]>(
        `
          SELECT
            h.id,
            h.name,
            (
              SELECT GROUP_CONCAT(ordered.weekday, ',')
              FROM (
                SELECT hs.weekday
                FROM habit_schedules hs
                WHERE hs.habit_id = h.id
                ORDER BY hs.weekday
              ) ordered
            ) AS weekdays
          FROM habits h
          LEFT JOIN habit_schedules hs ON h.id = hs.habit_id
          GROUP BY h.id, h.name
          ORDER BY h.name
        `,
      )

      return {
        fixedTags: fixedTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          isFixed: Boolean(tag.isFixed),
        })),
        habits: habits.map((habit) => ({
          id: habit.id,
          name: habit.name,
          weekdays: habit.weekdays
            ? habit.weekdays.split(',').map((weekday) => Number(weekday))
            : [],
        })),
      }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('settings:add-fixed-tag', async (
    _event,
    name: string,
  ) => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      throw new Error('タグ名を入力してください。')
    }

    const connection = createDatabaseConnection()

    try {
      const [rows] = await connection.execute<IdRow[]>(
        'SELECT id FROM tags WHERE name = ? LIMIT 1',
        [trimmedName],
      )

      if (rows[0]) {
        await connection.execute(
          'UPDATE tags SET is_fixed = ? WHERE id = ?',
          [1, rows[0].id],
        )
        return { id: rows[0].id }
      }

      const [result] = await connection.execute<SqliteResult>(
        'INSERT INTO tags (name, is_fixed) VALUES (?, ?)',
        [trimmedName, 1],
      )

      return { id: result.insertId }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('settings:update-fixed-tag', async (
    _event,
    id: number,
    name: string,
  ) => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      throw new Error('タグ名を入力してください。')
    }

    const connection = createDatabaseConnection()

    try {
      await connection.execute(
        'UPDATE tags SET name = ?, is_fixed = ? WHERE id = ?',
        [trimmedName, 1, id],
      )

      return { id }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('settings:delete-fixed-tag', async (_event, id: number) => {
    const connection = createDatabaseConnection()

    try {
      // 固定タグから外すだけにして、過去の履歴とのタグ紐付けは保持する。
      await connection.execute('UPDATE tags SET is_fixed = ? WHERE id = ?', [0, id])

      return { id }
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('settings:add-habit', async (_event, name: string, weekdays: number[]) => {
    const trimmedName = name.trim()
    const normalizedWeekdays = normalizeWeekdays(weekdays)

    if (!trimmedName) {
      throw new Error('習慣名を入力してください。')
    }
    if (normalizedWeekdays.length === 0) {
      throw new Error('実施する曜日を選択してください。')
    }

    const connection = createDatabaseConnection()

    try {
      await connection.beginTransaction()
      const id = await findOrCreateHabitId(connection, trimmedName)
      await replaceHabitSchedule(connection, id, normalizedWeekdays)
      await connection.commit()
      return { id }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler(
    'settings:update-habit',
    async (_event, id: number, name: string, weekdays: number[]) => {
    const trimmedName = name.trim()
    const normalizedWeekdays = normalizeWeekdays(weekdays)

    if (!trimmedName) {
      throw new Error('習慣名を入力してください。')
    }
    if (normalizedWeekdays.length === 0) {
      throw new Error('実施する曜日を選択してください。')
    }

    const connection = createDatabaseConnection()

    try {
      await connection.beginTransaction()
      await connection.execute('UPDATE habits SET name = ? WHERE id = ?', [trimmedName, id])
      await replaceHabitSchedule(connection, id, normalizedWeekdays)
      await connection.commit()
      return { id }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
    },
  )

  registerTrustedIpcHandler('settings:delete-habit', async (_event, id: number) => {
    const connection = createDatabaseConnection()

    try {
      await connection.beginTransaction()
      // 習慣削除時は実行ログを先に消して、外部キー制約に備える。
      await connection.execute('DELETE FROM habit_schedules WHERE habit_id = ?', [id])
      await connection.execute('DELETE FROM habit_logs WHERE habit_id = ?', [id])
      await connection.execute('DELETE FROM habits WHERE id = ?', [id])
      await connection.commit()

      return { id }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('entries:list', async (_event, filters: EntrySearchFilters = {}) => {
    const connection = createDatabaseConnection()

    try {
      const conditions: string[] = []
      const parameters: Array<string | number> = []
      const keyword = filters.keyword?.trim()
      const tag = filters.tag?.trim()

      if (keyword) {
        // タイトル、本文、メモ、食事のどれに含まれる語句でも検索できるようにする。
        conditions.push(`(
          e.title LIKE ?
          OR e.content LIKE ?
          OR e.bullet_points LIKE ?
          OR e.breakfast LIKE ?
          OR e.lunch LIKE ?
          OR e.dinner LIKE ?
        )`)
        const keywordPattern = `%${keyword}%`
        parameters.push(
          keywordPattern,
          keywordPattern,
          keywordPattern,
          keywordPattern,
          keywordPattern,
          keywordPattern,
        )
      }
      if (tag) {
        // 検索用の別名を使い、結果側のGROUP_CONCATには全タグを残す。
        conditions.push(`
          EXISTS (
            SELECT 1
            FROM entry_tags search_et
            INNER JOIN tags search_t ON search_et.tag_id = search_t.id
            WHERE search_et.entry_id = e.id
              AND search_t.name = ?
          )
        `)
        parameters.push(tag)
      }
      if (filters.startDate) {
        conditions.push('e.log_date >= ?')
        parameters.push(filters.startDate)
      }
      if (filters.endDate) {
        conditions.push('e.log_date <= ?')
        parameters.push(filters.endDate)
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const resultLimitClause = filters.resultLimit === null ? '' : 'LIMIT 100'

      // 履歴画面用に、検索条件を適用して日記本体とタグを新しい順で取得する。
      const [rows] = await connection.execute<EntryHistoryRow[]>(`
        SELECT
          e.id,
          e.log_date AS date,
          e.title,
          e.content,
          e.bullet_points AS bulletPoints,
          e.breakfast,
          e.lunch,
          e.dinner,
          e.mood_score AS moodScore,
          e.condition_score AS conditionScore,
          (
            SELECT GROUP_CONCAT(ordered.name, ',')
            FROM (
              SELECT t.name
              FROM entry_tags et
              INNER JOIN tags t ON et.tag_id = t.id
              WHERE et.entry_id = e.id
              ORDER BY t.name
            ) ordered
          ) AS tags
        FROM entries e
        LEFT JOIN entry_tags et ON e.id = et.entry_id
        LEFT JOIN tags t ON et.tag_id = t.id
        ${whereClause}
        GROUP BY
          e.id,
          e.log_date,
          e.title,
          e.content,
          e.bullet_points,
          e.breakfast,
          e.lunch,
          e.dinner,
          e.mood_score,
          e.condition_score
        ORDER BY e.log_date DESC, e.id DESC
        ${resultLimitClause}
      `, parameters)

      return rows.map((row) => ({
          id: row.id,
          date: row.date,
          title: normalizeEntryTitle(row.title),
          content: row.content,
          bulletPoints: row.bulletPoints ?? '',
          breakfast: row.breakfast ?? '',
          lunch: row.lunch ?? '',
          dinner: row.dinner ?? '',
          moodScore: normalizeWellbeingScore(row.moodScore),
          conditionScore: normalizeWellbeingScore(row.conditionScore),
          tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
        }))
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('entries:update', async (_event, entry: EntryUpdateInput) => {
    if (!entry.id || !entry.date) {
      throw new Error('更新する日記と日付を確認してください。')
    }

    const title = normalizeEntryTitle(entry.title)
    const moodScore = normalizeWellbeingScore(entry.moodScore)
    const conditionScore = normalizeWellbeingScore(entry.conditionScore)
    const connection = createDatabaseConnection()

    try {
      await connection.beginTransaction()
      await connection.execute(
        `UPDATE entries
         SET log_date = ?, title = ?, content = ?, bullet_points = ?, breakfast = ?, lunch = ?, dinner = ?, mood_score = ?, condition_score = ?
         WHERE id = ?`,
        [
          entry.date,
          title,
          entry.content,
          entry.bulletPoints,
          entry.breakfast,
          entry.lunch,
          entry.dinner,
          moodScore,
          conditionScore,
          entry.id,
        ],
      )

      // 編集後のタグ内容に合わせて、既存の紐付けを作り直す。
      await connection.execute('DELETE FROM entry_tags WHERE entry_id = ?', [entry.id])
      const uniqueTags = [...new Set(entry.tags.map((tag) => tag.trim()).filter(Boolean))]

      for (const tagName of uniqueTags) {
        const tagId = await findOrCreateTagId(connection, tagName)
        await connection.execute(
          'INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)',
          [entry.id, tagId],
        )
      }

      await connection.commit()

      return {
        id: entry.id,
        tagCount: uniqueTags.length,
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('entries:delete', async (_event, id: number) => {
    if (!id) {
      throw new Error('削除する日記を確認してください。')
    }

    const connection = createDatabaseConnection()

    try {
      await connection.beginTransaction()
      await connection.execute('DELETE FROM entry_tags WHERE entry_id = ?', [id])
      await connection.execute('DELETE FROM entries WHERE id = ?', [id])
      await connection.commit()

      // habit_logs は日付単位の実行履歴なので、日記1件の削除では保持する。
      return { id }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
  })

  registerTrustedIpcHandler('entries:save', async (_event, entry: EntryInput) => {
    if (!entry.date) {
      throw new Error('日付を入力してください。')
    }

    const title = normalizeEntryTitle(entry.title)
    const moodScore = normalizeWellbeingScore(entry.moodScore)
    const conditionScore = normalizeWellbeingScore(entry.conditionScore)
    const connection = createDatabaseConnection()

    try {
      await connection.beginTransaction()

      // entries に日記の本体データを保存する。
      const [result] = await connection.execute<SqliteResult>(
        `INSERT INTO entries (
          log_date,
          title,
          content,
          bullet_points,
          breakfast,
          lunch,
          dinner,
          mood_score,
          condition_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.date,
          title,
          entry.content,
          entry.bulletPoints,
          entry.breakfast,
          entry.lunch,
          entry.dinner,
          moodScore,
          conditionScore,
        ],
      )
      const entryId = result.insertId

      // 入力されたタグを tags に作成し、entry_tags で今回の日記と紐付ける。
      const uniqueTags = [...new Set(entry.tags.map((tag) => tag.trim()).filter(Boolean))]
      const tagIds: number[] = []

      for (const tagName of uniqueTags) {
        const tagId = await findOrCreateTagId(connection, tagName)
        tagIds.push(tagId)

        await connection.execute(
          'INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)',
          [entryId, tagId],
        )
      }

      const habitLogIds: number[] = []

      for (const habit of entry.habits) {
        const habitLogId = await upsertHabitLog(connection, entry.date, habit.id, habit.isDone)
        habitLogIds.push(habitLogId)
      }

      await connection.commit()

      return {
        id: entryId,
        tagCount: tagIds.length,
        habitLogCount: habitLogIds.length,
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
  })
}

// Electron のウィンドウを作成し、開発時は Vite、本番時はビルド済み HTML を読み込む。
function createWindow() {
  win = new BrowserWindow({
    title: 'log-app',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.mjs'),
      sandbox: true,
      webviewTag: false,
    },
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  try {
    await ensureDatabaseSchema()
    await testDatabaseConnection()

    if (isDatabaseSmokeTest) {
      await testDatabaseReadWrite()
    }
  } catch (error) {
    console.error('SQLite setup failed.', error)

    if (isDatabaseSmokeTest) {
      app.exit(1)
      return
    }
  }

  if (isDatabaseSmokeTest) {
    app.exit(0)
    return
  }

  registerIpcHandlers()
  createWindow()
  setupAutoUpdater()
})
