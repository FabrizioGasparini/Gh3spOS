import { createBrowserRouter, Outlet } from 'react-router-dom'
import { Desktop } from './layouts/desktop'
import { WallpaperProvider } from './providers/wallpaper'
import { NotFound } from './routes/not-found'
import { Settings } from './routes/settings'

export const router = createBrowserRouter([
	{
		path: '/*',
		element: (
			<WallpaperProvider>
				<Desktop />
				<Outlet />
			</WallpaperProvider>
		),
		children: [
			{
				path: 'settings',
				element: <Settings />,
			},
		],
	},
	{
		path: '*',
		element: <NotFound />,
	},
])
