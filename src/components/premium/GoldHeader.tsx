import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme';

type GoldHeaderProps = {
    title: string;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    style?: ViewStyle;
};

const GoldHeader: React.FC<GoldHeaderProps> = ({ title, onBack, rightAction, style }) => {
    return (
        <View style={[headerStyles.container, style]}>
            {onBack ? (
                <TouchableOpacity onPress={onBack} style={headerStyles.backButton}>
                    <Icon name="chevron-left" size={26} color={colors.gold} />
                </TouchableOpacity>
            ) : (
                <View style={headerStyles.placeholder} />
            )}
            <Text style={headerStyles.title} numberOfLines={1}>{title}</Text>
            {rightAction ? rightAction : <View style={headerStyles.placeholder} />}
        </View>
    );
};

const headerStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
    },
    backButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    placeholder: {
        width: 36,
    },
});

export default GoldHeader;
