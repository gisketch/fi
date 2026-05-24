import { registerSW } from 'virtual:pwa-register';

export type PwaUpdateState = {
  updateAvailable: boolean;
  offlineReady: boolean;
  checking: boolean;
  message: string | null;
};

const defaultState: PwaUpdateState = {
  updateAvailable: false,
  offlineReady: false,
  checking: false,
  message: null,
};

const listeners = new Set<(state: PwaUpdateState) => void>();
let state = defaultState;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;
let initialized = false;

const emit = (patch: Partial<PwaUpdateState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
};

export const subscribePwaUpdates = (listener: (state: PwaUpdateState) => void) => {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
};

export const initPwaUpdates = () => {
  if (initialized || !('serviceWorker' in navigator)) return;
  initialized = true;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      emit({
        updateAvailable: true,
        checking: false,
        message: 'Update ready',
      });
    },
    onOfflineReady() {
      emit({
        offlineReady: true,
        message: 'Fi is ready offline',
      });
    },
    onRegisteredSW(_swUrl, swRegistration) {
      registration = swRegistration || null;
    },
    onRegisterError(error) {
      emit({
        checking: false,
        message: error instanceof Error ? error.message : 'Update check failed',
      });
    },
  });
};

export const checkForPwaUpdate = async () => {
  emit({ checking: true, message: 'Checking for update...' });

  try {
    const activeRegistration = registration || await navigator.serviceWorker.getRegistration();
    if (!activeRegistration) {
      emit({ checking: false, message: 'No installed app worker yet' });
      return;
    }

    registration = activeRegistration;
    await activeRegistration.update();
    window.setTimeout(() => {
      emit((state.updateAvailable)
        ? { checking: false }
        : { checking: false, message: 'Fi is current' });
    }, 600);
  } catch (error) {
    emit({
      checking: false,
      message: error instanceof Error ? error.message : 'Update check failed',
    });
  }
};

export const applyPwaUpdate = async () => {
  if (updateServiceWorker) {
    await updateServiceWorker(true);
    return;
  }

  window.location.reload();
};
