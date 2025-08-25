import React, { useEffect, useRef, useState } from 'react'
import { useModal } from '@/providers/modal';
import type { FileItem, DriveItem } from '@/types';
import { HardDrive, LayoutGrid, LayoutList } from 'lucide-react';
import clsx from 'clsx';


type FilterState = {
  label: string
  value: boolean
}

type SelectParams = {
    fileExtensions?: string[]
    allow: "file" | "folder" | "disk"
    allowMultiple?: boolean
    allowRename?: boolean
    action?: string
}

type FilePickerProps = {
    onSelected: (file: FileItem | null, path: string) => void;
    selectParams: SelectParams;
};

const BASE_URL = "https://www.gh3sp.com/cloud/api";

export const FilePicker: React.FC<FilePickerProps> = ({ onSelected, selectParams }) => {
  const [items, setItems] = useState<FileItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  //const [drives, setDrives] = useState<DriveItem[]>([])
  const [columnWidths, setColumnWidths] = useState({
    name: 40,
    type: 20,
    modified: 25,
    size: 15,
  });

  const [root, setRoot] = useState<string>('cloud.gh3sp.com');
  const [path, setPath] = useState<string>('/');
  const [inputPath, setInputPath] = useState(path)

  const [filter, setFilter] = useState<FilterState>({ label: "Tipo", value: true })
  const [largeView, setLargeView] = useState<boolean>(false)

  const [draggedItem, setDraggedItem] = useState<FileItem | null>(null)
    const [hoveredPath, setHoveredPath] = useState<string | null>(null)
    
    const [renameValue, setRenameValue] = useState<string | null>(null)
    const [pickedItem, setPickedItem] = useState<FileItem | null>(null)

  const containerRef = useRef<HTMLDivElement>(null);
  const explorerRef = useRef<HTMLDivElement>(null)
  
  const { showModal } = useModal()

  // ===== Use Effects ===== \\
  useEffect(() => {
    fetchDrives()
  }, [])

  useEffect(() => {
    updatePath()
  }, [path, root])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // ===== Fetches ===== \\
  const fetchDrives = () => {
    return [{ name: "cloud.gh3sp.com", label: "Cloud Remoto", type: "remote", size: 0 } as DriveItem];
  }

  const fetchData = () => {
    setLoading(true);
    setError(null);

    // Fetch files from the server
    if (!root.startsWith("cloud.gh3sp.com")) {
      setError("Percorso non valido");
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/list2.php?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setError("Percorso non valido o nessun file trovato");
          setLoading(false);
          return;
        }

        const sorted = data.sort((a: FileItem, b: FileItem) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "folder" ? -1 : 1;
        });
        setItems(sorted);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  const updatePath = async () => {
    if (path === '/' && root === 'Drives') {
      const drives = await fetchDrives();
      setItems(drives.map((d) => ({ name: d.name, type: 'disk', diskLabel: d.label, diskType: d.type, size: d.size })));
    } else await fetchData();
    
    setInputPath(path);
  }

  // ===== Path Handling ===== \\
  const goUp = () => {
    const parts = path.split('/').filter(Boolean);
    const newPath = '/' + parts.slice(0, -1).join('/');
    updateTabPath(root, newPath || '/');
  };

  const enterFolder = (folder: string) => {
    const newPath = `${path}/${folder}`.replace(/\/+/g, '/');
    updateTabPath(root, newPath);
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateTabPath(root, inputPath.trim() || '/')
  }
  
    // ===== File Functions ===== \\
    const handleItemClick = (item: FileItem) => {
        setPickedItem(null)
        setRenameValue("")
        setSelectedItem(item)
        if (selectParams.allow === "file") {
            if (selectParams.fileExtensions && !selectParams.fileExtensions.includes(item.name.split('.').pop() || '')) return;
            setPickedItem(item)
            setRenameValue(item.name)
        } else if (selectParams.allow === "folder" && item.type === "folder") {
            setPickedItem(item)
            setRenameValue(item.name)
        } else if (selectParams.allow === "disk" && item.type === "disk") {
            setPickedItem(item)
            setRenameValue(item.name)
        }
    }
    const handleItemDoubleClick = (item: FileItem) => {
        if (item.type === 'folder') enterFolder(item.name)
        else if (item.type === 'disk') updateTabPath(item.name, "/")
        else setSelectedItem(item)
    }
    
    const handleSelect = (item: FileItem | null) => {
        setSelectedItem(item)

        if (selectParams.allowRename) {
            if (!renameValue) {
                setError("Nessun file selezionato")
                return
            }
            onSelected(null, path + '/' + renameValue)
            return
        }

        if (item == null) {
            if (!renameValue) setError("Nessun file selezionato")
            
            setError("Tipo di file non consentito")
            return
        }

        if (selectParams.allow === "file") {
            if (selectParams.fileExtensions && !selectParams.fileExtensions.includes(item.name.split('.').pop() || '')) {
                setError("Tipo di file non consentito")
                return;
            }
            onSelected(item, path + '/' + item.name)
        } else if (selectParams.allow === "folder" && item.type === "folder") {
            onSelected(item, path + '/' + item.name)
        } else if (selectParams.allow === "disk" && item.type === "disk") {
            onSelected(item, path + '/' + item.name)
        } else {
            setError("Tipo di file non consentito")
            return;
        }
    }


    const handleRename = async (item: FileItem) => {
        showModal({
            type: "confirm",
            title: "Rinomina file",
            defaultValue: item.name,
            onConfirm: async (newName?: string) => {
                if (!newName || newName === item.name) return;
                try {
                const oldPath = `${path.replace("cloud.gh3sp.com", "")}/${item.name}`;
                const newPath = `${path.replace("cloud.gh3sp.com", "")}/${newName}`;
                const res = await fetch(`${BASE_URL}/rename.php`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ oldPath, newPath }),
                });
                if (!res.ok) throw new Error("Rinomina fallita");
                showToast(`Rinominato in ${newName}`);
                updatePath();
                } catch (err) {
                showToast(`Errore: ${(err as Error).message}`);
                }
            },
        });
    }
    
    const handleDelete = async (item: FileItem) => {
        const confirmDelete = confirm(`Eliminare "${item.name}"?`);
        if (!confirmDelete) return;
        try {
        const targetPath = `${path.replace("cloud.gh3sp.com", "")}/${item.name}`;
        const res = await fetch(`${BASE_URL}/deleteFile.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: targetPath }),
        });
        if (!res.ok) throw new Error("Eliminazione fallita");
        showToast(`Eliminato ${item.name}`);
        updatePath();
        } catch (err) {
        showToast(`Errore: ${(err as Error).message}`);
        }
    }
    
    const handleCopy = async (item: FileItem) => {
        const destination = prompt("Copia in:", path)
        if (!destination) return
        try {
        const sourcePath = `${path}/${item.name}`
        const destinationPath = `${destination}/${item.name}`
        const res = await fetch("http://localhost:3001/copy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourcePath, destinationPath })
        })
        if (!res.ok) throw new Error("Copia fallita")
        showToast(`Copiato in ${destination}`)
        updatePath()
        } catch (err) {
        showToast(`Errore: ${(err as Error).message}`)
        }
    }
    
    const handleMove = async (item: FileItem) => {
        const destination = prompt("Sposta in:", path)
        if (!destination) return
        try {
        const sourcePath = `${path}/${item.name}`
        const destinationPath = `${destination}/${item.name}`
        const res = await fetch("http://localhost:3001/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourcePath, destinationPath })
        })
        if (!res.ok) throw new Error("Spostamento fallito")
        showToast(`Spostato in ${destination}`)
        updatePath()
        } catch (err) {
        showToast(`Errore: ${(err as Error).message}`)
        }
    }
    
    const handleProperties = async (item: FileItem) => {
        showModal({
        type: 'custom',
        title: 'Proprietà',
        customContent: <div className="text-white text-sm space-y-2">
        <div><strong>Nome:</strong> {item.name}</div>
        <div><strong>Tipo:</strong> {item.type === 'disk' ? item.diskType : getFileType(item)}</div>
        {item.size !== undefined && <div><strong>Dimensione:</strong> {formatSize(item.size) || "-"}</div>}
        {item.modifiedAt && <div><strong>Ultima modifica:</strong> {formatDate(item.modifiedAt)}</div>}
        {item.type === 'disk' && item.diskLabel && <div><strong>Etichetta disco:</strong> {item.diskLabel}</div>}
        </div>
        })
    }

    // ===== Tabs Functions ===== \\
    const updateTabPath = (newRoot: string, newPath: string) => {
        setRoot(newRoot);
        setPath(newPath);
    };

    // ===== Utils Functions ===== \\
    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    const formatSize = (bytes?: number): string => {
        if (bytes == null) return ''
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
        if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
        return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(1)} TB`
    }

    const formatDate = (iso?: string): string => {
        if (!iso) return ''
        const d = new Date(iso)
        const date = d.toLocaleString().replace(",", " •").split(":")
        date.pop()
        return date.join(":")
    }

    const getIcon = (item: FileItem) => {
        if (item.type === 'folder') return '📁'
        if (item.type === 'disk') {
        if(item.diskType == "system") return '💽'
        if (item.diskType == "removable") return '💾'
        if (item.diskType == "remote") return '🌐'
        return '💿'
    } 
  
    const ext = item.name.split('.').pop()?.toLowerCase() || ''
    switch (ext) {
      case 'txt': return '📄'
      case 'js': return '🟨'
      case 'ts': return '🔵'
      case 'json': return '🧾'
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'gif': return '🖼️'
      case 'mp3':
      case 'wav': return '🎵'
      case 'mp4':
      case 'avi': return '🎞️'
      case 'pdf': return '📕'
      case 'zip':
      case 'rar': return '🗜️'
      case 'exe': return '⚙️'
      default: return '📦'
    }
  }

  const getFileType = (item: FileItem) => {
    if (item.type === 'folder') return 'Cartella'
    const ext = item.name.split('.').pop()
    return ext ? `${ext}` : 'File'
  }

  const startResizing = (col: keyof typeof columnWidths, e: React.MouseEvent) => {
    e.preventDefault();
  
    const container = containerRef.current;
    if (!container) return;
  
    const startX = e.clientX;
    const containerWidth = container.offsetWidth;
  
    const startWidthPercent = columnWidths[col];
    const startWidthPx = (startWidthPercent / 100) * containerWidth;
  
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidthPx = startWidthPx + deltaX;
      let newWidthPercent = (newWidthPx / containerWidth) * 100;
  
      // Limiti minimi e massimi
      newWidthPercent = Math.max(5, newWidthPercent); // minimo 5%
  
      // Somma delle altre colonne
      const otherColsTotal = Object.entries(columnWidths)
        .filter(([key]) => key !== col)
        .reduce((acc, [, val]) => acc + val, 0);
  
      // Se la somma supererebbe 100%, limita
      const maxWidth = 100 - otherColsTotal;
      if (newWidthPercent > maxWidth) {
        newWidthPercent = maxWidth;
      }
  
      setColumnWidths((prev) => ({
        ...prev,
        [col]: newWidthPercent,
      }));
    };
  
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };
  
  const filteredItems = items
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a: FileItem, b: FileItem) => {
      switch (filter.label) {
        case "Nome":
          return filter.value ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
          
        case "Tipo":
          if (filter.value) {
            if (b.type === "disk" && a.type === "disk") {
              return (b.diskType ?? "").localeCompare(a.diskType ?? "");
            }
            return b.type.localeCompare(a.type);
          } else {
            if (a.type === "disk" && b.type === "disk") {
              return (a.diskType ?? "").localeCompare(b.diskType ?? "");
            }
            return a.type.localeCompare(b.type);
          }

        case "Ultima Modifica":
          return filter.value
            ? (b.modifiedAt ?? "").localeCompare(a.modifiedAt ?? "")
            : (a.modifiedAt ?? "").localeCompare(b.modifiedAt ?? "");
          
        case "Dimensione":
          if (a.size == null) return 1;
          if (b.size == null) return -1;
          return filter.value ? b.size - a.size : a.size - b.size;
          
        default:
          return 0;
      }
    })

   const renderBreadcrumb = () => {
      const parts = path.split('/').filter(Boolean)
      return (
        <div className="flex text-sm text-white/80 overflow-auto custom-scroll">
          <button  className={clsx(
                'hover:underline px-1 rounded transition',
                hoveredPath === root && 'bg-blue-500/30'
          )}
            onClick={() => updateTabPath(root, '/')}>{root}</button>
          <span className="mx-1">/</span>
          {parts.map((part, i) => {
            const subPath = parts.slice(0, i + 1).join('/')
            return (
              <>
              <button
              key={i}
              onClick={() => updateTabPath(root, "/" + subPath)}
              onDragOver={(e) => {
                e.preventDefault()
                setHoveredPath(subPath)
              }}
              onDragLeave={() => setHoveredPath(null)}
              onDrop={async () => {
                if (!draggedItem) return
            
                const sourcePath = `${path}/${draggedItem.name}`
                const destinationPath = `${subPath}/${draggedItem.name}`
            
                try {
                  const res = await fetch("http://localhost:3001/move", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sourcePath, destinationPath })
                  })
                  if (!res.ok) throw new Error("Errore nel trascinamento")
                  showToast(`Spostato ${draggedItem.name} in ${destinationPath}`)
                  updatePath()
                  setHoveredPath(null)
                } catch (err) {
                  showToast(`Errore: ${(err as Error).message}`)
                } finally {
                  setDraggedItem(null)
                }
              }}
              className={clsx(
                'hover:underline px-1 rounded transition',
                hoveredPath === subPath && 'bg-blue-500/30'
              )}
            >
                {i === 0 && path.includes(':') ? `${part}` : part}
              </button>
              {i < parts.length - 1 && <span className="mx-1">/</span>}
              </>
          
                )
          })}
        </div>
      )
    }

  return (
      <div className="flex flex-col h-full gap-2 text-white">
        {selectParams.allow && (
            <div className="flex items-center gap-2 -mt-2 p-2 bg-white/10 backdrop-blur-md rounded-full shadow-lg">
                <span className="text-sm text-white/80">Seleziona:</span>
                  <span className="text-sm text-white">{
                    selectParams.allow === "file" ? "File" :
                    selectParams.allow === "folder" ? "Cartella" :
                    selectParams.allow === "disk" ? "Disco" :
                    "Qualsiasi"
                  }</span>
                {selectParams.fileExtensions && selectParams.allow == "file" && (
                    <span className="text-sm text-white/60">({selectParams.fileExtensions.join(', ')})</span>
                )}
                {selectParams.allowMultiple && (
                    <span className="text-sm text-white/60">Selezione multipla abilitata</span>
                )}
            </div>
        )}
      <div className="flex w-full gap-2">
        <button
          className="h-full w-auto aspect-square text-white/80 hover:text-white bg-white/15 hover:bg-white/20 rounded-3xl shadow backdrop-blur transition flex items-center justify-center"
          onClick={() => { updateTabPath("Drives", "/")}}
        >
          <HardDrive size={18} />
        </button>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl px-6 py-3 flex items-center gap-4 shadow-lg w-full">
          <button onClick={goUp} disabled={path === "Drives"} className="text-white/70 hover:text-white disabled:opacity-30">←</button>
          <form onSubmit={handlePathSubmit} className="flex-1">
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              className="w-full bg-transparent outline-none border-b border-white/30 focus:border-white transition text-sm px-2"
            />
          </form>
          <button onClick={updatePath} className="text-white/70 hover:text-white">⟳</button>
        </div>
      </div>      
      {/* Main explorer */}
      <div ref={explorerRef} className="flex flex-col flex-1 p-2 rounded-xl relative shadow-lg bg-black/10 overflow-auto">

        {/* Breadcrumb e ricerca */}
        <div className="mt-2 mb-1 flex justify-between items-center gap-2">
          {renderBreadcrumb()}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Cerca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 px-3 py-1 rounded-md text-sm text-white/80 focus:outline-none"
            />
            <button className='bg-white/10 px-1 py-1 rounded-md' onClick={() => setLargeView(!largeView)}>{largeView ? <LayoutList /> : <LayoutGrid /> }</button>
          </div>
        </div>

        {/* File List */}
        <div
          className="flex-1 overflow-auto mt-1 rounded-xl p-2 bg-black/10 shadow-lg overflow-x-hidden custom-scroll animate-fadeIn">
          {loading && <div className="text-center text-gray-300 animate-pulse">Caricamento...</div>}
          {error && <div className="text-red-400 text-center">{error}</div>}
          {(!loading && !error && filteredItems.length === 0) && (
            <div className="text-center text-gray-400">Nessun file o cartella</div>
          )}

          <div className={`${largeView ? "flex justify-between" :"grid gap-2"} text-white/70 text-sm px-3 py-1 border-b border-white/10`} ref={containerRef} style={{ gridTemplateColumns: `${largeView ? 25 : columnWidths.name}% ${largeView ? 25 : columnWidths.type}% ${largeView ? 25 : columnWidths.modified}% ${largeView ? 25 : columnWidths.size}%` }}>
            {["Nome", "Tipo", "Ultima Modifica", "Dimensione"].map((label, i) => (
              <div key={label} className="relative flex items-center" onClick={(e) => {
                e.preventDefault()
                if(filter.label == label) setFilter({label: label, value: !filter.value})
                else setFilter({ label: label, value: false })
              }}>
                <span className={`overflow-hidden text-ellipsis whitespace-nowrap ${largeView && "text-center w-full"}`}>{label}</span>
                {i < 3 && (
                  !largeView && <div
                    onMouseDown={(e) => {
                      if (!largeView) startResizing(
                        i === 0 ? "name" : i === 1 ? "type" : "modified",
                        e
                      )
                    }}
                    className="absolute right-0 top-0 h-full w-2 -mr-1 cursor-col-resize hover:bg-white/30"
                  />
                )}
              </div>
            ))}
          </div>

      <div className={largeView ? "flex flex-wrap gap-4" : ""}>    
      {filteredItems.map((item) => (
        largeView 
        ? <div
          key={item.name}
          className={clsx(
            `${item.type == "disk" ? "flex-1 min-w-40" : "w-35"} p-2 rounded-lg cursor-pointer select-none flex flex-col items-center justify-start hover:bg-white/10 transition-all duration-150 relative ${selectedItem?.name === item.name ? "bg-white/20 hover:bg-white/25" : ""}`,
            hoveredPath === `${path}/${item.name}` && 'bg-blue-500/20 border border-blue-400'
          )}
          onClick={() => handleItemClick(item)}
          onDoubleClick={() => handleItemDoubleClick(item)}
          draggable
          onDragStart={() => setDraggedItem(item)}
          onDragOver={(e) => {
    if (item.type === "folder") {
      e.preventDefault()
      setHoveredPath(`${path}/${item.name}`)
            }
          }}
          onDragLeave={() => setHoveredPath(null)}
          onDrop={async () => {
            if (!draggedItem || draggedItem.name === item.name || item.type !== 'folder') return

            const sourcePath = `${path}/${draggedItem.name}`
            const destinationPath = `${path}/${item.name}/${draggedItem.name}`

            try {
              const res = await fetch("http://localhost:3001/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourcePath, destinationPath })
              })
              if (!res.ok) throw new Error("Errore nel trascinamento")
              showToast(`Spostato ${draggedItem.name} in ${item.name}`)
              updatePath()
              setHoveredPath(null)
            } catch (err) {
              showToast(`Errore: ${(err as Error).message}`)
            } finally {
              setDraggedItem(null)
            }
          }}
          >
        <div className="w-16 h-16 flex items-center justify-center text-4xl">
          {getIcon(item)}
        </div>
        <div className="mt-2 text-center text-sm text-white whitespace-nowrap overflow-hidden text-ellipsis w-full">
          {item.name}
        </div>
      </div>
      : <div
        key={item.name}
        style={{ gridTemplateColumns: `${columnWidths.name}% ${columnWidths.type}% ${columnWidths.modified}% ${columnWidths.size}%` }}
        className={clsx(
`grid items-center gap-2 px-3 py-2 rounded-md cursor-pointer select-none hover:bg-white/10 ${selectedItem?.name == item.name && "bg-white/20 hover:bg-white/25"}`,          hoveredPath === `${path}/${item.name}` && 'bg-blue-500/20 border border-blue-400'
        )}
        onClick={() => handleItemClick(item)}
        onDoubleClick={() => handleItemDoubleClick(item)}
        draggable
onDragStart={() => setDraggedItem(item)}
onDragOver={(e) => {
  if (item.type === "folder") {
    e.preventDefault()
    setHoveredPath(`${path}/${item.name}`)
  }
    }}
onDragLeave={() => setHoveredPath(null)}
onDrop={async () => {
  if (!draggedItem || draggedItem.name === item.name || item.type !== 'folder') return

  const sourcePath = `${path}/${draggedItem.name}`
  const destinationPath = `${path}/${item.name}/${draggedItem.name}`

  try {
    const res = await fetch("http://localhost:3001/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath, destinationPath })
    })
    if (!res.ok) throw new Error("Errore nel trascinamento")
    showToast(`Spostato ${draggedItem.name} in ${item.name}`)
    updatePath()
    setHoveredPath(null)
  } catch (err) {
    showToast(`Errore: ${(err as Error).message}`)
  } finally {
    setDraggedItem(null)
  }
}}
          >
        <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
          <span>{getIcon(item)}</span>
          <span className="overflow-hidden text-ellipsis">{item.name}</span>
        </div>
        <div className='font-light overflow-hidden text-ellipsis whitespace-nowrap'>{item.type === 'disk' ? item.diskType : getFileType(item)}</div>
        <div className='font-light overflow-hidden text-ellipsis whitespace-nowrap'>{formatDate(item.modifiedAt)}</div>
        <div className="font-light overflow-hidden text-ellipsis whitespace-nowrap">{item.type === 'file' || item.type === 'disk' ? formatSize(item.size) : '-'}</div>
      </div>
      ))}
      </div>
              </div>
              
              {<div className="flex mt-4 p-2 bg-white/10 backdrop-blur-md rounded-lg shadow-lg gap-4">
                
                <div className="flex justify-end w-full">
                        <input
                            type="text"
                            placeholder="Nuovo nome..."
                        className="bg-white/10 px-4 py-2 rounded-full w-full text-sm text-white/80 focus:outline-none"
                            value={renameValue || ""}
                            onInput={(e) => {if (selectParams.allowRename) setRenameValue((e.target as HTMLInputElement).value)}}
                        />
                    </div>

            
            
                <button
                    className="w-fit text-nowrap max-w-1/6 text-ellipsis bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full transition"
                    onClick={() => handleSelect(pickedItem || null)}
                    >
                    {selectParams.action || "Salva"}
                </button>

        </div>}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-md text-white shadow-lg animate-fadeIn">
          {toast}
        </div>
      )}
      </div>
      {/* Menu contestuale */}
      {contextMenu && (
          <ul
            className="absolute bg-white/5 backdrop-blur-md text-white border-1 border-white/25 text-sm rounded-md shadow-md z-50 py-1 animate-fadeIn"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <li className="px-4 py-2 hover:bg-white/20 cursor-pointer flex gap-2 items-center" onClick={() => handleRename(contextMenu.item!)}>
              ✏️ <span>Rinomina</span>
            </li>
            <li className="px-4 py-2 hover:bg-white/20 cursor-pointer flex gap-2 items-center" onClick={() => handleDelete(contextMenu.item!)}>
              🗑️ <span>Elimina</span>
            </li>
            <li className="px-4 py-2 hover:bg-white/20 cursor-pointer flex gap-2 items-center" onClick={() => handleCopy(contextMenu.item!)}>
              📄 <span>Copia</span>
            </li>
            <li className="px-4 py-2 hover:bg-white/20 cursor-pointer flex gap-2 items-center" onClick={() => handleMove(contextMenu.item!)}>
              ✂️ <span>Sposta</span>
            </li>
            <li className="px-4 py-2 hover:bg-white/20 cursor-pointer flex gap-2 items-center" onClick={() => handleProperties(contextMenu.item!)}>
              ℹ️ <span>Proprietà</span>
            </li>
          </ul>
      )}
    </div>
  )
}
