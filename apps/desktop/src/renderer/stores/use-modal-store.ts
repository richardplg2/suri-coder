import { create } from 'zustand'

interface ModalStore {
  activeModal: string | null
  modalData: Record<string, unknown> | null
  open: (modal: string, data?: Record<string, unknown>) => void
  close: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  activeModal: null,
  modalData: null,
  open: (modal, data) => set({ activeModal: modal, modalData: data ?? null }),
  close: () => set({ activeModal: null, modalData: null }),
}))
