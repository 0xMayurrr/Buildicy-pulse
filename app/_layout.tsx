import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AuthScreen } from '../components/AuthScreen';
import { BiometricLockScreen } from '../components/BiometricLockScreen';
import { SleekFloatingTabBar } from '../components/SleekFloatingTabBar';

import { BuildicyLogo } from '../components/BuildicyLogo';

// Prevent native splash screen from hiding prematurely
SplashScreen.preventAutoHideAsync();

const FUNNY_LOADING_MESSAGES = [
  'SUMMONING YOUR FINANCIAL SUPERPOWERS...',
  'COUNTING BILLS FASTER THAN YOUR ACCOUNTANT...',
  'WAKING UP THE DATABASE MONSTERS...',
  'MAKING YOUR REVENUE GRAPH GO TO THE MOON...',
  'ENCRYPTING YOUR WEALTH WITH 9999-BIT SECURITY...',
  'BREWING FRESH FINANCIAL INSIGHTS...',
  'CHECKING IF YOU ARE A MILLIONAIRE YET...',
];

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);

  // Automatic OTA Update check on app launch
  useEffect(() => {
    async function checkOtaOnLaunch() {
      try {
        if (!__DEV__) {
          console.log('[OTA UPDATE] Checking for new OTA update on app launch...');
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            console.log('[OTA UPDATE] New update found! Downloading...');
            await Updates.fetchUpdateAsync();
            Alert.alert(
              '⚡ App Update Available',
              'A fresh update for Buildicy Pulse has been downloaded. Restart now to apply latest features!',
              [
                { text: 'Later', style: 'cancel' },
                { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
              ]
            );
          }
        }
      } catch (err: any) {
        console.log('[OTA UPDATE] Update check skipped or already up to date:', err.message || err);
      }
    }
    checkOtaOnLaunch();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % FUNNY_LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log('[APP INIT] Checking existing Supabase session and biometric preferences...');
    
    async function initAuthAndBiometric() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log(`[SUPABASE AUTH SESSION] Active session found for user: ${session.user.email}`);
          const bioPref = await AsyncStorage.getItem('BUILDICY_BIOMETRIC_ENABLED');
          if (bioPref === 'true') {
            console.log('[BIOMETRIC APP GUARD] Biometric lock is ENABLED. Requiring fingerprint...');
            setIsBiometricLocked(true);
          }
        } else {
          console.log('[SUPABASE AUTH SESSION] No active session found. Presenting AuthScreen.');
        }
        setSession(session);
      } catch (err: any) {
        console.error('[APP INIT ERROR]', err);
      } finally {
        setLoading(false);
        SplashScreen.hideAsync();
      }
    }

    initAuthAndBiometric();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AUTH STATE CHANGE] Event: ${event} | User: ${session?.user?.email || 'Logged Out'}`);
      if (event === 'SIGNED_IN' && session) {
        const bioPref = await AsyncStorage.getItem('BUILDICY_BIOMETRIC_ENABLED');
        if (bioPref === 'true') {
          setIsBiometricLocked(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setIsBiometricLocked(false);
      }
      setSession(session);
      setLoading(false);
      SplashScreen.hideAsync();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0F17', paddingHorizontal: 24, gap: 24 }}>
        <StatusBar style="light" backgroundColor="#0B0F17" />
        <BuildicyLogo size="large" showSubtitle={true} />
        <View style={{ alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={{ fontSize: 10, fontWeight: '900', color: '#A855F7', letterSpacing: 1.5, textAlign: 'center', minHeight: 28 }}>
            {FUNNY_LOADING_MESSAGES[messageIndex]}
          </Text>
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" backgroundColor="#0B0F17" />
        <AuthScreen />
      </>
    );
  }

  if (isBiometricLocked) {
    return (
      <BiometricLockScreen
        onUnlockSuccess={() => {
          console.log('[BIOMETRIC LOCK UNLOCKED] Access granted to dashboard');
          setIsBiometricLocked(false);
        }}
        onFallbackToLogin={() => {
          setIsBiometricLocked(false);
          setSession(null);
        }}
      />
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor="#F8F7FC" />
      <Tabs
        tabBar={(props) => <SleekFloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'HOME',
          }}
          listeners={{
            focus: () => console.log('[NAVIGATION] Active Tab -> HOME (Dashboard)'),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'TRANSACTIONS',
          }}
          listeners={{
            focus: () => console.log('[NAVIGATION] Active Tab -> TRANSACTIONS'),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: 'PROJECTS',
          }}
          listeners={{
            focus: () => console.log('[NAVIGATION] Active Tab -> PROJECTS'),
          }}
        />
        <Tabs.Screen
          name="growth"
          options={{
            title: 'GROWTH',
          }}
          listeners={{
            focus: () => console.log('[NAVIGATION] Active Tab -> GROWTH'),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'MORE',
          }}
          listeners={{
            focus: () => console.log('[NAVIGATION] Active Tab -> MORE'),
          }}
        />
      </Tabs>
    </>
  );
}
