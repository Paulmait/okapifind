import NetInfo from '@react-native-netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      this.notifyListeners();

      if (this.isOnline) {
        this.syncPendingActions();
      }
    });

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