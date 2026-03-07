import { useWidgetManager } from '@/providers/widget-manager'
import { WidgetWrapper } from './widget-wrapper'
import { usePersistentStore } from '@/providers/persistent-store'
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings'

export const WidgetLayer = () => {
  const { widgets } = useWidgetManager()
  const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const settings = resolveDesktopSettings(storedSettings)

  return (
    <div
      className="absolute inset-0 pt-12 pb-28 grid gap-4 p-4 pointer-events-none"
      style={{
        gridTemplateColumns: `repeat(${settings.widgetsColumns}, 1fr)`,
        gridTemplateRows: 'repeat(9, minmax(90px, 1fr))',
        maxHeight: '100vh', // non va oltre la viewport
      }}
    >
      {widgets.map(w => {
        // Fallback su dimensioni accettabili
        const width = Math.min(Math.max(w.size.width, 1), settings.widgetsColumns)
        const height = Math.min(Math.max(w.size.height, 1), 5)

        return (
          <div
            key={w.id}
            className="pointer-events-auto rounded-xl shadow-xl overflow-hidden"
            style={{
              gridColumn: `span ${width}`,
              gridRow: `span ${height}`,
              backgroundColor: `rgba(255,255,255,${settings.widgetsOpacity / 100 * 0.16})`,
              backdropFilter: settings.widgetsBlur ? 'blur(16px)' : 'none',
            }}
          >
            <WidgetWrapper widget={w} />
          </div>
        )
      })}
    </div>
  )
}
