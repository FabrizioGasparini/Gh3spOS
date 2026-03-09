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
import { NotificationsProvider } from '@/providers/notifications'
import { AuthProvider } from '@/providers/auth'
import { EnsureLoggedIn } from '@/modules/auth/ensure-logged-in'
import { EnsureUserExists } from '@/modules/auth/ensure-user-exists'
import { GlobalPickerProvider } from '@/providers/global-picker'
import { ThemeEngineProvider } from '@/providers/theme-engine'

init(
	<ErrorBoundary>
		<PersistentStoreProvider>
			<AuthProvider>
				<ThemeEngineProvider>
				<EnsureUserExists>
					<EnsureLoggedIn>
						<AppsProvider>
							<WallpaperProvider>	
								<NotificationsProvider>
									<ModalProvider>
										<WindowManagerProvider>
											<GlobalPickerProvider>
												<SpotlightProvider>
													<PreviewRefsProvider>
														<WidgetManagerProvider>
															<RouterProvider router={router} future={{ v7_startTransition: true }} />
														</WidgetManagerProvider>
													</PreviewRefsProvider>
												</SpotlightProvider>
											</GlobalPickerProvider>
										</WindowManagerProvider>
									</ModalProvider>
								</NotificationsProvider>
							</WallpaperProvider>
						</AppsProvider>
					</EnsureLoggedIn>
				</EnsureUserExists>
				</ThemeEngineProvider>
			</AuthProvider>
		</PersistentStoreProvider>
	</ErrorBoundary>
)
