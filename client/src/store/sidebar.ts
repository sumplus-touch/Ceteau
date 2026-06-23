import { create } from "zustand";

interface SidebarState {
  open: boolean;
  setOpen(v: boolean): void;
  toggle(): void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set({ open: !get().open }),
}));
