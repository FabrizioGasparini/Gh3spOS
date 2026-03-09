import { useMemo, useState } from 'react'
import { usePersistentStore } from '@/providers/persistent-store'

type PlannerItem = {
  id: string
  title: string
  date: string
}

const sameDay = (date: Date, year: number, month: number, day: number) => {
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
}

export const CalendarPlannerWidget = () => {
  const now = new Date()
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [items, setItems] = usePersistentStore<PlannerItem[]>('widget:planner:v1', [])
  const [title, setTitle] = useState('')

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const monthLabel = useMemo(
    () => cursor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
    [cursor],
  )

  const firstWeekDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const dayCells = useMemo(() => {
    const total = 42
    const cells: Array<{ day: number | null; key: string }> = []
    for (let i = 0; i < total; i += 1) {
      const day = i - firstWeekDay + 1
      if (day <= 0 || day > daysInMonth) {
        cells.push({ day: null, key: `e-${i}` })
      } else {
        cells.push({ day, key: `d-${day}` })
      }
    }
    return cells
  }, [daysInMonth, firstWeekDay])

  const addTodayItem = () => {
    const clean = title.trim()
    if (!clean) return
    const date = now.toISOString().slice(0, 10)
    setItems((prev) => [{ id: crypto.randomUUID(), title: clean, date }, ...prev].slice(0, 30))
    setTitle('')
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const upcoming = useMemo(() => {
    const today = now.toISOString().slice(0, 10)
    return items
      .filter((item) => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4)
  }, [items, now])

  return (
    <div className="h-full w-full text-white flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <button
          onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
        >
          ←
        </button>
        <span className="capitalize font-medium truncate">{monthLabel}</span>
        <button
          onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] opacity-80">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((label) => (
          <div key={label} className="text-center">{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px]">
        {dayCells.map((cell) => {
          const isToday = cell.day !== null && sameDay(now, year, month, cell.day)
          const hasEvent =
            cell.day !== null &&
            items.some((item) => item.date === `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`)

          return (
            <div
              key={cell.key}
              className={`h-5 rounded flex items-center justify-center ${
                cell.day === null
                  ? 'text-transparent'
                  : isToday
                    ? 'bg-cyan-400/35 text-white font-semibold'
                    : 'bg-white/10 text-white/90'
              }`}
            >
              <span>{cell.day ?? '·'}</span>
              {hasEvent && <span className="ml-0.5 text-[8px] text-cyan-200">•</span>}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-1">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Task di oggi"
          className="flex-1 h-7 rounded px-2 text-xs bg-white/15 border border-white/20 outline-none"
        />
        <button onClick={addTodayItem} className="h-7 px-2 rounded bg-cyan-500/70 hover:bg-cyan-500 text-xs">
          +
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scroll space-y-1 pr-1">
        {upcoming.length === 0 && <p className="text-[11px] text-white/55">Nessun evento imminente</p>}
        {upcoming.map((item) => (
          <div key={item.id} className="rounded-lg bg-white/10 px-2 py-1 text-[11px] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate">{item.title}</p>
              <p className="text-white/60">{item.date}</p>
            </div>
            <button onClick={() => removeItem(item.id)} className="text-rose-300 hover:text-rose-200">×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
