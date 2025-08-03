import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { init } from './init'
import { WindowManagerProvider } from '@/providers/window-manager'
import { AppsProvider } from '@/providers/apps'
import { PreviewRefsProvider } from '@/providers/preview-refs'
import { ModalProvider } from '@/providers/modal'
import { WidgetManagerProvider } from '@/providers/widget-manager'

init(
	<ModalProvider>
		<WindowManagerProvider>
			<PreviewRefsProvider>
				<WidgetManagerProvider>
					<AppsProvider>
						<RouterProvider router={router} />
					</AppsProvider>
				</WidgetManagerProvider>
			</PreviewRefsProvider>
		</WindowManagerProvider>
	</ModalProvider>
)
