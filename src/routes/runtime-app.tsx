import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApps } from '@/providers/apps'
import type { ComponentType } from 'react'

const RUNTIME_TOKEN = 'gh3sp-runtime-v1'

export const RuntimeAppRoute = () => {
  const { appId = '' } = useParams()
  const query = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const token = query.get('rt')
  const { catalog } = useApps()

  if (token !== RUNTIME_TOKEN) {
    return (
      <div className="h-screen w-screen grid place-items-center bg-slate-950 text-slate-200">
        Runtime access denied
      </div>
    )
  }

  const item = useMemo(() => catalog.find((entry) => entry.id === appId) ?? null, [catalog, appId])

  if (!item) {
    return (
      <div className="h-screen w-screen grid place-items-center bg-slate-950 text-slate-200">
        Runtime app non trovata: {appId}
      </div>
    )
  }

  const RuntimeComponent = item.definition.component as ComponentType<Record<string, unknown>>

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      <RuntimeComponent windowId={`runtime-${item.id}`} />
    </div>
  )
}
