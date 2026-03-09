import { useWidgetManager } from '@/providers/widget-manager'
import { WidgetWrapper } from './widget-wrapper'
import { usePersistentStore } from '@/providers/persistent-store'
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings'

export const WidgetLayer = () => {
  const { widgets } = useWidgetManager()
  const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const settings = resolveDesktopSettings(storedSettings)
  const sortedWidgets = [...widgets].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1))

  return (
    <div
      data-widget-layer="true"
      className="absolute inset-x-0 top-0 bottom-28 pointer-events-none overflow-visible"
    >
      {sortedWidgets.map(w => {
        const opacity = Math.max(0, Math.min(100, Math.round((w.style?.opacity ?? 78) * (settings.widgetsOpacity / 100))))
        const blur = settings.widgetsBlur ? (w.style?.blur ?? 12) : 0

        return (
          <div
            key={w.id}
            className="pointer-events-auto rounded-2xl overflow-visible absolute transition-[box-shadow,transform,backdrop-filter,background-color] duration-200"
            style={{
              left: `${w.position.x}%`,
              top: `${w.position.y}%`,
              width: `${w.size.width}px`,
              height: `${w.size.height}px`,
              zIndex: w.zIndex ?? 1,
              backgroundColor: `rgba(255,255,255,${opacity / 100 * 0.18})`,
              backdropFilter: `blur(${blur}px)`,
              boxShadow: `0 12px 42px rgba(0,0,0,${0.22 * (opacity / 100)})`,
            }}
          >
            <WidgetWrapper widget={w} />
          </div>
        )
      })}
    </div>
  )
}
