import { useEffect, useState } from 'react'
import type { WidgetRenderProps } from '@/types'

export const ClockWidget: React.FC<WidgetRenderProps> = ({ widgetSettings }) => {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const format = (n: number) => n.toString().padStart(2, '0')
  const use24h = widgetSettings?.clock24h !== false
  const showSeconds = widgetSettings?.clockShowSeconds === true
  const hour = time.getHours()
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const hour12 = hour % 12 || 12
  const period = hour < 12 ? 'AM' : 'PM'

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white font-mono text-center">
      <div className="text-4xl">
        {use24h ? format(time.getHours()) : format(hour12)}:{format(time.getMinutes())}{showSeconds ? `:${format(time.getSeconds())}` : ''}
        {!use24h && <span className="ml-1 text-sm opacity-75">{period}</span>}
      </div>
      <div className="text-sm opacity-60">{(time.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })).split(' ')[0].charAt(0).toUpperCase() + (time.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })).split(' ')[0].slice(1) + " " + time.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' }).split(' ')[1] + " " + time.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' }).split(' ')[2].charAt(0).toUpperCase() + (time.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })).split(' ')[2].slice(1) }</div>
      <div className="text-xs opacity-70 mt-1">{greeting}</div>
    </div>
  )
}