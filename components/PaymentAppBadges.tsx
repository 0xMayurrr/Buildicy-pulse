import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BadgeProps {
  app: 'gpay' | 'phonepe' | 'paytm' | 'bhim';
  size?: number;
}

export function PaymentAppBadge({ app, size = 44 }: BadgeProps) {
  if (app === 'gpay') {
    return (
      <View style={[styles.badgeBase, { width: size, height: size, backgroundColor: '#FFFFFF', borderColor: '#4285F4' }]}>
        <View style={styles.gpayLogoBox}>
          <Text style={[styles.gpayG, { color: '#4285F4' }]}>G</Text>
          <Text style={[styles.gpayText, { color: '#5F6368' }]}>Pay</Text>
        </View>
      </View>
    );
  }

  if (app === 'phonepe') {
    return (
      <View style={[styles.badgeBase, { width: size, height: size, backgroundColor: '#5F259F', borderColor: '#4C1D95' }]}>
        <View style={styles.phonepeBox}>
          <Text style={styles.phonepePeText}>पे</Text>
        </View>
      </View>
    );
  }

  if (app === 'paytm') {
    return (
      <View style={[styles.badgeBase, { width: size, height: size, backgroundColor: '#002E6E', borderColor: '#00BAF2' }]}>
        <View style={styles.paytmBox}>
          <Text style={styles.paytmTextPay}>Pay</Text>
          <Text style={styles.paytmTextTm}>tm</Text>
        </View>
      </View>
    );
  }

  // BHIM / Generic UPI
  return (
    <View style={[styles.badgeBase, { width: size, height: size, backgroundColor: '#0F172A', borderColor: '#7C3AED' }]}>
      <View style={styles.bhimBox}>
        <Ionicons name="qr-code" size={size * 0.45} color="#8B5CF6" />
        <Text style={styles.bhimText}>UPI</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeBase: {
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gpayLogoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpayG: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
  },
  gpayText: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 1,
  },
  phonepeBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonepePeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  paytmBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paytmTextPay: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  paytmTextTm: {
    color: '#00BAF2',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12,
  },
  bhimBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bhimText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: -2,
  },
});
