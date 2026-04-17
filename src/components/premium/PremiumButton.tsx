import React, { useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    Pressable,
    ActivityIndicator,
    View,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { colors, goldGradientSimple, shadows, radius, typography } from '../../theme';
import { G } from '../../constants/glassStyles';

let LinearGradient: any;
try { LinearGradient = require('expo-linear-gradient').LinearGradient; }
catch { LinearGradient = ({ style, children }: any) => <View style={[style, { backgroundColor: G.accent }]}>{children}</View>; }

let Haptics: any;
try { Haptics = require('expo-haptics'); } catch { Haptics = { impactAsync: () => Promise.resolve(), ImpactFeedbackStyle: { Light: 0 } }; }

type PremiumButtonProps = {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'destructive';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
};

const PremiumButton: React.FC<PremiumButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    loading = false,
    disabled = false,
    style,
    textStyle,
    icon,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePress = () => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        onPress();
    };

    const isDisabled = disabled || loading;

    if (variant === 'primary') {
        return (
            <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, isDisabled && { opacity: 0.5 }, style]}>
                <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} disabled={isDisabled}>
                    <LinearGradient
                        colors={goldGradientSimple as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[buttonStyles.primary, shadows.gold]}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.bg} />
                        ) : (
                            <>
                                {icon}
                                <Text style={[buttonStyles.primaryText, textStyle]}>{title}</Text>
                            </>
                        )}
                    </LinearGradient>
                </Pressable>
            </Animated.View>
        );
    }

    if (variant === 'secondary') {
        return (
            <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, isDisabled && { opacity: 0.5 }, style]}>
                <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} disabled={isDisabled}>
                    <LinearGradient
                        colors={goldGradientSimple as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={buttonStyles.secondaryOuter}
                    >
                        <Pressable style={buttonStyles.secondaryInner} onPress={handlePress} disabled={isDisabled}>
                            {loading ? (
                                <ActivityIndicator color={colors.gold} />
                            ) : (
                                <>
                                    {icon}
                                    <Text style={[buttonStyles.secondaryText, textStyle]}>{title}</Text>
                                </>
                            )}
                        </Pressable>
                    </LinearGradient>
                </Pressable>
            </Animated.View>
        );
    }

    // Destructive
    return (
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, isDisabled && { opacity: 0.5 }, style]}>
            <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} disabled={isDisabled}>
                <Pressable style={buttonStyles.destructive} onPress={handlePress} disabled={isDisabled}>
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            {icon}
                            <Text style={[buttonStyles.destructiveText, textStyle]}>{title}</Text>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Animated.View>
    );
};

const buttonStyles = StyleSheet.create({
    primary: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    primaryText: {
        ...typography.buttonPrimary,
    },
    secondaryOuter: {
        borderRadius: radius.lg,
        padding: 1.5,
    },
    secondaryInner: {
        backgroundColor: colors.bg,
        borderRadius: radius.lg - 1,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    secondaryText: {
        ...typography.buttonSecondary,
    },
    destructive: {
        backgroundColor: 'rgba(255, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.3)',
        borderRadius: radius.lg,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    destructiveText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.error,
        letterSpacing: 0.5,
    },
});

export default PremiumButton;
