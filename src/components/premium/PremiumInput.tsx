import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius } from '../../theme';

type PremiumInputProps = TextInputProps & {
    label?: string;
    error?: string;
};

const PremiumInput: React.FC<PremiumInputProps> = ({ label, error, style, ...props }) => {
    const [isFocused, setIsFocused] = useState(false);
    const borderAnim = useRef(new Animated.Value(0)).current;

    const handleFocus = (e: any) => {
        setIsFocused(true);
        Animated.timing(borderAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
        }).start();
        props.onFocus?.(e);
    };

    const handleBlur = (e: any) => {
        setIsFocused(false);
        Animated.timing(borderAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
        props.onBlur?.(e);
    };

    const borderColor = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.borderMedium, colors.gold],
    });

    return (
        <View style={inputStyles.wrapper}>
            {label ? <Text style={inputStyles.label}>{label}</Text> : null}
            <Animated.View
                style={[
                    inputStyles.inputWrap,
                    { borderColor },
                    isFocused && {
                        shadowColor: colors.gold,
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 4,
                    },
                ]}
            >
                <TextInput
                    {...props}
                    style={[inputStyles.input, style]}
                    placeholderTextColor={colors.textMuted}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
            </Animated.View>
            {error ? <Text style={inputStyles.error}>{error}</Text> : null}
        </View>
    );
};

const inputStyles = StyleSheet.create({
    wrapper: {
        marginBottom: 14,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: 6,
    },
    inputWrap: {
        borderWidth: 1,
        borderRadius: radius.md,
        backgroundColor: '#141414',
    },
    input: {
        fontSize: 15,
        color: colors.textPrimary,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    error: {
        fontSize: 12,
        color: colors.error,
        marginTop: 4,
    },
});

export default PremiumInput;
