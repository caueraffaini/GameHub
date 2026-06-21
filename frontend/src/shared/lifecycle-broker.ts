// src/shared/lifecycle-broker.ts

import { useSocketStore } from './socket-store';

export async function initMobileLifecycleBroker() {
  try {
    // @ts-expect-error: @capacitor/app might not be installed on browser environments
    const { App } = await import('@capacitor/app');

    App.addListener('appStateChange', (state: { isActive: boolean }) => {
      const socketStore = useSocketStore.getState();

      if (!state.isActive) {
        // App backgrounded: dispatch minimize_presence
        if (socketStore.socket && socketStore.socket.connected) {
          socketStore.socket.emit('minimize_presence', {});
          console.log('Mobile lifecycle backgrounded: dispatched minimize_presence.');
        }
      } else {
        // App returned to foreground: re-evaluate connection and ping heartbeat
        console.log('Mobile lifecycle foregrounded: checking socket connection.');
        if (socketStore.socket) {
          if (!socketStore.socket.connected) {
            socketStore.socket.connect();
          } else {
            socketStore.socket.emit('heartbeat', {});
          }
        }
      }
    });
  } catch {
    console.log('Capacitor App state lifecycle listener skipped (browser/web environment).');
  }
}
