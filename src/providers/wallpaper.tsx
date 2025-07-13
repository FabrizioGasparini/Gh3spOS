import { createContext, useContext, useState } from 'react';

type WallpaperContextType = {
  wallpaper: string;
  setWallpaper: (url: string) => void;
};

const WallpaperContext = createContext<WallpaperContextType | undefined>(undefined);

export const WallpaperProvider = ({ children }: { children: React.ReactNode }) => {
  const [wallpaper, setWallpaper] = useState<string>('/wallpapers/default.jpg');

  return (
    <WallpaperContext.Provider value={{ wallpaper, setWallpaper }}>
      {children}
    </WallpaperContext.Provider>
  );
};

export const useWallpaper = () => {
  const context = useContext(WallpaperContext);
  if (!context) throw new Error('useWallpaper must be used within a WallpaperProvider');
  return context;
};
