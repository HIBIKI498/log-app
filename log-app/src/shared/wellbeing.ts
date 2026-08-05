export type WellbeingScore = 1 | 2 | 3 | 4 | 5

export type WellbeingOption = {
  value: WellbeingScore
  label: string
  emoji: string
}

export const MOOD_OPTIONS: WellbeingOption[] = [
  { value: 1, label: 'とても悪い', emoji: '😞' },
  { value: 2, label: '悪い', emoji: '😕' },
  { value: 3, label: '普通', emoji: '😐' },
  { value: 4, label: '良い', emoji: '🙂' },
  { value: 5, label: 'とても良い', emoji: '😄' },
]

export const CONDITION_OPTIONS: WellbeingOption[] = [
  { value: 1, label: 'とても悪い', emoji: '🤒' },
  { value: 2, label: '悪い', emoji: '😣' },
  { value: 3, label: '普通', emoji: '😐' },
  { value: 4, label: '良い', emoji: '💪' },
  { value: 5, label: 'とても良い', emoji: '✨' },
]

export function parseWellbeingScore(value: string): WellbeingScore | null {
  const parsedValue = Number(value)

  return Number.isInteger(parsedValue) && parsedValue >= 1 && parsedValue <= 5
    ? (parsedValue as WellbeingScore)
    : null
}

export function formatWellbeingScore(
  score: WellbeingScore,
  options: WellbeingOption[],
) {
  const option = options.find((candidate) => candidate.value === score)

  return option ? `${option.emoji} ${option.label}` : '未設定'
}
