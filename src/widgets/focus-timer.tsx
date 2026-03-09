import { useEffect, useMemo } from 'react'
import { usePersistentStore } from '@/providers/persistent-store'

type FocusPreset = 15 | 25 | 45

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

export const FocusTimerWidget = () => {
  const [preset, setPreset] = usePersistentStore<FocusPreset>('widget:focus:preset', 25)
  const [secondsLeft, setSecondsLeft] = usePersistentStore<number>('widget:focus:seconds', preset * 60)
  const [running, setRunning] = usePersistentStore<boolean>('widget:focus:running', false)
  const [sessions, setSessions] = usePersistentStore<number>('widget:focus:sessions', 0)

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false)
          setSessions((value) => value + 1)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, setRunning, setSecondsLeft, setSessions])

  useEffect(() => {
    if (secondsLeft <= 0 && !running) {
      setSecondsLeft(preset * 60)
    }
  }, [preset, running, secondsLeft, setSecondsLeft])

  const progress = useMemo(() => {
    const total = preset * 60
    return Math.max(0, Math.min(100, ((total - secondsLeft) / total) * 100))
  }, [preset, secondsLeft])

  const applyPreset = (value: FocusPreset) => {
    setPreset(value)
    setSecondsLeft(value * 60)
    setRunning(false)
  }

  return (
    <div className="h-full w-full text-white flex flex-col gap-2 justify-between">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/70">Focus Timer</span>
          <span className="text-cyan-200">Sessioni: {sessions}</span>
        </div>

        <div className="text-3xl font-semibold tracking-wider text-center">{formatTime(secondsLeft)}</div>

        <div className="h-2 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-cyan-400/80 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-[11px]">
        {[15, 25, 45].map((item) => (
          <button
            key={item}
            onClick={() => applyPreset(item as FocusPreset)}
            className={`h-7 rounded border ${preset === item ? 'border-cyan-300/60 bg-cyan-500/30' : 'border-white/20 bg-white/10 hover:bg-white/20'}`}
          >
            {item}m
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 text-[11px]">
        <button
          onClick={() => setRunning((prev) => !prev)}
          className="h-7 rounded bg-cyan-500/70 hover:bg-cyan-500"
        >
          {running ? 'Pausa' : 'Start'}
        </button>
        <button
          onClick={() => setSecondsLeft((prev) => Math.max(0, prev - 60))}
          className="h-7 rounded bg-white/10 hover:bg-white/20"
        >
          -1m
        </button>
        <button
          onClick={() => {
            setRunning(false)
            setSecondsLeft(preset * 60)
          }}
          className="h-7 rounded bg-white/10 hover:bg-white/20"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
