import type { WidgetInstance } from '@/types'
import { useWidgetManager } from '@/providers/widget-manager'
import React from 'react';
import { usePersistentStore } from '@/providers/persistent-store';
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings';

export const WidgetWrapper = ({ widget }: { widget: WidgetInstance }) => {
	const { removeWidget, getWidgetComponent } = useWidgetManager()
	const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
	const settings = resolveDesktopSettings(storedSettings)

	const WidgetComponent = React.createElement(getWidgetComponent(widget.id)!);
	return (
		<div className={`rounded-xl shadow-xl overflow-hidden relative w-full h-full group ${settings.widgetsBlur ? 'backdrop-blur-md' : ''} ${settings.widgetsAccentBorders ? 'border border-blue-300/35' : 'border border-white/12'}`}>
			{/* Bottone chiusura */}
			<button
				onClick={() => removeWidget(widget.id)}
				className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-white/60 hover:text-red-400 transition text-sm z-20"
			>
				×
			</button>

			{/* Contenuto widget */}
			<div className="w-full h-full p-4 text-white text-sm select-none">
				{WidgetComponent}
			</div>
		</div>
	)
}
