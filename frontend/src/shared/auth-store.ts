// src/shared/auth-store.ts

import { create } from 'zustand';

export interface JwtPayload {
  sub: string;
  roles: string[];
  instituteId: string;
  courseId: string;
  exp?: number;
}

export interface UserProfile {
  id: string;
  nusp: string;
  nickname: string;
  email: string;
  fullName: string;
  birthDate: string;
  instituteId: string;
  courseId: string;
  availabilityStatus: 'AVAILABLE' | 'MATCHED' | 'OFFLINE';
}

interface AuthState {
  accessToken: string | null;
  claims: JwtPayload | null;
  user: UserProfile | null;
  setSession: (accessToken: string, user: UserProfile) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  claims: null,
  user: null,

  setSession: (accessToken, user) => {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        set({ accessToken, claims: decoded, user });
        return;
      }
    } catch (e) {
      console.error('Failed to parse access token claims', e);
    }
    set({ accessToken, claims: null, user });
  },

  clearSession: () => {
    set({ accessToken: null, claims: null, user: null });
  },
}));
