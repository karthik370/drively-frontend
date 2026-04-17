import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

interface Props {
    todayEarnings: number;
    dailyGoal?: number; // default ₹2,000
}

const EarningsGoalCard = ({ todayEarnings, dailyGoal = 2000 }: Props) => {
    const progress = Math.min(todayEarnings / dailyGoal, 1);
    const remaining = Math.max(0, dailyGoal - todayEarnings);
    const isGoalMet = todayEarnings >= dailyGoal;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name={isGoalMet ? 'trophy' : 'flag-checkered'} size={20} color={isGoalMet ? '#f59e0b' : '#6366f1'} />
                    <Text style={styles.title}>{isGoalMet ? 'Goal Reached! 🎉' : "Today's Goal"}</Text>
                </View>
                <Text style={styles.goalAmount}>₹{dailyGoal.toLocaleString()}</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBg}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${Math.round(progress * 100)}%`,
                            backgroundColor: isGoalMet ? '#10b981' : progress > 0.5 ? '#f59e0b' : '#6366f1',
                        },
                    ]}
                />
            </View>

            <View style={styles.statsRow}>
                <Text style={styles.earnedText}>₹{Math.round(todayEarnings)} earned</Text>
                {!isGoalMet ? (
                    <Text style={styles.remainingText}>₹{Math.round(remaining)} more to go</Text>
                ) : (
                    <Text style={[styles.remainingText, { color: '#10b981' }]}>Target achieved!</Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: G.bg,
        borderRadius: 14,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { fontSize: 14, fontWeight: '800', color: G.textPrimary },
    goalAmount: { fontSize: 14, fontWeight: '800', color: '#8A8A8A' },

    progressBg: {
        height: 8,
        backgroundColor: G.glass2,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },

    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    earnedText: { fontSize: 12, fontWeight: '700', color: G.textPrimary },
    remainingText: { fontSize: 12, fontWeight: '700', color: '#8A8A8A' },
});

export default EarningsGoalCard;
