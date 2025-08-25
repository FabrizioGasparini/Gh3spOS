import React from "react";
import { usePersistentStore } from "@/providers/persistent-store";

export const NotesWidget: React.FC = () => {
  const [notes, setNotes] = usePersistentStore<string>("widget:notes", "");

  return (
    <div className="w-full h-full flex flex-col font-mono">
      <h2 className="font-bold text-white mb-2">📝 Note Veloci</h2>
      <textarea
        className="flex-1 bg-transparent outline-none text-white resize-none"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Scrivi qualcosa..."
      />
    </div>
  );
};
