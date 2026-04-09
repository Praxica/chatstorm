import { create } from 'zustand';
import { useConfigsStore } from './configsStore';
import { useChatsStore } from './chatsStore';

export type DashboardView = 'designs' | 'chats' | 'templates' | 'spaces' | 'tokens';

interface DashboardStore {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  getRecentDesigns: () => any[];
  getRecentChats: () => any[];
}

export const useDashboardStore = create<DashboardStore>((set, _get) => ({
  activeView: 'designs',
  setActiveView: (view) => set({ activeView: view }),
  getRecentDesigns: () => {
    const configs = useConfigsStore.getState().configs;
    return configs.slice(0, 3);
  },
  getRecentChats: () => {
    const chats = useChatsStore.getState().chats;
    return chats.slice(0, 3);
  }
})); 