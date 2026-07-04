import { create } from 'zustand'

export const useUiStore = create(set => ({
    exitModalOpen: false,
    exitModalSource: 'window',
    logoutModalOpen: false,
    openExitModal: (source = 'window') => set({ exitModalOpen: true, exitModalSource: source }),
    closeExitModal: () => set({ exitModalOpen: false }),
    openLogoutModal: () => set({ logoutModalOpen: true }),
    closeLogoutModal: () => set({ logoutModalOpen: false }),
}))
