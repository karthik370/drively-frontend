import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

type NearbyDriver = {
  id: string;
  distance: number;
  [key: string]: any;
};

interface NearestDriverBadgeProps {
  nearbyDrivers: NearbyDriver[];
}

const NearestDriverBadge: React.FC<NearestDriverBadgeProps> = ({ nearbyDrivers }) => {
  // ── Compute ETA from nearest driver ──
  const nearest = useMemo(() => {
    if (!nearbyDrivers || nearbyDrivers.length === 0) return null;
    const first = nearbyDrivers[0]; // already sorted by distance (closest first)
    const distKm = Number(first?.distance);
    if (!Number.isFinite(distKm) || distKm <= 0) return null;
    // City average ~30 km/h ≈ 2 min per km
    const etaMin = Math.max(1, Math.ceil(distKm * 2));
    return { etaMin, distKm };
  }, [nearbyDrivers]);

  // ── Animation: cycle between "Nearest driver is" and "X min away" ──
  const [showEta, setShowEta] = useState(false);
  const fadeLabel = useRef(new Animated.Value(1)).current;
  const fadeEta = useRef(new Animated.Value(0)).current;
  const carPulse = useRef(new Animated.Value(1)).current;

  // Cycle between label and ETA every 2s
  useEffect(() => {
    if (!nearest) return;

    const interval = setInterval(() => {
      setShowEta((prev) => !prev);
    }, 2500);

    return () => clearInterval(interval);
  }, [nearest]);

  // Animate crossfade on state change
  useEffect(() => {
    if (!nearest) return;

    if (showEta) {
      Animated.parallel([
        Animated.timing(fadeLabel, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeEta, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeLabel, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeEta, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [showEta, nearest]);

  // Car icon pulse animation
  useEffect(() => {
    if (!nearest) return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(carPulse, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(carPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [nearest]);

  // ── Don't render if no drivers nearby ──
  if (!nearest) return null;

  const etaText = nearest.etaMin > 30 ? '30+' : String(nearest.etaMin);

  return (
    <View style={styles.badge}>
      {/* Phase 1: "Nearest driver is" */}
      <Animated.View style={[styles.contentRow, { opacity: fadeLabel, position: 'absolute' }]}>
        <Icon name="map-marker-radius" size={13} color="#C9A84C" />
        <Text style={styles.labelText}>Nearest driver is</Text>
      </Animated.View>

      {/* Phase 2: "X min away" with car icon */}
      <Animated.View style={[styles.contentRow, { opacity: fadeEta }]}>
        <Animated.View style={{ transform: [{ scale: carPulse }] }}>
          <Icon name="car-side" size={15} color="#10b981" />
        </Animated.View>
        <Text style={styles.etaNumber}>{etaText}</Text>
        <Text style={styles.etaUnit}>min away</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 145,
    height: 34,
    marginTop: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  labelText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#C9A84C',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  etaNumber: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: -0.5,
  },
  etaUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: G.textMuted,
    marginLeft: 1,
  },
});

export default NearestDriverBadge;
