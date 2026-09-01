import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface Props {
  size?: 'small' | 'medium' | 'large';
  showSubtitle?: boolean;
  showText?: boolean;
}

export function BuildicyLogo({ size = 'medium', showSubtitle = true, showText = true }: Props) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const imageDimensions = isSmall ? 32 : isLarge ? 64 : 44;

  return (
    <View style={styles.container}>
      {/* Actual Logo Image */}
      <View
        style={[
          styles.logoContainer,
          { width: imageDimensions, height: imageDimensions },
        ]}
      >
        <Image
          source={require('../images/logo.png')}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </View>

      {/* Brand Typography */}
      {showText && (
        <View style={styles.textContainer}>
          <View style={styles.brandRow}>
            <Text
              style={[
                styles.brandText,
                isSmall && styles.brandTextSmall,
                isLarge && styles.brandTextLarge,
              ]}
            >
              BUILDICY
            </Text>
            <View style={styles.pulseBadge}>
              <Text style={[styles.pulseTagText, isSmall && { fontSize: 8 }]}>PULSE</Text>
            </View>
          </View>
          {showSubtitle && (
            <Text style={[styles.subtitleText, isSmall && { fontSize: 7 }]}>
              FINANCIAL CONTROL PLATFORM
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0B0F17',
    letterSpacing: 2,
  },
  brandTextSmall: {
    fontSize: 14,
    letterSpacing: 1,
  },
  brandTextLarge: {
    fontSize: 30,
    letterSpacing: 3,
  },
  pulseBadge: {
    backgroundColor: '#0B0F17',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pulseTagText: {
    color: '#8B5CF6',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subtitleText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#6D28D9',
    letterSpacing: 1.5,
    marginTop: 1,
  },
});
