import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { init } from './init'
import { WallpaperProvider } from './providers/wallpaper'
import { WindowManagerProvider } from './providers/window-manager'
import { AppsProvider } from './providers/apps'
import { PreviewRefsProvider } from './providers/preview-refs'
import { ModalProvider } from './providers/modal'

init(
	<WallpaperProvider >
		<ModalProvider>
			<WindowManagerProvider>
				<PreviewRefsProvider>
					<AppsProvider>
						<RouterProvider router={router} />
					</AppsProvider>
				</PreviewRefsProvider>
			</WindowManagerProvider>
		</ModalProvider>
	</WallpaperProvider>
)
