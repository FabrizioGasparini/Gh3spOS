import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/layouts/main'
import { NotFound } from '@/routes/not-found'
import { Settings } from '@/routes/settings'
import { RouteErrorBoundary } from '@/components/error-boundary'

export const router = createBrowserRouter([
	{
		path: '/*',
		element: <MainLayout />,
		errorElement: <RouteErrorBoundary />,
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
