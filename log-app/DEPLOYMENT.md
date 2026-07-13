# デスクトップ版の配布と更新

## 初回リリース

1. `package.json` の `version` を公開するバージョンに更新します。
2. 変更をコミットして GitHub に push します。
3. 同じバージョンのタグを作成して push します。

```powershell
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

タグの push を契機に GitHub Actions が Windows 版をビルドし、GitHub Releases に次のファイルを公開します。

- `log-app-Windows-1.0.0-Setup.exe`: 利用者向けインストーラー
- `log-app-Windows-1.0.0-Portable.exe`: インストール不要のポータブル版
- `latest.yml`: 自動更新のバージョン情報
- `.blockmap`: 差分更新用データ

インストールせずにすぐ起動したい利用者には、Releases ページにある `Portable.exe` を案内してください。ダウンロード後、ファイルをダブルクリックするだけで起動できます。

`Setup.exe` はPCへインストールして自動更新を利用する場合に使用します。ポータブル版は自動更新の対象外なので、新版が公開されたら新しい `Portable.exe` を再度ダウンロードしてください。アプリのデータは実行ファイルとは別の `userData` フォルダーに保存されるため、実行ファイルを差し替えても引き続き利用できます。

## アプリを更新する

1. `package.json` の `version` を上げます（例: `1.0.0` → `1.0.1`）。
2. 変更をコミットして push します。
3. 新しいバージョンと同じタグを push します。

```powershell
npm version patch --no-git-tag-version
git add log-app/package.json log-app/package-lock.json
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

インストール済みアプリは起動時に GitHub Releases を確認します。新しいバージョンがあれば、ダウンロードと再起動の確認ダイアログが表示されます。SQLite のデータはインストール先ではなく Electron の `userData` フォルダーに保存されるため、通常の更新では保持されます。

## ローカルでインストーラーを確認する

```powershell
cd log-app
npm ci
npm run build
```

成果物は `log-app/release/<version>/` に生成されます。ローカルビルドは GitHub に公開しません。

## 注意事項

- `package.json` のバージョンと Git タグを一致させてください。
- 自動更新の確認はパッケージ版だけで実行され、`npm run dev` 中は実行されません。
- 現在の Windows インストーラーは未署名です。Windows SmartScreen の警告を抑えて一般配布する場合は、コード署名証明書を GitHub Actions に設定してください。
