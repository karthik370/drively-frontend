import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { G } from '../../constants/glassStyles';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
    icon: string;
    iconColor: string;
    iconBg: string;
    title: string;
    description: string;
}

const SLIDES: OnboardingSlide[] = [
    {
        icon: 'car-connected',
        iconColor: G.accent,
        iconBg: '#eff6ff',
        title: 'Book a Driver',
        description: 'Need a driver for your car? Book a professional, verified driver in seconds. One-way, round trips, or outstation.',
    },
    {
        icon: 'map-marker-radius',
        iconColor: '#10b981',
        iconBg: '#f0fdf4',
        title: 'Real-time Tracking',
        description: 'Track your driver live on the map. Know exactly when they\'ll arrive with ETA countdown and share your trip with family.',
    },
    {
        icon: 'shield-check',
        iconColor: '#6366f1',
        iconBg: '#f5f3ff',
        title: 'Safe & Secure',
        description: 'All drivers are background verified. SOS emergency button, phone masking, and trip sharing keep you safe.',
    },
    {
        icon: 'wallet',
        iconColor: '#f59e0b',
        iconBg: '#fffbeb',
        title: 'Easy Payments',
        description: 'Pay with Cash, UPI, Wallet, or Card. No surge pricing — ever. Transparent fare breakdown before you book.',
    },
    {
        icon: 'star-circle',
        iconColor: '#ef4444',
        iconBg: '#fef2f2',
        title: 'Earn Rewards',
        description: 'Earn coins on every ride, unlock streak bonuses, and refer friends for exclusive discounts.',
    },
];

interface Props {
    onComplete: () => void;
}

const OnboardingScreen = ({ onComplete }: Props) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = async () => {
        try {
            await AsyncStorage.setItem('@dmate_onboarding_complete', 'true');
        } catch { }
        onComplete();
    };

    const renderSlide = ({ item }: { item: OnboardingSlide }) => (
        <View style={[styles.slide, { width }]}>
            <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                <Icon name={item.icon as any} size={64} color={item.iconColor} />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDesc}>{item.description}</Text>
        </View>
    );

    const isLastSlide = currentIndex === SLIDES.length - 1;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Skip button */}
            {!isLastSlide ? (
                <TouchableOpacity style={[styles.skipBtn, { top: insets.top + 8 }]} onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            ) : null}

            {/* Slides */}
            <FlatList
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderSlide}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(idx);
                }}
            />

            {/* Dots */}
            <View style={styles.dotsRow}>
                {SLIDES.map((_, i) => {
                    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
                    const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                    return (
                        <Animated.View
                            key={i}
                            style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
                        />
                    );
                })}
            </View>

            {/* Bottom button */}
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.8}>
                <Text style={styles.nextBtnText}>{isLastSlide ? 'Get Started' : 'Next'}</Text>
                <Icon name={isLastSlide ? 'check' : 'arrow-right'} size={18} color="#ffffff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

// Check if onboarding has been completed
export const hasCompletedOnboarding = async (): Promise<boolean> => {
    try {
        return (await AsyncStorage.getItem('@dmate_onboarding_complete')) === 'true';
    } catch {
        return false;
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: G.bg,
        justifyContent: 'center',
        alignItems: 'center',
    },

    skipBtn: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    skipText: { fontSize: 14, fontWeight: '700', color: G.textSecondary },

    slide: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    iconWrap: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    slideTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: G.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
    },
    slideDesc: {
        fontSize: 15,
        fontWeight: '500',
        color: G.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },

    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 24,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: G.accent,
    },

    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: G.accent,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 40,
        marginBottom: 40,
        marginHorizontal: 20,
        alignSelf: 'stretch',
        elevation: 4,
        shadowColor: G.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    nextBtnText: { fontSize: 16, fontWeight: '900', color: G.textPrimary },
});

export default OnboardingScreen;
