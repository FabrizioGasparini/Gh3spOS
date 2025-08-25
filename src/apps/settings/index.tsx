import { useState } from "react"
import { usePersistentStore } from "@/providers/persistent-store"

const sections = [
  { id: "appearance", label: "Aspetto" },
  { id: "windows", label: "Finestre" },
  { id: "notifications", label: "Notifiche" },
  { id: "system", label: "Sistema" },
]

export const Settings = ({windowId}: {windowId: string}) => {
  const [activeSection, setActiveSection] = useState("appearance")
  const [settings, setSettings] = usePersistentStore("gh3sp:settings", {
    theme: "dark",
    snapping: true,
    notifications: true,
  })

  const toggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const resetSettings = () => {
    setSettings({
      theme: "dark",
      snapping: true,
      notifications: true,
    })
  }

  return (
    <div className="flex h-full text-white font-sans backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="w-48 bg-white/10 border-r border-white/10 p-4 space-y-2">
        {sections.map((sec) => (
          <button
            key={sec.id}
            className={
              "w-full text-left px-3 py-2 rounded-md transition hover:bg-white/10 " +
              (activeSection === sec.id ? "bg-white/10 font-bold" : "")
            }
            onClick={() => setActiveSection(sec.id)}
          >
            {sec.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {activeSection === "appearance" && (
          <div>
            <h2 className="text-lg font-bold mb-4">🎨 Aspetto</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Tema</span>
                <button
                  className="bg-white/10 px-3 py-1 rounded-md"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      theme: prev.theme === "dark" ? "light" : "dark",
                    }))
                  }
                >
                  {settings.theme === "dark" ? "🌙 Scuro" : "☀️ Chiaro"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === "windows" && (
          <div>
            <h2 className="text-lg font-bold mb-4">🪟 Finestre</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Snapping abilitato</span>
                <input
                  type="checkbox"
                  checked={settings.snapping}
                  onChange={() => toggle("snapping")}
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === "notifications" && (
          <div>
            <h2 className="text-lg font-bold mb-4">🔔 Notifiche</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Mostra notifiche</span>
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={() => toggle("notifications")}
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === "system" && (
          <div>
            <h2 className="text-lg font-bold mb-4">🧠 Sistema</h2>
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Versione OS: <strong>Gh3spOS 1.0.0</strong>
              </p>
              <button
                onClick={resetSettings}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
              >
                Ripristina impostazioni
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}