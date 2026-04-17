import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import AnimatedCounter from '../common/AnimatedCounter';
import { G } from '../../constants/glassStyles';

export type EarningsCardProps = {
  earnings: number;
  tripsCount: number;
  hoursWorked: number;
  comparisonLabel?: string;
  comparisonPercent?: number;
  onPress?: () => void;
};

const EarningsCard = ({
  earnings,
  tripsCount,
  hoursWorked,
  comparisonLabel = 'vs yesterday',
  comparisonPercent,
  onPress,
}: EarningsCardProps) => {
  const theme = useTheme();

  const hourlyRate = hoursWorked > 0 ? earnings / hoursWorked : 0;
  const trendUp = typeof comparisonPercent === 'number' ? comparisonPercent >= 0 : null;

  return (
    <Card style={styles.card} onPress={onPress} accessibilityLabel="Earnings summary">
      <Card.Content>
        <View style={styles.row}>
          <Text variant="titleMedium">Today</Text>
          {typeof comparisonPercent === 'number' ? (
            <Text
              variant="labelMedium"
              style={{ color: trendUp ? theme.colors.primary : theme.colors.error }}
            >
              {trendUp ? '+' : ''}
              {comparisonPercent.toFixed(0)}% {comparisonLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.earningsRow}>
          <AnimatedCounter
            value={earnings}
            duration={650}
            prefix="₹"
            style={[styles.earnings, { color: theme.colors.onSurface }]}
            accessibilityLabel="Today earnings"
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text variant="labelSmall">Trips</Text>
            <Text variant="titleSmall">{tripsCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text variant="labelSmall">Hours</Text>
            <Text variant="titleSmall">{hoursWorked.toFixed(1)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text variant="labelSmall">/hour</Text>
            <Text variant="titleSmall">₹{Math.round(hourlyRate)}</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsRow: {
    marginTop: 6,
    marginBottom: 10,
  },
  earnings: {
    fontSize: 34,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
  },
});

export default EarningsCard;
