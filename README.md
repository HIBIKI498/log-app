# log-app

日記、記録、習慣トラッカー、ToDo をまとめて管理する PC 向けデスクトップアプリです。

Electron + React + TypeScript + Vite + SQLite で開発しています。Windows 用インストーラーとポータブル版をビルドできます。

## 開発環境

- Node.js
- npm
- Electron
- React
- TypeScript
- Vite
- SQLite
- Electron内蔵SQLite (`node:sqlite`)

## 初回セットアップ

```bash
cd log-app
npm install
cp .env.example .env
```

`.env` には必要に応じて SQLite の保存先を書きます。未指定の場合は Electron の `userData` フォルダに保存されます。

```env
# Optional. If omitted, the app stores data in Electron's userData folder.
# SQLITE_DB_PATH=C:\Users\your_name\AppData\Roaming\log-app\log-app.db
```

## 開発用に起動

```bash
npm run dev
```

## 動作確認

```bash
npx tsc --noEmit
npm run lint
npx vite build
```

Windows 用インストーラーまで作る場合:

```bash
npm run build
```

生成物は `log-app/release/` 配下に出力されます。

## 主な機能

- 日記の作成、編集、削除
- 軽い記録メモの作成、編集、削除
- 固定タグと自由入力タグによる分類
- 履歴検索、日付範囲検索、タグ絞り込み
- 箇条書きメモの入力補助
- 習慣項目の曜日設定、日記画面でのチェック記録
- レポート画面での習慣達成率表示
- ToDo の追加、完了切り替え、絞り込み、削除

## ファイル構成

```text
log-app/
├── README.md
└── log-app/
    ├── electron/
    │   ├── main.ts
    │   ├── preload.ts
    │   └── electron-env.d.ts
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── index.css
    │   ├── features/
    │   │   ├── diary/DiaryPage.tsx
    │   │   ├── records/RecordPage.tsx
    │   │   ├── history/HistoryPage.tsx
    │   │   ├── reports/ReportsPage.tsx
    │   │   ├── tags/TagsPage.tsx
    │   │   └── todos/TodoPage.tsx
    │   └── shared/
    │       ├── bulletPoints.ts
    │       ├── date.ts
    │       ├── DeleteConfirmationModal.tsx
    │       ├── habits.ts
    │       └── types.ts
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## 主なファイル

- `log-app/src/features/diary/DiaryPage.tsx`: 日記の入力、タグ、箇条書きメモ、習慣チェックを担当します。
- `log-app/src/features/records/RecordPage.tsx`: 軽い記録メモの入力を担当します。
- `log-app/src/features/history/HistoryPage.tsx`: 日記と記録の検索、編集、削除を担当します。
- `log-app/src/features/reports/ReportsPage.tsx`: 習慣達成率のレポートを担当します。
- `log-app/src/features/tags/TagsPage.tsx`: 固定タグと習慣項目の管理を担当します。
- `log-app/src/features/todos/TodoPage.tsx`: ToDo の追加、更新、削除を担当します。
- `log-app/electron/main.ts`: SQLite 初期化と Electron IPC を担当します。
- `log-app/electron/preload.ts`: `window.logApp` API を React 側に公開します。

## SQLite

主なテーブル:

- `entries`: 日記・記録の本体
- `tags`: タグのマスターデータ
- `entry_tags`: 日記・記録とタグの紐付け
- `habits`: 習慣項目のマスターデータ
- `habit_schedules`: 習慣項目と実行曜日の紐付け
- `habit_logs`: 習慣の実行記録
- `todos`: ToDo タスク

## データとプライバシー

- 日記、記録、習慣、ToDo は外部サーバーへ送信せず、端末内の SQLite に保存します。
- データベースは暗号化されません。端末を共有する場合は OS のアカウントとディスク暗号化を利用してください。
- 通常の保存先は Electron の `userData` フォルダーです。アンインストールしてもデータは自動削除されません。
- インストーラー版は、更新確認のため GitHub Releases に接続します。

## セキュリティ

脆弱性と思われる問題を見つけた場合は、公開 Issue に認証情報や個人情報を記載しないでください。報告方法は `SECURITY.md` を参照してください。
