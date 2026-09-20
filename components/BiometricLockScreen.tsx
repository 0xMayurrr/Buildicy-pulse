import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { BuildicyLogo } from './BuildicyLogo';
import { supabase } from '../lib/supabase';

interface BiometricLockScreenProps {
  onUnlockSuccess: () => void;
  onFallbackToLogin?: () => void;
}

export function BiometricLockScreen({
  onUnlockSuccess,
  onFallbackToLogin,
}: BiometricLockScreenProps) {
  const [authenticating, setAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Prompt fingerprint scan automatically when lock screen opens
    handleAuthenticate();
  }, []);

  async function handleAuthenticate() {
    setAuthenticating(true);
    setErrorMsg(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Fallback if hardware isn't available or biometric not enrolled
        onUnlockSuccess();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Buildicy Pulse',
        fallbackLabel: 'Use Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        console.log('[BIOMETRIC AUTH] Fingerprint verification succeeded');
        onUnlockSuccess();
      } else {
        console.warn('[BIOMETRIC AUTH] Verification failed or canceled:', result.error);
        if (result.error !== 'user_cancel') {
          setErrorMsg('Authentication failed. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('[BIOMETRIC AUTH ERROR]', err.message || err);
      setErrorMsg(err.message || 'Failed to authenticate');
    } finally {
      setAuthenticating(false);
    }
  }

  async function handleSignOutFallback() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out and log in with your email/password credentials?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            console.log('[BIOMETRIC FALLBACK] User chose password fallback. Signing out...');
            await supabase.auth.signOut();
            if (onFallbackToLogin) {
              onFallbackToLogin();
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0B0F17" />
      
      {/* Header */}
      <View style={styles.header}>
        <BuildicyLogo size="large" showSubtitle={true} />
      </View>

      {/* Center Lock Visual */}
      <View style={styles.lockVisualContainer}>
        <View style={styles.fingerprintRing}>
          <View style={styles.fingerprintInner}>
            <Ionicons name="finger-print" size={72} color="#7C3AED" />
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.badgeText}>9999-BIT BIOMETRIC GUARD</Text>
        </View>

        <Text style={styles.lockTitle}>APP LOCKED</Text>
        <Text style={styles.lockSubtitle}>
          Scan your fingerprint to access your wealth architecture and financial control engine.
        </Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={handleAuthenticate}
          disabled={authenticating}
          activeOpacity={0.8}
        >
          {authenticating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="finger-print-outline" size={20} color="#FFFFFF" />
              <Text style={styles.scanBtnText}>SCAN FINGERPRINT TO UNLOCK</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fallbackBtn}
          onPress={handleSignOutFallback}
          activeOpacity={0.7}
        >
          <Ionicons name="key-outline" size={16} color="#9CA3AF" />
          <Text style={styles.fallbackBtnText}>USE EMAIL & PASSWORD INSTEAD</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  lockVisualContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fingerprintRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  fingerprintInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#0B0F17',
    borderWidth: 1.5,
    borderColor: '#A855F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderWidth: 1,
    borderColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#A855F7',
    letterSpacing: 1.5,
  },
  lockTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 16,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F87171',
  },
  actionContainer: {
    gap: 12,
    marginBottom: 16,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#A855F7',
  },
  scanBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  fallbackBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
});
