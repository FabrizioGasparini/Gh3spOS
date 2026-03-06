import React, { useState, useEffect } from "react";

export const BatteryWidget: React.FC = () => {
  const [battery, setBattery] = useState({ level: 1, charging: false, supported: true });

  useEffect(() => {
    if (!navigator.getBattery) {
      setBattery((prev) => ({ ...prev, supported: false }));
      return;
    }

    navigator.getBattery().then((batt) => {
      const update = () => setBattery({ level: batt.level, charging: batt.charging, supported: true });
      batt.addEventListener("levelchange", update);
      batt.addEventListener("chargingchange", update);
      update();
    });
  }, []);

  const levelPercent = Math.round(battery.level * 100);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white font-mono">
      <h2 className="font-bold mb-2">🔋 Batteria</h2>
      {!battery.supported ? (
        <p className="text-xs opacity-70">API batteria non supportata</p>
      ) : (
        <>
          <div className="w-28 h-3 rounded-full bg-white/20 overflow-hidden mb-2">
            <div
              className={`h-full ${levelPercent < 20 ? "bg-red-400" : levelPercent < 50 ? "bg-yellow-300" : "bg-green-400"}`}
              style={{ width: `${levelPercent}%` }}
            />
          </div>
          <p>Livello: {levelPercent}%</p>
          <p>{battery.charging ? "⚡ In carica" : "🔌 Non in carica"}</p>
        </>
      )}
    </div>
  );
};
