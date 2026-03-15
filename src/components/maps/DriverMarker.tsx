import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AnimatedRegion, Marker } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type DriverMarkerStatus = 'online' | 'busy' | 'offline';

export type DriverMarkerProps = {
  latitude: number;
  longitude: number;
  heading?: number;
  driverPhoto?: string | null;
  status?: DriverMarkerStatus;
  onPress?: () => void;
};

const distanceApproxMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

const DriverMarker = ({
  latitude,
  longitude,
  heading,
  driverPhoto,
  status = 'online',
  onPress,
}: DriverMarkerProps) => {
  const coordinate = useRef(
    new AnimatedRegion({
      latitude,
      longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current as unknown;

  const headingAnim = useRef(new Animated.Value(typeof heading === 'number' ? heading : 0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const lastCoordRef = useRef<{ latitude: number; longitude: number }>({ latitude, longitude });
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [tracksViewChanges, setTracksViewChanges] = useState<boolean>(true);

  const color = useMemo(() => {
    if (status === 'offline') return '#8E8E93';
    if (status === 'busy') return '#FF9500';
    return '#007AFF';
  }, [status]);

  useEffect(() => {
    const next = { latitude, longitude };
    const prev = lastCoordRef.current;

    const moved = distanceApproxMeters(prev, next) >= 3;
    setIsMoving(moved);

    const region = coordinate as any;
    if (region && typeof region.timing === 'function') {
      region
        .timing({
          latitude,
          longitude,
          duration: 800,
          useNativeDriver: false,
        })
        .start();
    }

    lastCoordRef.current = next;
  }, [coordinate, latitude, longitude]);

  useEffect(() => {
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 700);
    return () => clearTimeout(t);
  }, [driverPhoto, status]);

  useEffect(() => {
    if (typeof heading !== 'number' || !Number.isFinite(heading)) return;

    Animated.timing(headingAnim, {
      toValue: heading,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [heading, headingAnim]);

  useEffect(() => {
    if (!isMoving || status === 'offline') {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [isMoving, pulseAnim, status]);

  const rotation = headingAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const pulseStyle = {
    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }),
    transform: [
      {
        scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.4] }),
      },
    ],
  };

  return (
    <Marker.Animated
      coordinate={coordinate as any}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
      accessibilityLabel="Driver location"
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={!onPress}>
        <View style={styles.container}>
          <Animated.View style={[styles.carWrap, { transform: [{ rotate: rotation }] }]}>
            <MaterialCommunityIcons name="car" size={24} color={color} />
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Marker.Animated>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  carWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DriverMarker;
