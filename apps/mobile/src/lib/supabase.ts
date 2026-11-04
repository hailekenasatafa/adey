import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';
import { AppState, Platform } from 'react-native';
import type { Database } from '@adey/shared';
import { createAdeyApi } from '@adey/shared';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://adey.app';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('REPLACE'));

/**
 * Session storage: SecureStore has a ~2 KB value limit on Android and Supabase
 * sessions exceed it, so we keep a random AES key in SecureStore and store the
 * AES-CTR-encrypted session in AsyncStorage. Nothing sensitive is stored in
 * plaintext on the device.
 */
class LargeSecureStore {
  private async getKey(name: string): Promise<Uint8Array> {
    const keyName = `adey.k.${name}`.replace(/[^A-Za-z0-9._-]/g, '_');
    const existing = await SecureStore.getItemAsync(keyName);
    if (existing) return aesjs.utils.hex.toBytes(existing);
    const key = Crypto.getRandomBytes(32);
    await SecureStore.setItemAsync(keyName, aesjs.utils.hex.fromBytes(key));
    return key;
  }
  async getItem(name: string) {
    const encrypted = await AsyncStorage.getItem(name);
    if (!encrypted) return null;
    try {
      const key = await this.getKey(name);
      const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(encrypted)));
    } catch {
      await AsyncStorage.removeItem(name);
      return null;
    }
  }
  async setItem(name: string, value: string) {
    const key = await this.getKey(name);
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
    await AsyncStorage.setItem(name, aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value))));
  }
  async removeItem(name: string) {
    await AsyncStorage.removeItem(name);
    await SecureStore.deleteItemAsync(`adey.k.${name}`.replace(/[^A-Za-z0-9._-]/g, '_'));
  }
}

export const supabase = createClient<Database>(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: { headers: { 'x-adey-client': `mobile-${Platform.OS}` } },
});

// Keep tokens fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const api = createAdeyApi(supabase);
