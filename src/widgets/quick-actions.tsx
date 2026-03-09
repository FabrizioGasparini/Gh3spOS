import { useApps } from '@/providers/apps'
import { useSpotlight } from '@/providers/spotlight'
import { useWindowManager } from '@/providers/window-manager'

export const QuickActionsWidget: React.FC = () => {
	const { open: openSpotlight } = useSpotlight()
	const { apps, canUsePermission } = useApps()
	const { openWindow, windows, snappingEnabled, setSnappingEnabled } = useWindowManager()

	const launch = (id: string) => {
		if (!canUsePermission(id, 'launch')) return
		const app = apps.get(id)
		if (!app) return
		openWindow(app, id)
	}

	return (
		<div className="h-full w-full text-white font-mono text-sm flex flex-col gap-2">
			<h2 className="font-bold">⚡ Quick Actions</h2>
			<div className="grid grid-cols-2 gap-2">
				<button onClick={() => launch('terminal')} className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 transition">Terminal</button>
				<button onClick={() => launch('file-explorer')} className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 transition">Explorer</button>
				<button onClick={() => launch('settings')} className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 transition">Settings</button>
				<button onClick={openSpotlight} className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 transition">Spotlight</button>
			</div>
			<div className="mt-auto flex items-center justify-between text-xs opacity-90">
				<span>Finestre aperte: {windows.filter((w) => !w.isMinimized).length}</span>
				<button
					onClick={() => setSnappingEnabled(!snappingEnabled)}
					className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 transition"
				>
					Snap: {snappingEnabled ? 'ON' : 'OFF'}
				</button>
			</div>
		</div>
	)
}
