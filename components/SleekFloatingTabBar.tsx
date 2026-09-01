import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { QRPayModal } from './QRPayModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DOCK_MARGIN = 14;
const DOCK_WIDTH = SCREEN_WIDTH - DOCK_MARGIN * 2;
const NUM_TABS = 5;
const TAB_WIDTH = DOCK_WIDTH / NUM_TABS;

export function SleekFloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [isQrOpen, setIsQrOpen] = useState(false);
  const activeIndex = state.index;
  const slideAnim = useRef(new Animated.Value(activeIndex * TAB_WIDTH)).current;
  const isDragging = useRef(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Smoothly slide active pill when route index changes
  useEffect(() => {
    if (!isDragging.current) {
      Animated.spring(slideAnim, {
        toValue: activeIndex * TAB_WIDTH,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex]);

  // Handle Drag / Hold Gesture across the Tab Bar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const touchX = evt.nativeEvent.locationX;
        const index = Math.max(0, Math.min(Math.floor(touchX / TAB_WIDTH), NUM_TABS - 1));
        setHoverIndex(index);

        Animated.spring(slideAnim, {
          toValue: index * TAB_WIDTH,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }).start();
      },

      onPanResponderMove: (evt) => {
        const touchX = evt.nativeEvent.locationX;
        const clampedX = Math.max(0, Math.min(touchX, DOCK_WIDTH));
        const index = Math.max(0, Math.min(Math.floor(clampedX / TAB_WIDTH), NUM_TABS - 1));
        
        setHoverIndex(index);
        slideAnim.setValue(clampedX - TAB_WIDTH / 2);
      },

      onPanResponderRelease: (evt) => {
        isDragging.current = false;
        const touchX = evt.nativeEvent.locationX;
        const finalIndex = Math.max(0, Math.min(Math.floor(touchX / TAB_WIDTH), NUM_TABS - 1));
        setHoverIndex(null);

        // If user releases finger directly on the Center QR slot (index 2), open QR Modal!
        if (finalIndex === 2) {
          setIsQrOpen(true);
        } else {
          Animated.spring(slideAnim, {
            toValue: finalIndex * TAB_WIDTH,
            friction: 7,
            tension: 100,
            useNativeDriver: true,
          }).start();

          const targetRoute = state.routes[finalIndex];
          if (targetRoute && state.index !== finalIndex) {
            navigation.navigate(targetRoute.name);
          }
        }
      },

      onPanResponderTerminate: () => {
        isDragging.current = false;
        setHoverIndex(null);
        Animated.spring(slideAnim, {
          toValue: activeIndex * TAB_WIDTH,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <>
      <View style={styles.floatingContainer}>
        <View style={styles.dockBar} {...panResponder.panHandlers}>
          {/* Animated Sliding Purple Pill for normal tabs */}
          {activeIndex !== 2 && (
            <Animated.View
              style={[
                styles.slidingPill,
                {
                  width: TAB_WIDTH,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            />
          )}

          {/* Tab Route Items */}
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const isHovered = hoverIndex === index;
            const isCenterQrSlot = index === 2;

            // Render Center Large QR Scan & Pay Button
            if (isCenterQrSlot) {
              return (
                <TouchableOpacity
                  key="center_qr"
                  onPress={() => {
                    console.log('[QR SCANNER] Center QR Pay button tapped! Opening scanner modal...');
                    setIsQrOpen(true);
                  }}
                  activeOpacity={0.85}
                  style={styles.centerQrTouchable}
                >
                  <View style={styles.centerQrCircle}>
                    <Ionicons name="qr-code" size={26} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              );
            }

            const getIconName = () => {
              if (route.name === 'index') return 'pulse';
              if (route.name === 'transactions') return 'swap-vertical';
              if (route.name === 'projects') return 'briefcase';
              if (route.name === 'growth') return 'trending-up';
              if (route.name === 'more') return 'grid';
              return 'ellipse';
            };

            const onPressTab = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPressTab}
                activeOpacity={0.8}
                style={styles.tabItem}
              >
                <Ionicons
                  name={getIconName() as any}
                  size={22}
                  color={isFocused || isHovered ? '#FFFFFF' : '#94A3B8'}
                />
                {(isFocused || isHovered) && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* QR Pay Flow Modal */}
      <QRPayModal
        visible={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        onSuccess={() => {
          console.log('[QR PAYMENT SUCCESS] Payment transaction recorded and synced!');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 14,
    left: DOCK_MARGIN,
    right: DOCK_MARGIN,
    alignItems: 'center',
  },
  dockBar: {
    flexDirection: 'row',
    backgroundColor: '#0B0F17', // Deep Obsidian Black
    borderRadius: 24,
    height: 58,
    borderWidth: 2,
    borderColor: '#7C3AED', // Royal Purple Border
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
    alignItems: 'center',
    width: DOCK_WIDTH,
  },
  slidingPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: '#7C3AED', // Royal Electric Purple Fill
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#C084FC',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  tabItem: {
    width: TAB_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    gap: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },

  // Center QR Action Button
  centerQrTouchable: {
    width: TAB_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  centerQrCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#C084FC',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    marginTop: -18, // Elevated above dock
  },
});
