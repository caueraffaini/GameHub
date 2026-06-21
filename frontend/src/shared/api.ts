// src/shared/api.ts

import { useAuthStore } from './auth-store';
import { secureStorage } from './secure-storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

// Determine platform type dynamically
const isNative = typeof window !== 'undefined' && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

async function refreshTokens(): Promise<string> {
  const url = `${API_BASE_URL}/auth/refresh`;

  if (isNative) {
    // Mobile Shell Routine: bypass cookies, fetch from secure storage and push as header
    const token = await secureStorage.get('gamehub_refresh_token');
    if (!token) throw new Error('No refresh token located in secure storage');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': token,
      },
    });

    if (!response.ok) throw new Error('Secure storage session refresh failed');
    const data = await response.json();

    // Store rotated tokens back to mobile keychain
    await secureStorage.set('gamehub_refresh_token', data.refreshToken);
    useAuthStore.getState().setSession(data.accessToken, data.user);
    return data.accessToken;
  } else {
    // Web Client Routine: rely on browser credentials cookies
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Browser cookie session refresh failed');
    const data = await response.json();
    useAuthStore.getState().setSession(data.accessToken, data.user);
    return data.accessToken;
  }
}

export async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  // Pre-request access token injection
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const finalOptions = {
    ...options,
    headers,
  };

  let response = await fetch(url, finalOptions);

  // Outbound Interceptor: Handle 401 Unauthorized
  if (response.status === 401) {
    if (isRefreshing) {
      return new Promise<Response>((resolve, reject) => {
        refreshQueue.push((newToken) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          fetch(url, { ...options, headers })
            .then(resolve)
            .catch(reject);
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await refreshTokens();

      // Process and replay queued requests
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];

      // Replay original request
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      // Clear session on refresh failure
      useAuthStore.getState().clearSession();
      if (isNative) {
        await secureStorage.remove('gamehub_refresh_token');
      }
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  return response;
}
