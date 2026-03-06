import {Dock} from "@/components/dock/index"
import { useWallpaper } from "@/providers/wallpaper";
import { WindowManager } from "@/modules/window/window-manager"
import Wallpaper from "@/components/wallpaper/wallpaper"
import { WidgetLayer } from "@/modules/widgets/widget-layer";
import Spotlight from "@/components/spotlight";
import { MenuBar } from "@/components/menu-bar";

const Desktop = () => {
  const { wallpaper } = useWallpaper();

    return (
      <div className="w-screen h-screen relative overflow-hidden bg-cover bg-transparent">
        <Wallpaper image={wallpaper} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45" />
        <MenuBar />
        <WindowManager />
        <WidgetLayer />
        <Dock />
        <Spotlight />
      </div>
    );
};
  
export {Desktop};
  