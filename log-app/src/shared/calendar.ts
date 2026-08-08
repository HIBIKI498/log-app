export const CALENDAR_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

export type CalendarDay = {
  date: string
  day: number
}

function parseMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)

  if (!match) {
    throw new Error(`Invalid calendar month: ${month}`)
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1

  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Invalid calendar month: ${month}`)
  }

  return { year, monthIndex }
}

function formatMonth(year: number, monthIndex: number) {
  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}`
}

export function getMonthFromDate(date: string) {
  return date.slice(0, 7)
}

export function formatCalendarMonth(month: string) {
  const { year, monthIndex } = parseMonth(month)
  return `${year}年${monthIndex + 1}月`
}

export function moveCalendarMonth(month: string, offset: number) {
  const { year, monthIndex } = parseMonth(month)
  const absoluteMonth = year * 12 + monthIndex + offset
  const nextYear = Math.floor(absoluteMonth / 12)
  const nextMonthIndex = ((absoluteMonth % 12) + 12) % 12

  return formatMonth(nextYear, nextMonthIndex)
}

export function getCalendarMonthRange(month: string) {
  const { year, monthIndex } = parseMonth(month)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function createCalendarDays(month: string): Array<CalendarDay | null> {
  const { year, monthIndex } = parseMonth(month)
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const days: Array<CalendarDay | null> = Array.from({ length: firstWeekday }, () => null)

  for (let day = 1; day <= lastDay; day += 1) {
    days.push({
      date: `${month}-${String(day).padStart(2, '0')}`,
      day,
    })
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}
