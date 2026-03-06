import React from "react";
import { usePersistentStore } from "@/providers/persistent-store";

export const NotesWidget: React.FC = () => {
  const [title, setTitle] = usePersistentStore<string>("widget:notes:title", "Quick Note");
  const [notes, setNotes] = usePersistentStore<string>("widget:notes", "");

  const words = notes.trim() ? notes.trim().split(/\s+/).length : 0;

  return (
    <div className="w-full h-full flex flex-col font-mono">
      <input
        className="font-bold text-white mb-2 bg-transparent border-b border-white/20 outline-none"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titolo"
      />
      <textarea
        className="flex-1 bg-transparent outline-none text-white resize-none"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Scrivi qualcosa..."
      />
      <div className="text-[11px] text-white/60 pt-1">{words} parole · {notes.length} caratteri</div>
    </div>
  );
};
