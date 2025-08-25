import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { init } from './init'
import { WindowManagerProvider } from '@/providers/window-manager'
import { AppsProvider } from '@/providers/apps'
import { PreviewRefsProvider } from '@/providers/preview-refs'
import { ModalProvider } from '@/providers/modal'
import { WidgetManagerProvider } from '@/providers/widget-manager'
import { SpotlightProvider } from '@/providers/spotlight'
import { PersistentStoreProvider } from '@/providers/persistent-store'
import { WallpaperProvider } from '@/providers/wallpaper'
import { ErrorBoundary } from '@/components/error-boundary'

init(
	<ErrorBoundary>
		<PersistentStoreProvider>
			<WallpaperProvider>	
				<ModalProvider>
					<WindowManagerProvider>
						<SpotlightProvider>
							<PreviewRefsProvider>
								<WidgetManagerProvider>
									<AppsProvider>
										<RouterProvider router={router} />
									</AppsProvider>
								</WidgetManagerProvider>
							</PreviewRefsProvider>
						</SpotlightProvider>
					</WindowManagerProvider>
				</ModalProvider>
			</WallpaperProvider>
		</PersistentStoreProvider>
	</ErrorBoundary>
)
