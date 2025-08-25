import { useWindowManager } from '@/providers/window-manager'
import { useWidgetManager } from '@/providers/widget-manager'
import { apps } from '@/apps/definitions'
import { useState, useMemo } from 'react'

export const TaskManager = () => {
	const { windows, closeWindow } = useWindowManager()
	const { widgets, removeWidget } = useWidgetManager()

	const [search, setSearch] = useState('')
	const [selected, setSelected] = useState<Set<string>>(new Set())


	// Raggruppa per appId
	const groupedWindows = useMemo(() => {
		const groups: Record<string, { appName: string, instances: typeof windows }> = {}
		for (const win of windows) {
			if (!groups[win.appId]) {
				groups[win.appId] = { appName: apps.get(win.appId)?.name ?? win.appId, instances: [] }
			}
			groups[win.appId].instances.push(win)
		}
		return groups
	}, [windows])

	// Filtra app e widget
	const filteredGroups = useMemo(() => {
		if (!search.trim()) return groupedWindows
		const term = search.toLowerCase()
		return Object.fromEntries(
			Object.entries(groupedWindows).filter(([appId, group]) =>
				appId.toLowerCase().includes(term) || group.appName.toLowerCase().includes(term)
			)
		)
	}, [groupedWindows, search])

	const filteredWidgets = useMemo(() => {
		if (!search.trim()) return widgets
		const term = search.toLowerCase()
		return widgets.filter(w => w.id.toLowerCase().includes(term))
	}, [widgets, search])

	// Toggle selezione
	const toggleSelect = (id: string) => {
		setSelected(prev => {
			const newSet = new Set(prev)
			if (newSet.has(id)) newSet.delete(id)
			else newSet.add(id)
			return newSet
		})
	}

	const killSelected = () => {
		selected.forEach(id => closeWindow(id))
		setSelected(new Set())
	}

	return (
		<div className="h-full w-full p-4 bg-black/10 backdrop-blur-lg border border-white/20 rounded-2xl text-white text-sm flex flex-col gap-4 overflow-auto custom-scroll">
			<h2 className="text-xl font-bold text-white">Task Manager</h2>

			{/* Ricerca */}
			<input
				type="text"
				placeholder="Cerca app, id o widget..."
				value={search}
				onChange={e => setSearch(e.target.value)}
				className="px-3 py-1 rounded-full bg-white/10 text-white placeholder-white/40 outline-none"
			/>

			{/* Lista finestre raggruppate */}
			<div>
				<h3 className="font-semibold mt-2 mb-1">App attive ({windows.length} finestre)</h3>
				{Object.keys(filteredGroups).length === 0 ? (
					<p className="text-white/60">Nessuna finestra trovata</p>
				) : (
					Object.entries(filteredGroups).map(([appId, group]) => (
						<div key={appId} className="bg-white/10 rounded-xl p-2 mb-2">
							<p className="text-white font-medium">{group.appName} <span className="text-white/40">({group.instances.length})</span></p>
							<ul className="mt-1 space-y-1">
								{group.instances.map(win => (
									<li key={win.id} className="flex justify-between items-center bg-black/10 px-3 py-1.5 rounded-full">
										<div className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={selected.has(win.id)}
                                                onChange={() => toggleSelect(win.id)}
                                                className='rounded-full accent-red-500'
											/>
											<span className="text-sm text-white/80" title={win.id}>{win.title}</span>
										</div>
										<button
											className="text-xs bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-full text-white"
											onClick={() => closeWindow(win.id)}
										>
											Kill
										</button>
									</li>
								))}
							</ul>
						</div>
					))
				)}
			</div>

			{/* Kill selezionati */}
			{selected.size > 0 && (
				<div className="flex justify-end">
					<button
						className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-1.5 rounded-full"
						onClick={killSelected}
					>
						Termina {selected.size} process{selected.size > 1 ? 'i' : 'o'}
					</button>
				</div>
			)}

			{/* Widget attivi */}
			<div>
				<h3 className="font-semibold mt-4 mb-1">Widgets ({filteredWidgets.length})</h3>
				{filteredWidgets.length === 0 ? (
					<p className="text-white/60">Nessun widget trovato</p>
				) : (
					<ul className="space-y-1">
						{filteredWidgets.map(w => (
							<li key={w.id} className="bg-white/10 px-3 py-1.5 rounded-xl text-white">
                                {w.id}
                                <button
                                    className="text-xs bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded text-white"
                                    onClick={() => removeWidget(w.id)}
                                >
                                    Kill
                                </button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	)
}
