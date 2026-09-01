import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function subscribeToRealtimeChanges(onUpdate: (table: string, payload: any) => void) {
  const channelId = `realtime-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      (payload) => {
        console.log(`[SUPABASE REALTIME] Event: ${payload.eventType} on table: ${payload.table}`);
        onUpdate(payload.table, payload);
      }
    )
    .subscribe((status) => {
      console.log(`[SUPABASE REALTIME STATUS] Subscribed channel ${channelId}: ${status}`);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
