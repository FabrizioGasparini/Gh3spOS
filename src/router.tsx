import { createBrowserRouter, Outlet } from 'react-router-dom'
import { Desktop } from './layouts/desktop'
import { WallpaperProvider } from './providers/wallpaper'
import { NotFound } from './routes/not-found'
import { Settings } from './routes/settings'
import { Login } from './routes/login'

export const router = createBrowserRouter([
	{
		path: '/',
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
		path: '/login',
		element: <Login />,
	},
	{
		path: '*',
		element: <NotFound />,
	},
])
