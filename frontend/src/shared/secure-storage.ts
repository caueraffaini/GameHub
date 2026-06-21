// src/shared/secure-storage.ts

const mockStorage: Record<string, string> = {};

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      // @ts-expect-error: secure-storage module is not installed in browser environments
      const secureStorageModule = await import('@capacitor-community/secure-storage');
      const result = await secureStorageModule.SecureStoragePlugin.get({ key });
      return result.value;
    } catch {
      return mockStorage[key] || localStorage.getItem(key);
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      // @ts-expect-error: secure-storage module is not installed in browser environments
      const secureStorageModule = await import('@capacitor-community/secure-storage');
      await secureStorageModule.SecureStoragePlugin.set({ key, value });
    } catch {
      mockStorage[key] = value;
      localStorage.setItem(key, value);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      // @ts-expect-error: secure-storage module is not installed in browser environments
      const secureStorageModule = await import('@capacitor-community/secure-storage');
      await secureStorageModule.SecureStoragePlugin.remove({ key });
    } catch {
      delete mockStorage[key];
      localStorage.removeItem(key);
    }
  }
};
