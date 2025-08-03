import {Dock} from "@/components/dock/index"
import { useWallpaper } from "@/providers/wallpaper";
import { useWindowManager } from "@/providers/window-manager";
import { useEffect } from "react";
import { WindowManager } from "@/modules/window/window-manager"
import Wallpaper from "@/components/wallpaper/wallpaper"
import { apps } from "@/apps/definitions";
import { WidgetLayer } from "@/modules/widgets/widget-layer";

const Desktop = () => {
  const { wallpaper } = useWallpaper();
  const { openWindow } = useWindowManager()
  
  useEffect(() => {
    openWindow(apps.get("file-explorer")!, "file-explorer")
  }, [])

  return (
    <div className="w-screen h-screen relative bg-cover bg-transparent">
      <Wallpaper image={wallpaper} />
      {/* <WallpaperHeader /> */}
      <WindowManager />
      <WidgetLayer />
      <Dock />
    </div>
  );
};
  
export {Desktop};
  