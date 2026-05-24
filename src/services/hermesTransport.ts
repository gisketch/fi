import { HERMES_WS_URL, getHermesWebToken } from '../config/hermes';
import { GatewayEvent, JsonRpcRequest, JsonRpcResponse } from '../types/hermes';

type EventCallback = (event: GatewayEvent) => void;

class HermesTransport {
  private ws: WebSocket | null = null;
  private subscribers = new Set<EventCallback>();
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: number;
    }
  >();
  private nextId = 1;
  private reconnectTimeout: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private connectionAttemptId = 0;
  private connectPromise: Promise<void> | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private explicitlyClosed = false;

  public latestReadyEvent: GatewayEvent | null = null;
  public connectionStatusCallback: ((status: 'connecting' | 'connected' | 'disconnected') => void) | null = null;

  constructor() {
    // Lazy connect or auto connect
  }

  public connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    this.explicitlyClosed = false;
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.notifyStatus('connecting');

    this.connectPromise = new Promise(async (resolve, reject) => {
      const attemptId = this.connectionAttemptId + 1;
      this.connectionAttemptId = attemptId;
      let opened = false;
      let settled = false;
      let connectTimeout: number | null = null;

      const settleResolve = () => {
        if (settled) return;
        settled = true;
        if (connectTimeout) window.clearTimeout(connectTimeout);
        this.connectPromise = null;
        this.connectReject = null;
        resolve();
      };

      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        if (connectTimeout) window.clearTimeout(connectTimeout);
        this.connectPromise = null;
        this.connectReject = null;
        reject(error);
      };

      this.connectReject = settleReject;

      try {
        const token = await getHermesWebToken();
        if (attemptId !== this.connectionAttemptId || this.explicitlyClosed) {
          settleReject(new Error('WebSocket connection was cancelled'));
          return;
        }
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        const url = `${HERMES_WS_URL}${tokenParam}`;
        
        console.log(`Connecting to Hermes WebSocket: ${HERMES_WS_URL}`);
        const socket = new WebSocket(url);
        this.ws = socket;

        connectTimeout = window.setTimeout(() => {
          if (attemptId !== this.connectionAttemptId || opened) return;
          try {
            socket.close();
          } catch {
            // no-op
          }
          settleReject(new Error('WebSocket connection timed out'));
        }, 15000);

        socket.onopen = () => {
          if (attemptId !== this.connectionAttemptId) return;
          opened = true;
          console.log('Hermes WebSocket connected.');
          this.reconnectDelay = 1000;
          this.notifyStatus('connected');
          settleResolve();
        };

        socket.onmessage = (event) => {
          if (attemptId !== this.connectionAttemptId) return;
          this.handleMessage(event.data);
        };

        socket.onclose = (event) => {
          if (attemptId !== this.connectionAttemptId) return;
          console.log(`Hermes WebSocket closed. Code: ${event.code}, Clean: ${event.wasClean}`);
          if (this.ws === socket) this.ws = null;
          if (!opened) {
            settleReject(new Error(`WebSocket closed before opening (${event.code})`));
          }
          this.notifyStatus('disconnected');
          
          if (!this.explicitlyClosed) {
            this.scheduleReconnect();
          }
        };

        socket.onerror = (err) => {
          if (attemptId !== this.connectionAttemptId) return;
          console.error('Hermes WebSocket error:', err);
        };
      } catch (e) {
        settleReject(e instanceof Error ? e : new Error('WebSocket connection failed'));
      }
    });

    return this.connectPromise;
  }

  public disconnect() {
    this.explicitlyClosed = true;
    this.connectionAttemptId += 1;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.connectReject?.(new Error('WebSocket connection was closed'));
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectPromise = null;
    this.connectReject = null;
    this.notifyStatus('disconnected');
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    
    console.log(`Scheduling reconnect in ${this.reconnectDelay}ms...`);
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch((err) => {
        console.error('Reconnect connection failed, retrying...', err);
      });
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  private notifyStatus(status: 'connecting' | 'connected' | 'disconnected') {
    if (this.connectionStatusCallback) {
      this.connectionStatusCallback(status);
    }
  }

  private handleMessage(data: string) {
    try {
      // Decode newline-delimited frames or single messages
      const frames = data.split('\n').filter(Boolean);
      for (const frame of frames) {
        const message = JSON.parse(frame);

        // Check if message is a JSON-RPC response
        if ('id' in message && message.id !== null) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(message.id);

            const rpcResponse = message as JsonRpcResponse;
            if (rpcResponse.error) {
              pending.reject(new Error(rpcResponse.error.message || `RPC Error ${rpcResponse.error.code}`));
            } else {
              pending.resolve(rpcResponse.result);
            }
          }
        } 
        // Check if message is an event notification
        else if (message.method === 'event' && message.params) {
          const event = message.params as GatewayEvent;
          if (event.type === 'gateway.ready') {
            this.latestReadyEvent = event;
          }
          this.emitEvent(event);
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', data, e);
    }
  }

  private emitEvent(event: GatewayEvent) {
    for (const callback of this.subscribers) {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in event subscriber:', e);
      }
    }
  }

  public onEvent(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public request<T = any>(method: string, params: Record<string, unknown> = {}, timeoutMs = 30000): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure connection first
        await this.connect();

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          throw new Error('WebSocket is not open');
        }

        const id = String(this.nextId++);
        const requestPayload: JsonRpcRequest = {
          jsonrpc: '2.0',
          id,
          method,
          params,
        };

        const timeout = window.setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC Request ${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        this.pendingRequests.set(id, { resolve, reject, timeout });
        this.ws.send(JSON.stringify(requestPayload));
      } catch (err) {
        reject(err);
      }
    });
  }

  public isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export const hermesTransport = new HermesTransport();
