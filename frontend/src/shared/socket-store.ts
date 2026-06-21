// src/shared/socket-store.ts

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export type SocketState = 'OFFLINE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'TERMINATED';

interface SocketStore {
  socket: Socket | null;
  state: SocketState;
  connect: (url: string, userId: string) => void;
  disconnect: () => void;
  emit: (event: string, data: unknown) => void;
}

export const useSocketStore = create<SocketStore>((set, get) => {
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let activeUserId: string | null = null;

  const startHeartbeatInterval = (socket: Socket) => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', { userId: activeUserId });
      }
    }, 5000);
  };

  const handleReconnect = () => {
    const maxDelay = 30000;
    const baseDelay = 1000;
    const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempts));
    const jitter = Math.random() * 1000;
    const finalDelay = delay + jitter;

    set({ state: 'RECONNECTING' });
    attempts++;

    reconnectTimer = setTimeout(() => {
      const currentSocket = get().socket;
      if (currentSocket) {
        currentSocket.connect();
      }
    }, finalDelay);
  };

  return {
    socket: null,
    state: 'OFFLINE',

    connect: (url, userId) => {
      activeUserId = userId;
      attempts = 0;

      if (get().socket) {
        get().socket?.disconnect();
      }

      set({ state: 'CONNECTING' });

      // Create socket under the /match namespace
      const socketInstance = io(`${url}/match`, {
        autoConnect: true,
        reconnection: false, // Handle reconnection loop manually
      });

      socketInstance.on('connect', () => {
        attempts = 0;
        set({ state: 'CONNECTED' });
        startHeartbeatInterval(socketInstance);
        if (reconnectTimer) clearTimeout(reconnectTimer);
      });

      socketInstance.on('disconnect', (reason) => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);

        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          set({ state: 'TERMINATED' });
        } else {
          handleReconnect();
        }
      });

      socketInstance.on('connect_error', () => {
        handleReconnect();
      });

      set({ socket: socketInstance });
    },

    disconnect: () => {
      const currentSocket = get().socket;
      if (currentSocket) {
        currentSocket.disconnect();
      }
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      set({ socket: null, state: 'OFFLINE' });
    },

    emit: (event, data) => {
      const currentSocket = get().socket;
      if (currentSocket && currentSocket.connected) {
        currentSocket.emit(event, data);
      }
    }
  };
});
