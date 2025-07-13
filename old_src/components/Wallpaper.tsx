import React from 'react'

const wallpaperStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  backgroundImage: 'url(/path/to/your/wallpaper.jpg)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  position: 'fixed',
  top: 0,
  left: 0,
  zIndex: -1,
}

const Wallpaper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div style={wallpaperStyle}>
      {children}
    </div>
  )
}

export default Wallpaper
