import { useWindowManager } from '@/providers/window-manager'
import { Window } from "@/components/window/index"

export const WindowManager = () => {
	const { windows } = useWindowManager()

	return (
		<>
			{windows.map(win =>
				<Window key={win.id} window={win} />
			)}
		</>
	)
}
