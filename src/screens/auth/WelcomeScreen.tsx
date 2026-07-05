import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Animated,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, goldGradient } from '../../theme';
import { G } from '../../constants/glassStyles';

let LinearGradient: any;
try { LinearGradient = require('expo-linear-gradient').LinearGradient; }
catch { LinearGradient = ({ style, children }: any) => <View style={[style, { backgroundColor: G.accent }]}>{children}</View>; }

// ── Slide data ────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 'customer',
    badge: 'For Customers',
    badgeColor: '#C9A84C',
    badgeBg: 'rgba(201,168,76,0.12)',
    accentColor: '#C9A84C',
    icon: 'car-back' as const,
    iconBg: 'rgba(201,168,76,0.1)',
    title: 'Book Your\nPersonal Driver',
    subtitle: 'Professional drivers at your doorstep — anytime, anywhere.',
    features: [
      { icon: 'map-marker-check', text: 'Door-to-door pickup service' },
      { icon: 'crosshairs-gps',    text: 'Live GPS tracking for family' },
      { icon: 'shield-account',    text: 'Government-verified safe drivers' },
      { icon: 'clock-fast',        text: 'Available 24 × 7, 365 days' },
    ],
  },
  {
    id: 'driver',
    badge: 'For Drivers',
    badgeColor: '#10B981',
    badgeBg: 'rgba(16,185,129,0.12)',
    accentColor: '#10B981',
    icon: 'steering' as const,
    iconBg: 'rgba(16,185,129,0.1)',
    title: 'Earn With\nYour Skills',
    subtitle: 'Turn driving into a flexible, high-paying career on your terms.',
    features: [
      { icon: 'currency-inr',      text: 'Daily & weekly payouts' },
      { icon: 'calendar-clock',    text: 'Fully flexible working hours' },
      { icon: 'trending-up',       text: 'Grow income with referrals' },
      { icon: 'star-circle',       text: 'Bonuses & driver rewards' },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
const WelcomeScreen = ({ navigation }: any) => {
  const { height: SCREEN_H, width: SCREEN_W } = useWindowDimensions();
  const isSmall = SCREEN_H < 720;
  const isExtraSmall = SCREEN_H < 640;

  const flatRef = useRef<FlatList>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const dotAnim = useRef(SLIDES.map(() => new Animated.Value(0))).current;

  // Auto-cycle every 3.5 s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => {
        const next = (prev + 1) % SLIDES.length;
        try {
          flatRef.current?.scrollToIndex({ index: next, animated: true });
        } catch (e) {}
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Animate dots when activeIdx changes
  useEffect(() => {
    dotAnim.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === activeIdx ? 1 : 0,
        useNativeDriver: false,
        bounciness: 6,
      }).start();
    });
  }, [activeIdx]);

  const onMomentumEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveIdx(idx);
  }, [SCREEN_W]);

  // Dynamic layout calculations based on screen height
  const logoRing = isExtraSmall ? 70 : isSmall ? 84 : 110;
  const logoImg  = isExtraSmall ? 55 : isSmall ? 66 : 88;
  const iconSize = isExtraSmall ? 54 : isSmall ? 64 : 76;
  const iconGlyphSize = isExtraSmall ? 28 : isSmall ? 32 : 38;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* ── Brand header ──────────────────────────────────────── */}
      <View style={[styles.brandRow, { marginTop: isExtraSmall ? 2 : isSmall ? 6 : 14 }]}>
        <LinearGradient
          colors={goldGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.logoRing, { width: logoRing, height: logoRing, borderRadius: logoRing / 2 }]}
        >
          <Image
            source={require('../../../assets/drively_logo.png')}
            style={{ width: logoImg, height: logoImg }}
            resizeMode="contain"
          />
        </LinearGradient>
        <Text style={[styles.appName, { fontSize: isExtraSmall ? 22 : isSmall ? 26 : 32 }]}>DriveGaadi</Text>
        <Text style={[styles.tagline, { fontSize: isExtraSmall ? 10 : 12 }]}>Your Trusted Driver Platform</Text>
      </View>

      {/* ── Sliding cards ─────────────────────────────────────── */}
      <View style={styles.listContainer}>
        <FlatList
          ref={flatRef}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item: s }) => (
            <View style={[styles.slide, { width: SCREEN_W }]}>
              <View style={[styles.card, { padding: isExtraSmall ? 12 : isSmall ? 16 : 22 }]}>
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.cardScrollContent}
                  style={styles.cardScroll}
                >
                  <View style={styles.cardInner}>
                    {/* Badge */}
                    <View style={[styles.badge, { backgroundColor: s.badgeBg, marginBottom: isExtraSmall ? 8 : isSmall ? 12 : 16 }]}>
                      <View style={[styles.badgeDot, { backgroundColor: s.badgeColor }]} />
                      <Text style={[styles.badgeText, { color: s.badgeColor }]}>{s.badge}</Text>
                    </View>

                    {/* Icon circle */}
                    <View style={[
                      styles.iconCircle, 
                      { 
                        backgroundColor: s.iconBg, 
                        borderColor: s.badgeColor + '30',
                        width: iconSize,
                        height: iconSize,
                        borderRadius: iconSize / 2,
                        marginBottom: isExtraSmall ? 8 : isSmall ? 12 : 18
                      }
                    ]}>
                      <Icon name={s.icon} size={iconGlyphSize} color={s.accentColor} />
                    </View>

                    {/* Heading */}
                    <Text style={[
                      styles.slideTitle, 
                      { 
                        fontSize: isExtraSmall ? 18 : isSmall ? 20 : 24,
                        lineHeight: isExtraSmall ? 24 : isSmall ? 26 : 30,
                        marginBottom: isExtraSmall ? 4 : 8
                      }
                    ]}>{s.title}</Text>
                    <Text style={[styles.slideSub, { fontSize: isExtraSmall ? 12 : 13, marginBottom: isExtraSmall ? 12 : isSmall ? 16 : 20 }]}>
                      {s.subtitle}
                    </Text>

                    {/* Feature list */}
                    <View style={[styles.featureList, { gap: isExtraSmall ? 6 : isSmall ? 8 : 10 }]}>
                      {s.features.map((f: { icon: string; text: string }, i: number) => (
                        <View key={i} style={styles.featureRow}>
                          <View style={[styles.featureIconWrap, { backgroundColor: s.badgeBg }]}>
                            <Icon name={f.icon as any} size={isExtraSmall ? 13 : 15} color={s.accentColor} />
                          </View>
                          <Text style={[styles.featureText, { fontSize: isExtraSmall ? 12 : 13 }]}>{f.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        />
      </View>

      {/* ── Page dots ─────────────────────────────────────────── */}
      <View style={[styles.dotsRow, { paddingVertical: isExtraSmall ? 6 : isSmall ? 10 : 14 }]}>
        {SLIDES.map((s, i) => {
          const width = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [8, 24] });
          const opacity = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => {
                try {
                  flatRef.current?.scrollToIndex({ index: i, animated: true });
                } catch (e) {}
                setActiveIdx(i);
              }}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.dot,
                  { width, opacity, backgroundColor: SLIDES[activeIdx].accentColor },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── CTA button ────────────────────────────────────────── */}
      <View style={[styles.cta, { paddingBottom: isExtraSmall ? 8 : isSmall ? 12 : 18 }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, { shadowColor: SLIDES[activeIdx].accentColor }]}
          onPress={() => navigation.navigate('PhoneLogin')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={activeIdx === 0 ? ['#E2C97E', '#C9A84C', '#8B6914'] : ['#34D399', '#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaGradient, { paddingVertical: isExtraSmall ? 12 : isSmall ? 14 : 16 }]}
          >
            <Text style={[styles.ctaText, { fontSize: isExtraSmall ? 15 : 16 }]}>Get Started</Text>
            <Icon name="arrow-right" size={isExtraSmall ? 18 : 20} color="#000" />
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.footerNote, { fontSize: isExtraSmall ? 10 : 11 }]}>
          One app · Two roles · Infinite possibilities
        </Text>
      </View>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'space-between',
  },

  // Brand
  brandRow: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  logoRing: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  appName: {
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tagline: {
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // List Container
  listContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  // Slide
  slide: {
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    maxHeight: '92%',
  },
  cardScroll: {
    width: '100%',
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardInner: {
    alignItems: 'center',
    width: '100%',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Icon
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Text
  slideTitle: {
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  slideSub: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  // Features
  featureList: {
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: '#CCCCCC',
    fontWeight: '500',
    flex: 1,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // CTA
  cta: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  ctaBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },
  footerNote: {
    color: '#444',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default WelcomeScreen;
