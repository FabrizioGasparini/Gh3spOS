import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentStore } from "@/providers/persistent-store";
import clsx from "clsx";

type Tab = {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  history: string[];
  historyIndex: number;
};

const HOME = "https://developer.mozilla.org/";
const SEARCH = (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

const isLikelyUrl = (input: string) => {
  try {
    // se già URL valido
    new URL(input);
    return true;
  } catch {
    // input tipo "example.com" -> considera come URL
    return /^[^\s]+\.[^\s]{2,}$/.test(input);
  }
};

const normalizeToUrl = (input: string) => {
  if (!input.trim()) return HOME;
  if (isLikelyUrl(input)) {
    try {
      const u = new URL(input.includes("://") ? input : `https://${input}`);
      return u.toString();
    } catch {
      return SEARCH(input);
    }
  }
  return SEARCH(input);
};

const domainFromUrl = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

const faviconFor = (u: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainFromUrl(u))}&sz=64`;

export const BrowserApp: React.FC<{ windowId: string }> = () => {
  const [tabs, setTabs] = usePersistentStore<Tab[]>("browser:tabs", [
    {
      id: crypto.randomUUID(),
      url: HOME,
      title: "Home",
      loading: true,
      history: [HOME],
      historyIndex: 0,
    },
  ]);

  const [active, setActive] = usePersistentStore<string>("browser:active", tabs[0]?.id ?? "");
  const [address, setAddress] = useState(tabs[0]?.url ?? HOME);

  const activeTab = useMemo(() => tabs.find(t => t.id === active) ?? tabs[0], [tabs, active]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Mantieni address sincronizzato con la tab attiva
  useEffect(() => {
    if (activeTab) setAddress(activeTab.url);
  }, [activeTab?.id]);

  // Se non c’è tab attiva (dopo chiusure), seleziona la prima
  useEffect(() => {
    if (!active && tabs[0]) setActive(tabs[0].id);
  }, [tabs.length]);

  const updateActiveTab = (patch: Partial<Tab>) => {
    setTabs(prev =>
      prev.map(t => (t.id === activeTab?.id ? { ...t, ...patch } : t))
    );
  };

  const navigate = (raw: string) => {
    const url = normalizeToUrl(raw);
    if (!activeTab) return;

    const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
    newHistory.push(url);

    setTabs(prev =>
      prev.map(t =>
        t.id === activeTab.id
          ? {
              ...t,
              url,
              title: domainFromUrl(url) || "New Tab",
              loading: true,
              history: newHistory,
              historyIndex: newHistory.length - 1,
            }
          : t
      )
    );
  };

  const goBack = () => {
    if (!activeTab) return;
    if (activeTab.historyIndex <= 0) return;
    const newIndex = activeTab.historyIndex - 1;
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTab.id
          ? {
              ...t,
              url: activeTab.history[newIndex],
              title: domainFromUrl(activeTab.history[newIndex]) || "Tab",
              loading: true,
              historyIndex: newIndex,
            }
          : t
      )
    );
  };

  const goForward = () => {
    if (!activeTab) return;
    if (activeTab.historyIndex >= activeTab.history.length - 1) return;
    const newIndex = activeTab.historyIndex + 1;
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTab.id
          ? {
              ...t,
              url: activeTab.history[newIndex],
              title: domainFromUrl(activeTab.history[newIndex]) || "Tab",
              loading: true,
              historyIndex: newIndex,
            }
          : t
      )
    );
  };

  const reload = () => {
    if (!activeTab) return;
    updateActiveTab({ loading: true });
    // forza reload cambiando key sull’iframe
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTab.id ? { ...t, url: activeTab.url } : t
      )
    );
  };

  const stop = () => {
    updateActiveTab({ loading: false });
    try {
      iframeRef.current?.contentWindow?.stop();
    } catch {
      /* noop */
    }
  };

  const newTab = (url = HOME) => {
    const id = crypto.randomUUID();
    const tab: Tab = {
      id,
      url,
      title: domainFromUrl(url) || "New Tab",
      loading: true,
      history: [url],
      historyIndex: 0,
    };
    setTabs(prev => [...prev, tab]);
    setActive(id);
    setAddress(url);
  };

  const closeTab = (id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      if (!next.length) {
        // sempre almeno una tab
        const fallback: Tab = {
          id: crypto.randomUUID(),
          url: HOME,
          title: "Home",
          loading: true,
          history: [HOME],
          historyIndex: 0,
        };
        setActive(fallback.id);
        return [fallback];
      }
      if (id === active) {
        const newActive = next[Math.max(0, idx - 1)].id;
        setActive(newActive);
      }
      return next;
    });
  };

  // Scorciatoie
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/Cmd + L -> barra indirizzi
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        (document.getElementById("browser-omnibox") as HTMLInputElement)?.focus();
        (document.getElementById("browser-omnibox") as HTMLInputElement)?.select();
      }
      // Ctrl/Cmd + T -> nuova tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        newTab();
      }
      // Ctrl/Cmd + W -> chiudi tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeTab) closeTab(activeTab.id);
      }
      // Ctrl/Cmd + R -> reload
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        reload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, active]);

  return (
    <div className="h-full w-full flex flex-col bg-white/10 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 px-2 py-1 bg-black/20 border-b border-white/10">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={clsx(
              "group flex items-center gap-2 px-3 py-1 rounded-lg text-sm",
              t.id === active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10"
            )}
            title={t.url}
          >
            <img className="h-4 w-4 rounded" src={faviconFor(t.url)} alt="" />
            <span className="max-w-[14rem] truncate">{t.title || domainFromUrl(t.url) || "Tab"}</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
              className="ml-2 opacity-0 group-hover:opacity-100 hover:text-red-300"
            >
              ×
            </span>
          </button>
        ))}

        <button
          onClick={() => newTab()}
          className="ml-1 px-2 rounded-lg text-white/80 hover:bg-white/10"
          title="Nuova scheda (Ctrl+T)"
        >
          +
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-black/10 border-b border-white/10">
        <button
          onClick={goBack}
          disabled={!activeTab || activeTab.historyIndex <= 0}
          className="px-2 py-1 rounded-md text-white/80 disabled:opacity-40 hover:bg-white/10"
          title="Indietro"
        >
          ←
        </button>
        <button
          onClick={goForward}
          disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1}
          className="px-2 py-1 rounded-md text-white/80 disabled:opacity-40 hover:bg-white/10"
          title="Avanti"
        >
          →
        </button>
        {!activeTab?.loading ? (
          <button onClick={reload} className="px-2 py-1 rounded-md text-white/80 hover:bg-white/10" title="Ricarica (Ctrl+R)">
            ⟳
          </button>
        ) : (
          <button onClick={stop} className="px-2 py-1 rounded-md text-white/80 hover:bg-white/10" title="Stop">
            ■
          </button>
        )}
        <button onClick={() => navigate(HOME)} className="px-2 py-1 rounded-md text-white/80 hover:bg-white/10" title="Home">
          ⌂
        </button>

        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(address);
          }}
        >
          <input
            id="browser-omnibox"
            className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/15 text-white placeholder:text-white/50 outline-none focus:ring-2 ring-white/20"
            placeholder="Cerca o inserisci URL…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </form>
      </div>

      {/* Contenuto */}
      <div className="flex-1 relative bg-black/20">
        {activeTab && (
          <iframe
            key={activeTab.id + "|" + activeTab.url} // forza refresh su reload
            ref={iframeRef}
            src={activeTab.url}
            className="absolute inset-0 w-full h-full"
            // Sandbox: consenti script e same-origin (necessario per molti siti); rimuovi permessi se vuoi più isolamento
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-pointer-lock allow-modals"
            onLoad={() => updateActiveTab({ loading: false, title: domainFromUrl(activeTab.url) || "Tab" })}
          />
        )}
        {!activeTab && (
          <div className="w-full h-full grid place-items-center text-white/60">
            Nessuna scheda
          </div>
        )}
      </div>
    </div>
  );
};
