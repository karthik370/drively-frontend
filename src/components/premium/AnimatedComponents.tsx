/**
 * Premium Animation Components
 * ─────────────────────────────
 * Reusable animation wrappers for the DriveGaadi dark theme.
 * Uses only React Native built-in Animated API (no native deps).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ViewStyle, StyleProp } from 'react-native';

// ── FadeIn: Fades content in on mount ──────────────────────────────────────
export const FadeIn = ({
    children,
    delay = 0,
    duration = 400,
    style,
}: {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    style?: StyleProp<ViewStyle>;
}) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration,
            delay,
            useNativeDriver: true,
        }).start();
    }, []);

    return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
};

// ── SlideUp: Slides content up with fade ───────────────────────────────────
export const SlideUp = ({
    children,
    delay = 0,
    duration = 500,
    distance = 30,
    style,
}: {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    distance?: number;
    style?: StyleProp<ViewStyle>;
}) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(distance)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                delay,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                delay,
                useNativeDriver: true,
                tension: 65,
                friction: 10,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
            {children}
        </Animated.View>
    );
};

// ── ScaleIn: Pops content in with scale ────────────────────────────────────
export const ScaleIn = ({
    children,
    delay = 0,
    style,
}: {
    children: React.ReactNode;
    delay?: number;
    style?: StyleProp<ViewStyle>;
}) => {
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: 1,
                delay,
                useNativeDriver: true,
                tension: 80,
                friction: 8,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 250,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
            {children}
        </Animated.View>
    );
};

// ── StaggerItem: For staggered list animations ─────────────────────────────
export const StaggerItem = ({
    children,
    index,
    style,
}: {
    children: React.ReactNode;
    index: number;
    style?: StyleProp<ViewStyle>;
}) => {
    const delay = Math.min(index * 80, 600); // cap at 600ms
    return (
        <SlideUp delay={delay} distance={20} duration={400} style={style}>
            {children}
        </SlideUp>
    );
};

// ── PressableScale: Scales down on press for tactile feedback ──────────────
export const PressableScale = ({
    children,
    onPress,
    style,
    disabled,
    scaleTo = 0.96,
}: {
    children: React.ReactNode;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
    scaleTo?: number;
}) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.spring(scale, {
            toValue: scaleTo,
            useNativeDriver: true,
            tension: 100,
            friction: 5,
        }).start();
    };

    const onPressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 40,
            friction: 4,
        }).start();
    };

    return (
        <Pressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={disabled}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
};

// ── PulseGlow: Subtle pulsing glow effect for emphasis ─────────────────────
export const PulseGlow = ({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}) => {
    const opacity = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.5,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View style={[style, { opacity }]}>
            {children}
        </Animated.View>
    );
};
