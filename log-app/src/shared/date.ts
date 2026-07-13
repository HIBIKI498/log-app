// date input に渡せる yyyy-mm-dd 形式で今日の日付を返す。
export function getTodayString() {
  return new Date().toLocaleDateString('sv-SE')
}

// yyyy-mm-dd 形式の日付から、月曜=1〜日曜=7の曜日番号を返す。
export function getIsoWeekday(dateString: string) {
  const weekday = new Date(`${dateString}T00:00:00`).getDay()
  return weekday === 0 ? 7 : weekday
}
