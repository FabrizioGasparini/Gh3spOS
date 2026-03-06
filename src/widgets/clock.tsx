import { useEffect, useState } from 'react'

export const ClockWidget = () => {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const format = (n: number) => n.toString().padStart(2, '0')
  const hour = time.getHours()
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white font-mono text-center">
      <div className="text-4xl">{format(time.getHours())}:{format(time.getMinutes())}</div>
      <div className="text-sm opacity-60">{time.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
      <div className="text-xs opacity-70 mt-1">{greeting}</div>
    </div>
  )
}