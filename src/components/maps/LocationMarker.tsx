/**
 * LocationMarker — Production-grade lollipop-style pickup/drop pins.
 *
 * ══ WHY child <Image> with tracksViewChanges timing ══
 * Using Marker's `image` prop renders at native PNG pixel size which varies by
 * screen DPI and causes size inconsistencies across devices. Child <Image> with
 * fixed dp dimensions gives exact same visual size on every device.
 * tracksViewChanges is set true initially so the native layer captures the bitmap,
 * then disabled after 600ms (image is static — no re-render needed after capture).
 *
 * ══ DESIGN ══
 * Lollipop style: circle on top + thin stick at bottom.
 * Pickup = green (#22C55E) + white arrow   — matches theme.ts success color
 * Drop   = red   (#FF4444) + white check   — matches theme.ts error color
 * Both have gold (#C9A84C) ring — matches DriveGaadi brand accent
 */

import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { Marker } from 'react-native-maps';

export type LocationMarkerType = 'pickup' | 'drop';

export type LocationMarkerProps = {
  type: LocationMarkerType;
  latitude: number;
  longitude: number;
  zIndex?: number;
};

// Pre-require so Metro bundles them — do NOT use dynamic require() inside render
const PICKUP_IMAGE = require('../../../assets/markers/pickup_pin.png');
const DROP_IMAGE   = require('../../../assets/markers/drop_pin.png');

// Fixed dp sizes — same visual footprint on all screens/densities
const MARKER_W = 36;
const MARKER_H = 48;

const LocationMarker = React.memo(({ type, latitude, longitude, zIndex = 5 }: LocationMarkerProps) => {
  // Start tracking so the native layer captures the child bitmap on first render
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setTracksViewChanges(false), 600);
    return () => clearTimeout(t);
  }, []);

  const source = type === 'pickup' ? PICKUP_IMAGE : DROP_IMAGE;
  const title  = type === 'pickup' ? 'Pickup' : 'Drop';

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      tracksViewChanges={tracksViewChanges}
      // anchor at bottom-center of the stick so the pin tip touches the map point exactly
      anchor={{ x: 0.5, y: 1 }}
      zIndex={zIndex}
      title={title}
    >
      <Image
        source={source}
        style={{ width: MARKER_W, height: MARKER_H }}
        resizeMode="contain"
        fadeDuration={0}
      />
    </Marker>
  );
});

export default LocationMarker;
