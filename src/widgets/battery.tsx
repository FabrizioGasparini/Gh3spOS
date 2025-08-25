import React, { useState, useEffect } from "react";

export const BatteryWidget: React.FC = () => {
  const [battery, setBattery] = useState({ level: 1, charging: false });

  useEffect(() => {
    navigator.getBattery?.().then((batt) => {
      const update = () => setBattery({ level: batt.level, charging: batt.charging });
      batt.addEventListener("levelchange", update);
      batt.addEventListener("chargingchange", update);
      update();
    });
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white font-mono">
      <h2 className="font-bold mb-2">🔋 Batteria</h2>
      <p>Livello: {(battery.level * 100).toFixed(0)}%</p>
      <p>{battery.charging ? "⚡ In carica" : "🔌 Non in carica"}</p>
    </div>
  );
};
