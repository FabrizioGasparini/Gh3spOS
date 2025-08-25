import { Outlet } from 'react-router-dom'
import { Desktop } from './desktop'

export const MainLayout = () => {
  return (
    <>
      <Desktop />
      <Outlet />
    </>
  )
}