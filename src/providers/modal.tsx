import { createContext, useContext, useState } from 'react'
import type { ReactNode, ReactElement } from 'react'

// Tipi per il contesto
export type ModalType = 'confirm' | 'custom'

interface ModalData {
  type: ModalType
  title?: string
  message?: string
  defaultValue?: string
  customContent?: ReactElement
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: (value?: string) => void
  onCancel?: () => void
}

interface ModalContextType {
  showModal: (data: ModalData) => void
  hideModal: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

export const useModal = () => {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within a ModalProvider')
  return ctx
}

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modal, setModal] = useState<ModalData | null>(null)

  const showModal = (data: ModalData) => setModal(data)
  const hideModal = () => {
    modal?.onCancel?.()
    setModal(null)
  }

  const handleConfirm = () => {
    const input = document.getElementById('modalInput') as HTMLInputElement
    modal?.onConfirm?.(input?.value || '')
    setModal(null)
  }

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999]">
          <div className="bg-white/10 border border-white/30 backdrop-blur-md p-6 rounded-xl w-full max-w-md shadow-xl">
            {modal.title && <h2 className="text-lg font-semibold text-white mb-4">{modal.title}</h2>}

            {modal.type === 'confirm' && (
              <>
                {modal.message && <p className="text-white text-sm mb-4">{modal.message}</p>}
                {modal.defaultValue !== undefined && (
                  <input
                    type="text"
                    defaultValue={modal.defaultValue}
                    className="w-full p-2 rounded bg-white/10 text-white placeholder-white/40 outline-none border border-white/20 mb-4"
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    autoFocus
                    id='modalInput'
                  />
                )}
              </>
            )}

            {modal.type === 'custom' && modal.customContent}

            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-4 py-1 rounded bg-white/20 hover:bg-white/30 text-white"
                onClick={hideModal}
              >
                {modal.cancelLabel || 'Annulla'}
              </button>
              {modal.onConfirm && (
                <button
                  className="px-4 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={handleConfirm}
                >
                  {modal.confirmLabel || 'Conferma'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}