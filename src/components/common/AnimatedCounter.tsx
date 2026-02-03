import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, Text, TextStyle } from 'react-native';

type Props = {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

const formatNumber = (n: number) => {
  const safe = Number.isFinite(n) ? n : 0;
  const parts = Math.round(safe).toString().split('');

  const out: string[] = [];
  let count = 0;

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    out.unshift(parts[i]);
    count += 1;
    if (count === 3 && i !== 0) {
      out.unshift(',');
      count = 0;
    }
  }

  return out.join('');
};

const AnimatedCounter = ({
  value,
  duration = 650,
  prefix = '',
  suffix = '',
  style,
  accessibilityLabel,
}: Props) => {
  const anim = useRef(new Animated.Value(0)).current;
  const lastValueRef = useRef<number>(Number.isFinite(value) ? value : 0);
  const [display, setDisplay] = useState<string>(() => `${prefix}${formatNumber(lastValueRef.current)}${suffix}`);

  useEffect(() => {
    const next = Number.isFinite(value) ? value : 0;
    const start = lastValueRef.current;

    const id = anim.addListener(({ value: t }) => {
      const current = start + (next - start) * t;
      setDisplay(`${prefix}${formatNumber(current)}${suffix}`);
    });

    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        lastValueRef.current = next;
        setDisplay(`${prefix}${formatNumber(next)}${suffix}`);
      }
    });

    return () => {
      anim.removeListener(id);
    };
  }, [anim, duration, value]);

  return (
    <Text accessibilityLabel={accessibilityLabel} style={style}>
      {display}
    </Text>
  );
};

export default AnimatedCounter;
