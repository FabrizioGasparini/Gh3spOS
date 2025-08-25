import { createContext, useContext, useState } from "react";

type SpotlightContextType = {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    query: string;
    setQuery: (value: string) => void;
}

const SpotlightContext = createContext<SpotlightContextType | undefined>(undefined);

export function SpotlightProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const open = () => setIsOpen(true);
  const close = () => {
    setIsOpen(false);
    setQuery("");
  };
  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <SpotlightContext.Provider value={{ isOpen, open, close, toggle, query, setQuery }}>
      {children}
    </SpotlightContext.Provider>
  );
}

export function useSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context) throw new Error("useSpotlight must be used within SpotlightProvider");
  return context;
}
