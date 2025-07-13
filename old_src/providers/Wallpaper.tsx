import React from 'react'

export const Wallpaper = ({ children }: { children?: React.ReactNode }) => {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            zIndex: -1
        }}>
            {children}
        </div>
    )
}