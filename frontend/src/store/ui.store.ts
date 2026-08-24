import { create } from 'zustand';

interface UiState {
  isAddExpenseOpen: boolean;
  isInviteOpen: boolean;
  editingExpenseId: string | null;
  setAddExpenseOpen: (open: boolean) => void;
  setInviteOpen: (open: boolean) => void;
  setEditingExpenseId: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isAddExpenseOpen: false,
  isInviteOpen: false,
  editingExpenseId: null,
  setAddExpenseOpen: (open) => set({ isAddExpenseOpen: open }),
  setInviteOpen: (open) => set({ isInviteOpen: open }),
  setEditingExpenseId: (id) => set({ editingExpenseId: id }),
}));
