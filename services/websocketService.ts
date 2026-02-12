
type StatusCallback = (isConnected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = `ws://${window.location.hostname}:${window.location.port || '8080'}`;
  private statusCallbacks: StatusCallback[] = [];
  public isConnected: boolean = false;

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyListeners(true);
        console.log('OpenCrabShell Link: VPS Connected');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyListeners(false);
      };

      this.ws.onerror = (err) => {
        console.log('OpenCrabShell Link: Local Simulation Mode (VPS not found)');
        this.isConnected = false;
        this.notifyListeners(false);
      };
    } catch (e) {
      this.isConnected = false;
      this.notifyListeners(false);
    }
  }

  subscribe(callback: StatusCallback) {
    this.statusCallbacks.push(callback);
    // Notify immediately of current state
    callback(this.isConnected);
  }

  unsubscribe(callback: StatusCallback) {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  private notifyListeners(status: boolean) {
    this.statusCallbacks.forEach(cb => cb(status));
  }
}

export const webSocketService = new WebSocketService();
