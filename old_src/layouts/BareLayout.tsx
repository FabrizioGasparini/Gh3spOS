import { Outlet } from 'react-router-dom'

const BareLayout = () => {
  return (
    <div>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export {BareLayout}
