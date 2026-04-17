/**
 * Global Error Boundary
 * ─────────────────────
 * Catches JS errors anywhere in the component tree.
 * Shows a friendly retry screen instead of a blank crash.
 */
import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.card}>
                        <Icon name="alert-circle-outline" size={56} color="#ef4444" />
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.message}>
                            The app encountered an unexpected error. Please try again.
                        </Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry}>
                            <Icon name="refresh" size={18} color="#fff" />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: G.bg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: G.glass1,
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: G.border2,
        width: '100%',
        maxWidth: 340,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: G.textPrimary,
        marginTop: 16,
    },
    message: {
        fontSize: 14,
        color: G.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: G.accent,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    retryText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#fff',
    },
});

export default ErrorBoundary;
