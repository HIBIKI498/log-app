export type FeaturePageProps = {
  isActive: boolean
}

export type EntryKind = 'diary' | 'record'

export type SettingsItem = {
  id: number
  name: string
}

export type HabitSetting = SettingsItem & {
  weekdays: number[]
}

export type FixedTagSetting = SettingsItem & {
  isFixed: boolean
  entryKinds: EntryKind[]
}
