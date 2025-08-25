import React, { useState, useEffect } from "react";

export const NetworkWidget: React.FC = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [ping, setPing] = useState<number | null>(null);

  useEffect(() => {
    const pingTest = async () => {
      const start = performance.now();
      try {
        await fetch("https://www.google.com/favicon.ico", { mode: "no-cors" });
        setPing(Math.round(performance.now() - start));
      } catch {
        setPing(null);
      }
    };
    pingTest();
    const interval = setInterval(pingTest, 5000);
    window.addEventListener("online", () => setOnline(true));
    window.addEventListener("offline", () => setOnline(false));
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white font-mono">
      <h2 className="font-bold mb-2">📡 Rete</h2>
      <p>Stato: {online ? "🟢 Online" : "🔴 Offline"}</p>
      <p>Ping: {ping !== null ? `${ping} ms` : "N/D"}</p>
    </div>
  );
};
