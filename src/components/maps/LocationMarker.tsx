/**
 * LocationMarker — Production-grade lollipop-style pickup/drop pins.
 *
 * ══ WHY pure JSX (NOT PNG image) ══
 * PNG images always have a rectangular bounding box — React Native cannot clip
 * the bitmap to a non-rectangular shape. This causes a visible white/grey square
 * background around the pin on the map. The only way to get a truly transparent,
 * shape-only marker is to render it as React Native Views inside the Marker's
 * children with tracksViewChanges managed correctly.
 *
 * ══ DESIGN — Lollipop style ══
 * Large filled circle on top + thin stick at the bottom.
 * • Pickup = green  (#22C55E) — plain filled circle, no symbol — matches theme.ts success color
 * • Drop   = red    (#FF4444) + white ✓ check  — matches theme.ts error color
 * • Both have a thin gold (#C9A84C) ring border — DriveGaadi brand accent
 *
 * ══ SIZING ══
 * Fixed dp dimensions guarantee identical visual size on all screen densities.
 *
 * ══ tracksViewChanges STRATEGY ══
 * Start true → native captures the child layout as a bitmap → disable after 600ms.
 * Static marker; no need to re-capture after first render.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

export type LocationMarkerType = 'pickup' | 'drop';

export type LocationMarkerProps = {
  type: LocationMarkerType;
  latitude: number;
  longitude: number;
  zIndex?: number;
};

// ── Design tokens ────────────────────────────────────────────────────────────
const CIRCLE_SIZE = 25;   // diameter of the lollipop head (dp)
const STICK_W = 3;    // width of the stick (dp)
const STICK_H = 14;   // height of the stick (dp)
const BORDER_W = 2.5;  // gold ring border width (dp)

const PICKUP_COLOR = '#22C55E';
const DROP_COLOR = '#FF4444';
const GOLD = '#C9A84C';
const WHITE = '#FFFFFF';

// ── Sub-components ───────────────────────────────────────────────────────────

// Pickup: plain green filled circle with gold border — no icon/symbol inside
const PickupHead = () => (
  <View style={[styles.circle, { backgroundColor: PICKUP_COLOR, borderColor: GOLD }]} />
);

// Drop: red circle with gold border + white check mark
const DropHead = () => (
  <View style={[styles.circle, { backgroundColor: DROP_COLOR, borderColor: GOLD }]}>
    <Icon name="check-bold" size={18} color={WHITE} />
  </View>
);

// ── Main component ───────────────────────────────────────────────────────────

const LocationMarker = React.memo(({ type, latitude, longitude, zIndex = 5 }: LocationMarkerProps) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setTracksViewChanges(false), 600);
    return () => clearTimeout(t);
  }, []);

  const stickColor = type === 'pickup' ? PICKUP_COLOR : DROP_COLOR;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      tracksViewChanges={tracksViewChanges}
      // anchor at the very bottom of the stick so the tip sits on the map point
      anchor={{ x: 0.5, y: 1 }}
      zIndex={zIndex}
      title={type === 'pickup' ? 'Pickup' : 'Drop'}
    >
      <View style={styles.wrapper}>
        {type === 'pickup' ? <PickupHead /> : <DropHead />}
        {/* Stick */}
        <View style={[styles.stick, { backgroundColor: stickColor }]} />
        {/* Tiny shadow dot at base */}
        <View style={styles.baseDot} />
      </View>
    </Marker>
  );
});

export default LocationMarker;

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    // No background, no border — fully transparent wrapper
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  stick: {
    width: STICK_W,
    height: STICK_H,
    borderRadius: STICK_W / 2,
  },
  baseDot: {
    width: 6,
    height: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginTop: 1,
  },
});
