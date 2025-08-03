import { useWidgetManager } from '@/providers/widget-manager'
import { WidgetWrapper } from './widget-wrapper'

export const WidgetLayer = () => {
  const { widgets } = useWidgetManager()

	return (
    <div
      className="absolute inset-0 pt-20 grid gap-6 p-6 -z-10"
      style={{
        gridTemplateColumns: 'repeat(6, 1fr)',
        gridTemplateRows: 'repeat(9, 100px)',
        maxHeight: '100vh', // non va oltre la viewport
      }}
    >
      {widgets.map(w => {
        // Fallback su dimensioni accettabili
        const width = Math.min(Math.max(w.size.width, 1), 6)
        const height = Math.min(Math.max(w.size.height, 1), 5)

        return (
          <div
            key={w.id}
            style={{
              gridColumn: `span ${width}`,
              gridRow: `span ${height}`
            }}
            className="bg-white/10 rounded-xl backdrop-blur-lg shadow-xl overflow-hidden"
          >
            <WidgetWrapper widget={w} />
          </div>
        )
      })}
		</div>
	)
}
