import React, { useState, useEffect } from "react";

export const NetworkWidget: React.FC = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [ping, setPing] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const connection = navigator.connection;

  useEffect(() => {
    const pingTest = async () => {
      const start = performance.now();
      try {
        await fetch("https://www.cloudflare.com/cdn-cgi/trace", { cache: "no-store" });
        const value = Math.round(performance.now() - start);
        setPing(value);
        setHistory(prev => [...prev.slice(-9), value]);
      } catch {
        setPing(null);
        setHistory(prev => [...prev.slice(-9), 0]);
      }
    };
    pingTest();
    const interval = setInterval(pingTest, 5000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white font-mono gap-1">
      <h2 className="font-bold mb-2">📡 Rete</h2>
      <p>Stato: {online ? "🟢 Online" : "🔴 Offline"}</p>
      <p>Ping: {ping !== null ? `${ping} ms` : "N/D"}</p>
      <p className="text-xs opacity-70">Tipo: {connection?.effectiveType ?? "N/D"} · {connection?.downlink ? `${connection.downlink} Mb/s` : "--"}</p>
      <div className="flex items-end gap-0.5 h-8 mt-1">
        {history.map((value, i) => (
          <div key={i} className="w-1 rounded-sm bg-cyan-300/70" style={{ height: `${Math.max(8, Math.min(32, value || 8))}px` }} />
        ))}
      </div>
    </div>
  );
};
