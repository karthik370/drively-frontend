import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, goldGradient, radius, shadows } from '../../theme';
import { G } from '../../constants/glassStyles';

let LinearGradient: any;
try { LinearGradient = require('expo-linear-gradient').LinearGradient; }
catch { LinearGradient = ({ style, children }: any) => <View style={[style, { backgroundColor: G.accent }]}>{children}</View>; }

type PremiumCardProps = {
    children: React.ReactNode;
    onPress?: () => void;
    goldAccent?: boolean;
    style?: ViewStyle;
};

const PremiumCard: React.FC<PremiumCardProps> = ({ children, onPress, goldAccent = false, style }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!onPress) return;
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        if (!onPress) return;
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const content = (
        <Animated.View style={[cardStyles.card, shadows.card, { transform: [{ scale: scaleAnim }] }, style]}>
            {goldAccent && (
                <LinearGradient
                    colors={goldGradient as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={cardStyles.goldAccent}
                />
            )}
            <View style={cardStyles.content}>{children}</View>
        </Animated.View>
    );

    if (onPress) {
        return (
            <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
                {content}
            </Pressable>
        );
    }

    return content;
};

const cardStyles = StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginBottom: 14,
    },
    goldAccent: {
        height: 3,
        width: '100%',
    },
    content: {
        padding: 16,
    },
});

export default PremiumCard;
