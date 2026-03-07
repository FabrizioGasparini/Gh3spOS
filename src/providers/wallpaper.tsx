import { createContext, useContext } from 'react';
import { usePersistentStore } from './persistent-store';
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings } from '@/config/system-settings';

type WallpaperContextType = {
  wallpaper: string;
  setWallpaper: (url: string) => void;
};

const WallpaperContext = createContext<WallpaperContextType | undefined>(undefined);

export const WallpaperProvider = ({ children }: { children: React.ReactNode }) => {
  const [storedSettings, setStoredSettings] = usePersistentStore('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS);
  const settings = resolveDesktopSettings(storedSettings);

  const setWallpaper = (url: string) => {
    setStoredSettings((prev) => ({ ...resolveDesktopSettings(prev), wallpaper: url }));
  };

  return (
    <WallpaperContext.Provider value={{ wallpaper: settings.wallpaper, setWallpaper }}>
      {children}
    </WallpaperContext.Provider>
  );
};

export const useWallpaper = () => {
  const context = useContext(WallpaperContext);
  if (!context) throw new Error('useWallpaper must be used within a WallpaperProvider');
  return context;
};
