import type { WidgetInstance } from '@/types'
import { useWidgetManager } from '@/providers/widget-manager'

export const WidgetWrapper = ({ widget }: { widget: WidgetInstance }) => {
	const { removeWidget } = useWidgetManager()

	return (
		<div className="rounded-xl border border-white/20 shadow-xl backdrop-blur-md bg-white/10 overflow-hidden relative w-full h-full group">
			{/* Bottone chiusura */}
			<button
				onClick={() => removeWidget(widget.id)}
				className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-white/60 hover:text-red-400 transition text-sm z-20"
			>
				×
			</button>

			{/* Contenuto widget */}
			<div className="w-full h-full p-4 text-white text-sm select-none">
				<widget.component />
			</div>
		</div>
	)
}
