import { create } from 'zustand'

export const useUiStore = create(set => ({
    exitModalOpen: false,
    logoutModalOpen: false,
    openExitModal: () => set({ exitModalOpen: true }),
    closeExitModal: () => set({ exitModalOpen: false }),
    openLogoutModal: () => set({ logoutModalOpen: true }),
    closeLogoutModal: () => set({ logoutModalOpen: false }),
}))
