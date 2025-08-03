import { FilePicker } from "@/components/file-picker";
import { useModal } from "@/providers/modal";
import { useWindowManager } from "@/providers/window-manager";
import type { FileItem } from "@/types";
import { useState } from "react";
import { FileText, FileCode } from "lucide-react";

export const NotePad = ({ windowId, filePath, fileContent, onSaveSuccess }: Props) => {
  const [tabs, setTabs] = useState<{ path: string; name: string; content: string }[]>([
    { path: filePath || "", name: filePath?.split("/").pop() || "Nuovo", content: fileContent || "" }
  ]);
  const [activeTab, setActiveTab] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const { showModal, hideModal } = useModal();
  const { renameWindow } = useWindowManager();

  const BASE_URL = "https://www.gh3sp.com/cloud/api";

  const handleSave = async () => {
    const current = tabs[activeTab];
    if (!current.path) return;
    await saveFile(current.path);
  };

  const handleOpen = async () => {
    showModal({
      title: "Apri file",
      type: "custom",
      customContent: (
        <FilePicker
          onSelected={async (file: FileItem | null, path: string) => {
            if (file) {
              const res = await fetch(`${BASE_URL}/read.php?path=${path.replace("cloud.gh3sp.com", "")}`);
              if (!res.ok) return showToast("Errore nel caricamento del file");
              const data = await res.json();
              const newTab = {
                path,
                name: file.name,
                content: data.content || "",
              };
              setTabs((prev) => [...prev, newTab]);
              setActiveTab(tabs.length);
              renameWindow(windowId, `${file.name} - Notepad`);
              onSaveSuccess?.(path);
            }
            hideModal();
          }}
          selectParams={{ allow: "file", fileExtensions: ["txt", "md"], allowRename: false, action: "Apri" }}
        />
      ),
      size: { width: 80, height: 70 },
    });
  };

  const handleNewTab = () => {
    setTabs(prev => [...prev, { path: "", name: "Nuovo", content: "" }]);
    setActiveTab(tabs.length);
  };

  const handleSaveAs = async () => {
    showModal({
      title: "Salva con nome",
      type: "custom",
      customContent: (
        <FilePicker
          onSelected={async (_file: FileItem | null, path: string) => {
            if (path) {
              await saveFile(path.replace("cloud.gh3sp.com", ""));
              hideModal();
            }
          }}
          selectParams={{ allow: "file", fileExtensions: ["txt", "md"], allowRename: true, action: "Salva" }}
        />
      ),
      size: { width: 80, height: 70 },
    });
  };

  const saveFile = async (path: string) => {
    try {
      const content = tabs[activeTab].content;
      const res = await fetch(`${BASE_URL}/saveFile.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) throw new Error("Errore nel salvataggio");
      setTabs((prev) => prev.map((t, i) => i === activeTab ? { ...t, path } : t));
      showToast(`File salvato: ${path}`);
      onSaveSuccess?.(path);
    } catch (err) {
      showToast(`Errore: ${(err as Error).message}`);
    }
  };

  const closeTab = (index: number) => {
    setTabs((prev) => {
      const newTabs = prev.filter((_, i) => i !== index);
      setActiveTab((prevActive) => (index === prevActive ? 0 : prevActive > index ? prevActive - 1 : prevActive));
      return newTabs.length ? newTabs : [{ path: "", name: "Nuovo", content: "" }];
    });
  };

  const updateTabContent = (value: string) => {
    setTabs((prev) => prev.map((tab, i) => i === activeTab ? { ...tab, content: value } : tab));
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop();
    switch (ext) {
      case "md": return <FileCode className="w-4 h-4" />;
      case "txt":
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black/10 rounded-lg overflow-hidden text-white shadow-xl relative">
      <div className="flex items-center gap-2 px-4 py-2 bg-black/20 border-b border-white/10 ">
        <button onClick={handleOpen} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-3 py-1 rounded-md">Apri</button>
        <button onClick={handleSave} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-3 py-1 rounded-md">Salva</button>
        <button onClick={handleSaveAs} className="bg-green-500 hover:bg-green-600 text-white font-semibold px-3 py-1 rounded-md">Salva con nome</button>
        <button onClick={handleNewTab} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-md">+ Nuova Tab</button>
      </div>

      <div className="flex gap-1 px-2 py-1 bg-black/10 border-b rounded-full m-1 border-white/10 overflow-x-auto hide-scrollbar">
        {tabs.map((tab, i) => (
          <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-full ${i === activeTab ? 'bg-black/50' : 'bg-black/20 hover:bg-black/30'} text-xs font-mono cursor-pointer`}>
            <span onClick={() => setActiveTab(i)} className="flex items-center gap-1">
              {getFileIcon(tab.name)} {tab.name || "Senza nome"}
            </span>
            {tabs.length > 1 && (
              <button
                onClick={() => closeTab(i)}
                className="ml-1 text-white/50 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <textarea
        value={tabs[activeTab]?.content || ""}
        onChange={(e) => updateTabContent(e.target.value)}
        className="flex-1 w-full bg-transparent text-white p-4 font-mono text-sm outline-none resize-none placeholder:text-white/30"
        placeholder="Scrivi qui il tuo testo..."
        spellCheck={false}
      />

      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded shadow-lg animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
};

type Props = {
  windowId: string;
  filePath?: string;
  fileContent?: string;
  onSaveSuccess?: (newPath: string) => void;
};
