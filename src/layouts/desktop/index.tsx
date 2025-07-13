import {Dock} from "@/components/dock/index"
import { useWallpaper } from "@/providers/wallpaper";
import { useWindowManager } from "@/providers/window-manager";
import { useEffect } from "react";
import { WindowManager } from "@/modules/window/window-manager"
import WallpaperHeader from "@/components/wallpaper-header"
import { apps } from "@/apps/apps";

const Desktop = () => {
  const { wallpaper } = useWallpaper();
  const { openWindow } = useWindowManager()
  
  useEffect(() => {
    const id = "file-explorer"
    openWindow(apps.get(id)!, id)
  }, [])

  return (
    <div className="w-screen h-screen relative bg-cover"
      style={{
        backgroundImage: `url(${wallpaper})`
      }}
    >
      <WallpaperHeader />
      <WindowManager />
      <Dock />
    </div>
  );
};
  
export {Desktop};
  