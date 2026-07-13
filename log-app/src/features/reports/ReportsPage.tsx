import { useCallback, useEffect, useState } from 'react'
import type { FeaturePageProps } from '../../shared/types'

type HabitAchievementReport = {
  id: number
  name: string
  doneCount: number
  totalCount: number
  achievementRate: number
}

export function ReportsPage({ isActive }: FeaturePageProps) {
  const [habitReports, setHabitReports] = useState<HabitAchievementReport[]>([])
  const [habitReportMessage, setHabitReportMessage] = useState('')
  const [isLoadingReports, setIsLoadingReports] = useState(false)

  const loadHabitReports = useCallback(async () => {
    setIsLoadingReports(true)
    setHabitReportMessage('')

    try {
      const reports = await window.logApp.listHabitAchievementReports()
      setHabitReports(reports)

      if (reports.length === 0) {
        setHabitReportMessage('集計できる習慣項目がまだありません。')
      }
    } catch (error) {
      console.error('習慣レポートの取得に失敗しました:', error)
      setHabitReportMessage('習慣レポートの取得に失敗しました。SQLite の接続状態を確認してください。')
    } finally {
      setIsLoadingReports(false)
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      void loadHabitReports()
    }
  }, [isActive, loadHabitReports])

  return (
    <section className="report-section" hidden={!isActive}>
      <div className="section-heading">
        <h2>レポート</h2>
        <button
          className="secondary-button"
          type="button"
          disabled={isLoadingReports}
          onClick={() => void loadHabitReports()}
        >
          {isLoadingReports ? '読み込み中...' : '更新'}
        </button>
      </div>

      <section className="habit-report-section">
        <h3>習慣達成率</h3>
        {habitReportMessage ? <p className="history-message">{habitReportMessage}</p> : null}

        <div className="habit-report-list">
          {habitReports.map((habit) => (
            <article className="habit-report-item" key={habit.id}>
              <div className="habit-report-heading">
                <strong>{habit.name}</strong>
                <span>{habit.achievementRate}%</span>
              </div>
              <div
                aria-label={`${habit.name}の達成率 ${habit.achievementRate}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={habit.achievementRate}
                className="achievement-track"
                role="progressbar"
              >
                <div
                  className="achievement-fill"
                  style={{ width: `${habit.achievementRate}%` }}
                />
              </div>
              <small>
                {habit.doneCount.toLocaleString()}回達成 /{' '}
                {habit.totalCount.toLocaleString()}回記録
              </small>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
