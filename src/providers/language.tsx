import { createContext, useContext, useState } from "react";

const LanguageContext = createContext<{
  language: string;
  setLanguage: (lang: string) => void;
}>({
  language: "it",
  setLanguage: () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState("it");

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
