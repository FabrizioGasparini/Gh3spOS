const Dock = () => {
  return (
    <div style={{
      height: '60px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '15px',
      userSelect: 'none',
    }}>
      {/* Qui puoi mettere le icone delle app */}
      <button>🏠 Home</button>
      <button>🗂️ File</button>
      <button>⚙️ Settings</button>
    </div>
  )
}

export default Dock
