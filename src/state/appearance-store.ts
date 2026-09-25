import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';
import { createAppearanceStore } from '@/features/appearance/store';

export const appearanceStore = createAppearanceStore(AsyncStorage);
export function useAppearance() {
  return useStore(appearanceStore);
}

export function useAppearanceMode() {
  return useStore(appearanceStore, (state) => state.mode);
}
