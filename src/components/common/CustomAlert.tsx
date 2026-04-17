import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

/* ─── Types ─────────────────────────────────────────── */

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  icon?: string; // MaterialCommunityIcons name
  iconColor?: string;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
}

/* ─── Queue-based provider (avoids overlapping modals) ─ */

const AlertContext = createContext<AlertContextType>({
  showAlert: () => {},
});

export const useAlert = () => useContext(AlertContext);

export const CustomAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<AlertOptions | null>(null);
  const queue = useRef<AlertOptions[]>([]);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const present = useCallback((opts: AlertOptions) => {
    setCurrent(opts);
    setVisible(true);
    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const dismiss = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 120, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setCurrent(null);
      cb?.();
      // next in queue
      if (queue.current.length > 0) {
        const next = queue.current.shift()!;
        setTimeout(() => present(next), 80);
      }
    });
  }, [scaleAnim, opacityAnim, present]);

  const showAlert = useCallback((opts: AlertOptions) => {
    if (visible) {
      queue.current.push(opts);
    } else {
      present(opts);
    }
  }, [visible, present]);

  const buttons = current?.buttons?.length
    ? current.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const getIconName = (): string => {
    if (current?.icon) return current.icon;
    const title = (current?.title || '').toLowerCase();
    if (title.includes('error') || title.includes('fail')) return 'alert-circle';
    if (title.includes('success') || title.includes('done')) return 'check-circle';
    if (title.includes('warning') || title.includes('caution')) return 'alert';
    if (title.includes('confirm') || title.includes('sure')) return 'help-circle';
    if (title.includes('subscri')) return 'crown';
    if (title.includes('payment')) return 'credit-card-check';
    if (title.includes('location') || title.includes('gps')) return 'map-marker-alert';
    if (title.includes('logout')) return 'logout';
    return 'information';
  };

  const getIconColor = (): string => {
    if (current?.iconColor) return current.iconColor;
    const title = (current?.title || '').toLowerCase();
    if (title.includes('error') || title.includes('fail')) return '#ef4444';
    if (title.includes('success') || title.includes('done')) return '#10b981';
    if (title.includes('warning') || title.includes('caution')) return '#f59e0b';
    return '#C9A84C';
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => dismiss()}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: getIconColor() + '18' }]}>
              <Icon name={getIconName() as any} size={28} color={getIconColor()} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{current?.title ?? ''}</Text>

            {/* Message */}
            {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}

            {/* Buttons */}
            <View style={[styles.buttonRow, buttons.length === 1 && styles.buttonRowSingle]}>
              {buttons.map((btn, i) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                const isPrimary = !isCancel && !isDestructive && buttons.length > 1 && i === buttons.length - 1;
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.7}
                    style={[
                      styles.button,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                      (isPrimary || buttons.length === 1) && styles.buttonPrimary,
                      buttons.length > 1 && { flex: 1 },
                    ]}
                    onPress={() => dismiss(btn.onPress)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                        (isPrimary || buttons.length === 1) && styles.buttonTextPrimary,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
};

/* ─── Global imperative API (for use outside React components) ─ */

let _globalShowAlert: ((opts: AlertOptions) => void) | null = null;

export const setGlobalAlertRef = (fn: (opts: AlertOptions) => void) => {
  _globalShowAlert = fn;
};

/**
 * Drop-in replacement for `showAlert(title, message?, buttons?)`.
 * Works from any file — component or plain utility.
 */
export const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  if (_globalShowAlert) {
    _globalShowAlert({ title, message, buttons });
  } else {
    // Fallback to native
    const { Alert } = require('react-native');
    showAlert(title, message, buttons as any);
  }
};

/* ─── Bridge component: place inside CustomAlertProvider ─ */

export const AlertBridge: React.FC = () => {
  const { showAlert: ctxShow } = useAlert();
  React.useEffect(() => {
    setGlobalAlertRef(ctxShow);
    return () => { _globalShowAlert = null; };
  }, [ctxShow]);
  return null;
};

/* ─── Styles ────────────────────────────────────────── */

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: Math.min(width - 56, 380),
    backgroundColor: '#1A1A1A',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  buttonCancel: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  buttonPrimary: {
    backgroundColor: '#C9A84C',
  },
  buttonDestructive: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextCancel: {
    color: '#9CA3AF',
  },
  buttonTextPrimary: {
    color: '#0A0A0A',
    fontWeight: '700',
  },
  buttonTextDestructive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default CustomAlertProvider;
