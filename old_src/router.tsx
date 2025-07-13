import { Suspense } from 'react'
import { createBrowserRouter, Outlet } from 'react-router-dom'

import { DesktopLayout } from './layouts/Desktop'
import { BareLayout } from './layouts/BareLayout'
import { EnsureLoggedIn, EnsureLoggedOut } from './modules/auth'
import { Dock } from './modules/desktop/Dock'
import { Wallpaper } from './providers/Wallpaper'
import { AppsProvider } from './providers/AppsProvider'
import { AvailableAppsProvider } from './providers/AvailableAppsProvider'

import LoginPage from './routes/LoginPage'
import { NotFound } from './routes/NotFound' // creala pure come pagina semplice

export const router = createBrowserRouter([
    // Desktop
    {
        path: '/',
        element: (
            <EnsureLoggedIn>
                <Wallpaper />
                <AvailableAppsProvider>
                    <AppsProvider>
                        <DesktopLayout />
                        <Suspense fallback={<div>Loading...</div>}>
                            <Outlet />
                        </Suspense>
 
                        <Dock />
                    </AppsProvider>
                </AvailableAppsProvider>
            </EnsureLoggedIn>
    ),
    children: [
      // qui aggiungi sotto-pagine figlie del desktop
    ],
  },
  {
    path: '/',
    element: <BareLayout />,
    children: [
      {
        path: 'login',
        element: (
          <EnsureLoggedOut>
            <LoginPage />
          </EnsureLoggedOut>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
