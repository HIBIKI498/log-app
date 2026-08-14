import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export const OPENAI_MODEL_OPTIONS = [
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna（低コスト）' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra（品質重視）' },
] as const

export const DEFAULT_OPENAI_MODEL = OPENAI_MODEL_OPTIONS[0].id

type StoredAiSettings = {
  version: 1
  encryptedApiKey: string
  model: string
}

export type AiSettingsInput = {
  apiKey: string
  model: string
}

export type AiSettingsSummary = {
  configured: boolean
  model: string
  modelOptions: Array<{
    id: string
    label: string
  }>
}

export type OpenAiCredentials = {
  apiKey: string
  model: string
}

function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'ai-settings.json')
}

function normalizeModel(model: string) {
  const trimmedModel = model.trim()

  if (!OPENAI_MODEL_OPTIONS.some((option) => option.id === trimmedModel)) {
    throw new Error('使用するOpenAIモデルを選択してください。')
  }

  return trimmedModel
}

function readStoredSettings(): StoredAiSettings | null {
  const settingsFilePath = getSettingsFilePath()

  if (!fs.existsSync(settingsFilePath)) {
    return null
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8')) as Partial<StoredAiSettings>

    if (
      parsed.version !== 1
      || typeof parsed.encryptedApiKey !== 'string'
      || typeof parsed.model !== 'string'
    ) {
      throw new Error('Invalid AI settings format.')
    }

    return {
      version: 1,
      encryptedApiKey: parsed.encryptedApiKey,
      model: OPENAI_MODEL_OPTIONS.some((option) => option.id === parsed.model)
        ? parsed.model
        : DEFAULT_OPENAI_MODEL,
    }
  } catch {
    throw new Error('AI設定を読み込めませんでした。APIキーを設定し直してください。')
  }
}

function writeStoredSettings(settings: StoredAiSettings) {
  const settingsFilePath = getSettingsFilePath()
  fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true })
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  })
}

function encryptApiKey(apiKey: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('この端末ではAPIキーを安全に保存できません。')
  }

  return safeStorage.encryptString(apiKey).toString('base64')
}

function decryptApiKey(encryptedApiKey: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('この端末では保存済みAPIキーを復号できません。')
  }

  try {
    return safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'))
  } catch {
    throw new Error('保存済みAPIキーを読み込めませんでした。APIキーを設定し直してください。')
  }
}

export function getAiSettingsSummary(): AiSettingsSummary {
  const storedSettings = readStoredSettings()

  return {
    configured: Boolean(storedSettings?.encryptedApiKey),
    model: storedSettings?.model ?? DEFAULT_OPENAI_MODEL,
    modelOptions: OPENAI_MODEL_OPTIONS.map((option) => ({ ...option })),
  }
}

export function saveAiSettings(input: AiSettingsInput): AiSettingsSummary {
  const storedSettings = readStoredSettings()
  const apiKey = input.apiKey.trim()
  const model = normalizeModel(input.model)

  if (!apiKey && !storedSettings?.encryptedApiKey) {
    throw new Error('OpenAI APIキーを入力してください。')
  }

  writeStoredSettings({
    version: 1,
    encryptedApiKey: apiKey ? encryptApiKey(apiKey) : storedSettings!.encryptedApiKey,
    model,
  })

  return getAiSettingsSummary()
}

export function deleteAiSettings(): AiSettingsSummary {
  const settingsFilePath = getSettingsFilePath()

  if (fs.existsSync(settingsFilePath)) {
    fs.unlinkSync(settingsFilePath)
  }

  return getAiSettingsSummary()
}

export function getOpenAiCredentials(input?: Partial<AiSettingsInput>): OpenAiCredentials {
  const storedSettings = readStoredSettings()
  const apiKey = input?.apiKey?.trim()
    || (storedSettings ? decryptApiKey(storedSettings.encryptedApiKey) : '')
  const model = normalizeModel(input?.model ?? storedSettings?.model ?? DEFAULT_OPENAI_MODEL)

  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。')
  }

  return { apiKey, model }
}
