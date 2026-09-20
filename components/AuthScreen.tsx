import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { BuildicyLogo } from './BuildicyLogo';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [hasBiometricLogin, setHasBiometricLogin] = useState(false);

  useEffect(() => {
    async function checkSavedBiometric() {
      try {
        const bioEnabled = await AsyncStorage.getItem('BUILDICY_BIOMETRIC_ENABLED');
        const savedEmail = await AsyncStorage.getItem('BUILDICY_SAVED_EMAIL');
        const savedPassword = await AsyncStorage.getItem('BUILDICY_SAVED_PASSWORD');

        if (savedEmail) setEmail(savedEmail);

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if ((bioEnabled === 'true' || savedEmail) && hasHardware && isEnrolled) {
          setHasBiometricLogin(true);
          // Automatically popup fingerprint prompt on AuthScreen mount
          setTimeout(() => {
            triggerBiometricLogin(savedEmail || email, savedPassword || password);
          }, 400);
        }
      } catch (err) {
        console.log('[AUTH BIOMETRIC INIT ERROR]', err);
      }
    }
    checkSavedBiometric();
  }, []);

  async function triggerBiometricLogin(targetEmail?: string, targetPassword?: string) {
    try {
      const e = targetEmail || email || (await AsyncStorage.getItem('BUILDICY_SAVED_EMAIL'));
      const p = targetPassword || password || (await AsyncStorage.getItem('BUILDICY_SAVED_PASSWORD'));

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Buildicy Pulse Dashboard',
        cancelLabel: 'Use Password',
        fallbackLabel: 'Use Password',
      });

      if (result.success) {
        if (e && p) {
          setLoading(true);
          console.log(`[BIOMETRIC LOGIN] Fingerprint verified for: ${e}. Signing into Supabase...`);
          const { error } = await supabase.auth.signInWithPassword({
            email: e,
            password: p,
          });
          if (error) throw error;
        } else {
          Alert.alert(
            'Fingerprint Verified 🔒',
            'Please enter your password once to complete fingerprint linking for quick 1-tap logins.'
          );
        }
      } else {
        console.log('[BIOMETRIC LOGIN] Canceled or failed');
      }
    } catch (err: any) {
      console.error('[BIOMETRIC LOGIN ERROR]', err.message || err);
      Alert.alert('Fingerprint Login Error', err.message || 'Could not sign in with fingerprint.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth() {
    if (!email || !password) {
      console.log('[AUTH WARNING] Auth form submitted with empty fields');
      Alert.alert('Error', 'Please enter both email address and password');
      return;
    }

    const cleanEmail = email.trim();
    setLoading(true);

    try {
      if (isSignUp) {
        console.log(`[SUPABASE AUTH] Sending Register request to Supabase for: ${cleanEmail}`);
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (data.session) {
          await AsyncStorage.setItem('BUILDICY_SAVED_EMAIL', cleanEmail);
          await AsyncStorage.setItem('BUILDICY_SAVED_PASSWORD', password);
          Alert.alert('Success', 'Account created and signed in successfully!');
        } else {
          Alert.alert(
            'Account Created!',
            'Your account has been registered in Supabase. You can now tap SIGN IN below with your credentials!',
            [{ text: 'OK', onPress: () => setIsSignUp(false) }]
          );
          setIsSignUp(false);
        }
      } else {
        console.log(`[SUPABASE AUTH] Sending Sign In request to Supabase for: ${cleanEmail}`);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        // Save credentials locally for seamless fingerprint logins
        await AsyncStorage.setItem('BUILDICY_SAVED_EMAIL', cleanEmail);
        await AsyncStorage.setItem('BUILDICY_SAVED_PASSWORD', password);

        console.log(`[SUPABASE AUTH SUCCESS] Signed in successfully as: ${data.user?.email}`);
      }
    } catch (err: any) {
      console.error('[SUPABASE AUTH ERROR]', err.message || err);
      Alert.alert('Authentication Error', err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Logo/Title */}
          <View style={styles.header}>
            <BuildicyLogo size="large" showSubtitle={true} />
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, !isSignUp && styles.activeTabButton]}
              onPress={() => {
                console.log('[NAVIGATION] Switched Auth Mode: SIGN IN');
                setIsSignUp(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, !isSignUp && styles.activeTabButtonText]}>
                SIGN IN
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, isSignUp && styles.activeTabButton]}
              onPress={() => {
                console.log('[NAVIGATION] Switched Auth Mode: REGISTER ACCOUNT');
                setIsSignUp(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, isSignUp && styles.activeTabButtonText]}>
                REGISTER
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@buildicy.com"
                placeholderTextColor="#A1A1AA"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#A1A1AA"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? 'CREATE SUPABASE ACCOUNT' : 'SIGN IN TO DASHBOARD'}
                </Text>
              )}
            </TouchableOpacity>

            {hasBiometricLogin && !isSignUp && (
              <TouchableOpacity
                style={styles.bioButton}
                onPress={() => triggerBiometricLogin()}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="finger-print" size={20} color="#7C3AED" />
                <Text style={styles.bioButtonText}>SIGN IN WITH FINGERPRINT</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.toggle}
              onPress={() => {
                const nextMode = !isSignUp;
                console.log(`[NAVIGATION] Toggled Auth Mode: ${nextMode ? 'REGISTER' : 'SIGN IN'}`);
                setIsSignUp(nextMode);
              }}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? 'ALREADY HAVE AN ACCOUNT? SIGN IN'
                  : 'NEW USER? REGISTER A NEW ACCOUNT ON SUPABASE'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Crisp Light Background
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#7C3AED',
    padding: 24,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#7C3AED',
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#7C3AED',
    letterSpacing: 1.5,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0B0F17',
    fontWeight: '600',
  },
  button: {
    height: 48,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#6D28D9',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
  },
  bioButton: {
    height: 48,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 2,
    borderColor: '#7C3AED',
    marginTop: 4,
  },
  bioButtonText: {
    color: '#7C3AED',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  toggle: {
    alignItems: 'center',
    marginTop: 8,
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#7C3AED',
    letterSpacing: 1,
  },
});

