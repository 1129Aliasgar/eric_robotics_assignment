import { create } from 'zustand';

export type PrimaryView = 'map' | 'camera';
export type DrawerId = 'locations' | 'activity' | 'profile';
export type ModalId = 'quick-goal' | 'estop-reset';
export type NavId = 'overview' | 'map' | 'locations' | 'scan' | 'route' | 'activity' | 'profile';

type UiState = {
  primaryView: PrimaryView;
  drawer: DrawerId | null;
  modal: ModalId | null;
  mapZoom: number;
  cameraZoom: number;
  scanEnabled: boolean;
  routeVisible: boolean;
  resetMapNonce: number;
  setPrimaryView: (view: PrimaryView) => void;
  togglePrimaryView: () => void;
  setDrawer: (drawer: DrawerId | null) => void;
  openModal: (modal: ModalId) => void;
  closeModal: () => void;
  setMapZoom: (zoom: number) => void;
  setCameraZoom: (zoom: number) => void;
  toggleScan: () => void;
  toggleRoute: () => void;
  resetMap: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  primaryView: 'map',
  drawer: null,
  modal: null,
  mapZoom: 1,
  cameraZoom: 1,
  scanEnabled: false,
  routeVisible: false,
  resetMapNonce: 0,
  setPrimaryView: (primaryView) => set({ primaryView }),
  togglePrimaryView: () =>
    set((state) => ({ primaryView: state.primaryView === 'map' ? 'camera' : 'map' })),
  setDrawer: (drawer) => set({ drawer }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  setMapZoom: (mapZoom) => set({ mapZoom: Math.min(3.2, Math.max(0.55, mapZoom)) }),
  setCameraZoom: (cameraZoom) => set({ cameraZoom: Math.min(2.4, Math.max(1, cameraZoom)) }),
  toggleScan: () => set((state) => ({ scanEnabled: !state.scanEnabled })),
  toggleRoute: () => set((state) => ({ routeVisible: !state.routeVisible })),
  resetMap: () =>
    set((state) => ({
      primaryView: 'map',
      drawer: null,
      mapZoom: 1,
      cameraZoom: 1,
      resetMapNonce: state.resetMapNonce + 1,
    })),
}));
