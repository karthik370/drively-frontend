import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish: () => void;
}

const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onFinish }) => {
  /* ── animation values ─────────────────────────── */
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTransY = useRef(new Animated.Value(20)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;

  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  const ring2Scale = useRef(new Animated.Value(0)).current;
  const ring2Opacity = useRef(new Animated.Value(0.4)).current;

  const shimmerX = useRef(new Animated.Value(-width)).current;

  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1: Logo entrance — scale + fade + subtle rotation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Phase 2: Ring pulse expanding outward (staggered)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }, 400);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(ring2Scale, {
          toValue: 3,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(ring2Opacity, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start();
    }, 600);

    // Phase 3: App name slides up + fades in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(textTransY, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }, 700);

    // Phase 3b: Tagline fades in
    setTimeout(() => {
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 1100);

    // Phase 4: Gold shimmer sweeps across
    setTimeout(() => {
      Animated.timing(shimmerX, {
        toValue: width * 2,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 1200);

    // Phase 5: Fade everything out and finish
    setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2400);
  }, []);

  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-15deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* Pulse rings behind logo */}
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          styles.ring2,
          {
            transform: [{ scale: ring2Scale }],
            opacity: ring2Opacity,
          },
        ]}
      />

      {/* Logo with scale + rotation + fade */}
      <Animated.View
        style={{
          transform: [{ scale: logoScale }, { rotate: spin }],
          opacity: logoOpacity,
        }}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/drively_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* App name */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTransY }],
          marginTop: 28,
        }}
      >
        <Text style={styles.appName}>DriveGaadi</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Your ride, your way
      </Animated.Text>

      {/* Gold shimmer overlay */}
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX: shimmerX }],
          },
        ]}
        pointerEvents="none"
      />

      {/* Bottom dots */}
      <View style={styles.bottomDots}>
        {[0, 1, 2].map((i) => (
          <AnimatedDot key={i} delay={800 + i * 200} />
        ))}
      </View>
    </Animated.View>
  );
};

/* ── Animated loading dot ──────────────────────── */
const AnimatedDot: React.FC<{ delay: number }> = ({ delay }) => {
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true, delay }),
        Animated.timing(opacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return <Animated.View style={[styles.dot, { opacity }]} />;
};

/* ── Styles ────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },

  /* Pulse rings */
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#C9A84C',
  },
  ring2: {
    borderColor: 'rgba(201, 168, 76, 0.4)',
    borderWidth: 1,
  },

  /* Logo */
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(201, 168, 76, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 80,
    height: 80,
  },

  /* Text */
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(201, 168, 76, 0.7)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  /* Gold shimmer */
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.3,
    height: height,
    backgroundColor: 'transparent',
    borderLeftWidth: 0,
    // Use a narrow gold band
    borderRightWidth: 2,
    borderRightColor: 'rgba(201, 168, 76, 0.15)',
    shadowColor: '#C9A84C',
    shadowOffset: { width: -20, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
  },

  /* Bottom dots */
  bottomDots: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C9A84C',
  },
});

export default AnimatedSplash;
