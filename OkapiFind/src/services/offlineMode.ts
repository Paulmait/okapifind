import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Only import NetInfo on native platforms
let NetInfo: any = null;
if (Platform.OS !== 'web') {
  try {
    NetInfo = require('@react-native-community/netinfo').default;
  } catch {
    console.warn('NetInfo module not available');
  }
}

interface OfflineAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

class OfflineModeService {
  private isOnline: boolean = true;
  private pendingActions: OfflineAction[] = [];
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Monitor network state
    if (Platform.OS === 'web') {
      // Use browser's navigator.onLine for web
      this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          this.isOnline = true;
          this.notifyListeners();
          this.syncPendingActions();
        });

        window.addEventListener('offline', () => {
          this.isOnline = false;
          this.notifyListeners();
        });
      }
    } else if (NetInfo) {
      // Use NetInfo for native platforms
      NetInfo.addEventListener((state: any) => {
        this.isOnline = state.isConnected ?? false;
        this.notifyListeners();

        if (this.isOnline) {
          this.syncPendingActions();
        }
      });
    }

    // Load pending actions
    await this.loadPendingActions();
  }

  public getNetworkState(): boolean {
    return this.isOnline;
  }

  public addListener(callback: (isOnline: boolean) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.isOnline));
  }

  public async queueAction(type: string, data: any): Promise<void> {
    const action: OfflineAction = {
      id: Date.now().toString(),
      type,
      data,
      timestamp: Date.now(),
    };

    this.pendingActions.push(action);
    await this.savePendingActions();
  }

  private async syncPendingActions() {
    if (this.pendingActions.length === 0) return;

    console.log(`Syncing ${this.pendingActions.length} offline actions`);

    // Process actions (implement your sync logic)
    this.pendingActions = [];
    await this.savePendingActions();
  }

  private async loadPendingActions() {
    try {
      const stored = await AsyncStorage.getItem('offline_actions');
      if (stored) {
        this.pendingActions = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline actions:', error);
    }
  }

  private async savePendingActions() {
    try {
      await AsyncStorage.setItem('offline_actions', JSON.stringify(this.pendingActions));
    } catch (error) {
      console.error('Failed to save offline actions:', error);
    }
  }
}

export const offlineModeService = new OfflineModeService();