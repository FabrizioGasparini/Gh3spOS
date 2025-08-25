import React, { useEffect, useState } from "react";

export const SystemInfoWidget: React.FC = () => {
  const [info, setInfo] = useState({
    platform: "",
    userAgent: "",
    memory: "",
    uptime: "",
  });

  useEffect(() => {
    const updateInfo = () => {
      setInfo({
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        memory: (navigator.deviceMemory ?? "N/A") + " GB",
        uptime: (performance.now() / 1000).toFixed(0) + "s",
      });
    };
    updateInfo();
    const interval = setInterval(updateInfo, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-sm font-mono w-full h-full text-white">
      <h2 className="font-bold mb-2">💻 Info Sistema</h2>
      <p>🖥 OS: {info.platform}</p>
      <p>🌐 Browser: {info.userAgent}</p>
      <p>💾 Memoria: {info.memory}</p>
      <p>⏳ Uptime: {info.uptime}</p>
    </div>
  );
};
