import {Dock} from "@/components/dock/index"
import { useWallpaper } from "@/providers/wallpaper";
import { WindowManager } from "@/modules/window/window-manager"
import Wallpaper from "@/components/wallpaper/wallpaper"
import { WidgetLayer } from "@/modules/widgets/widget-layer";
import Spotlight from "@/components/spotlight";

const Desktop = () => {
  const { wallpaper } = useWallpaper();

    return (
      <div className="w-screen h-screen relative bg-cover bg-transparent">
        <Wallpaper image={wallpaper} />
        <WindowManager />
        <WidgetLayer />
        <Dock />
        <Spotlight />
      </div>
    );
};
  
export {Desktop};
  