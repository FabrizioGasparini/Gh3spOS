import { useState } from "react";

export const useConfirmation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [onConfirm, setOnConfirm] = useState<() => void>(() => () => {});

  const confirm = (callback: () => void) => {
    setOnConfirm(() => callback);
    setIsOpen(true);
  };

  const ConfirmDialog = () =>
    isOpen ? (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40">
        <div className="bg-white p-4 rounded shadow-md">
          <p>Sei sicuro?</p>
          <button onClick={() => { onConfirm(); setIsOpen(false); }}>Conferma</button>
          <button onClick={() => setIsOpen(false)}>Annulla</button>
        </div>
      </div>
    ) : null;

  return { confirm, ConfirmDialog };
};
