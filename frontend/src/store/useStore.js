import { create } from 'zustand';

/**
 * UI preferences only. Domain data lives in domain stores (see data-model).
 */
const useStore = create((set, get) => ({
  darkMode: typeof localStorage !== 'undefined' && localStorage.getItem('darkMode') === 'true',

  toggleDarkMode: () => {
    const newMode = !get().darkMode;
    localStorage.setItem('darkMode', String(newMode));
    set({ darkMode: newMode });
  },
}));

export default useStore;
