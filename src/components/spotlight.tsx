import { apps } from "@/apps/definitions";
import { useSpotlight } from "@/providers/spotlight";
import { useWindowManager } from "@/providers/window-manager";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function Spotlight() {
    const { isOpen, close, query, setQuery, toggle } = useSpotlight();
    const { openWindow } = useWindowManager()
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.code === "Space") {
                e.preventDefault();
                toggle();
            }

            if(e.code === "Escape") close()
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    if (!isOpen) return null;

    const filteredApps = [...apps.entries()].filter(([, app]) =>
        !app.ghost && app.name.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center p-4" onClick={close}>
            <motion.div className="mt-20 bg-white/10 backdrop-blur-xl rounded-2xl w-full max-w-xl p-6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                <input
                    className="w-full bg-white/10 px-4 py-2 rounded-full text-white text-xl outline-none"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                    placeholder="Cerca app, impostazioni, file..."
                />
                <ul className="mt-4 space-y-2">
                {filteredApps.map(([id, app]) => (
                    <li
                        key={id}
                        onClick={() => {
                            openWindow(app, id)
                            close();
                        }}
                        className="cursor-pointer p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center gap-2"
                        >
                        {typeof app.icon === 'string' ? (
                        <img
                            src={`/apps/${app.icon}`}
                            alt={app.name}
                            className="w-6 h-6 select-none"
                            draggable={false}
                        />
                        ) : (
                        apps.get(id)?.icon
                        )}
                        <span>{app.name}</span>
                    </li>
                ))}
                </ul>
            </motion.div>
        </div>
    );
}
