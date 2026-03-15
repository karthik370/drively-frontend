/**
 * DriveMate Premium Dark Mode Design System
 * ─────────────────────────────────────────
 * Luxury dark theme with gold accents.
 */

// ── Colors ──────────────────────────────────────────────────────────────────

export const colors = {
    // Backgrounds
    bg: '#0A0A0A',
    surface: '#111111',
    surfaceLight: '#181818',
    elevated: '#1E1E1E',
    card: '#141414',
    cardAlt: '#161616',

    // Borders
    border: 'rgba(255,255,255,0.3)',
    borderLight: 'rgba(255,255,255,0.3)',
    borderMedium: 'rgba(255,255,255,0.3)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#8A8A8A',
    textMuted: '#444444',
    textBody: '#CCCCCC',
    textCaption: '#666666',

    // Gold Accent System
    gold: '#C9A84C',
    goldLight: '#E2C97E',
    goldDark: '#8B6914',
    goldGlow: 'rgba(201, 168, 76, 0.5)',
    goldSubtle: 'rgba(201, 168, 76, 0.08)',
    goldPress: 'rgba(201, 168, 76, 0.1)',

    // Status
    success: '#22C55E',
    error: '#FF4444',
    warning: '#F59E0B',
    info: '#3B82F6',

    // Misc
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0,0,0,0.75)',
    handleBar: '#2A2A2A',
} as const;

// ── Gold Gradient ───────────────────────────────────────────────────────────

export const goldGradient = ['#8B6914', '#C9A84C', '#E2C97E', '#C9A84C', '#8B6914'] as const;
export const goldGradientSimple = ['#8B6914', '#C9A84C', '#E2C97E'] as const;

// ── Typography ──────────────────────────────────────────────────────────────

export const typography = {
    heading: {
        fontSize: 24,
        fontWeight: '800' as const,
        color: colors.textPrimary,
        letterSpacing: 0.3,
    },
    subheading: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: colors.textPrimary,
    },
    body: {
        fontSize: 14,
        fontWeight: '400' as const,
        color: colors.textBody,
    },
    caption: {
        fontSize: 12,
        fontWeight: '400' as const,
        color: colors.textCaption,
    },
    label: {
        fontSize: 11,
        fontWeight: '700' as const,
        color: colors.gold,
        letterSpacing: 1.5,
        textTransform: 'uppercase' as const,
    },
    buttonPrimary: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: colors.bg,
        letterSpacing: 0.5,
    },
    buttonSecondary: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: colors.gold,
        letterSpacing: 0.5,
    },
} as const;

// ── Shadows ─────────────────────────────────────────────────────────────────

export const shadows = {
    gold: {
        shadowColor: '#C9A84C',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    goldSoft: {
        shadowColor: '#C9A84C',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    dark: {
        shadowColor: '#000000',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    card: {
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
} as const;

// ── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
} as const;

// ── Border Radius ───────────────────────────────────────────────────────────

export const radius = {
    sm: 8,
    md: 12,
    lg: 14,
    xl: 16,
    xxl: 20,
    full: 999,
} as const;

// ── Navigation Theme (for React Navigation) ────────────────────────────────

export const navigationTheme = {
    dark: true,
    colors: {
        primary: colors.gold,
        background: colors.bg,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.gold,
    },
    fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' as const },
        medium: { fontFamily: 'System', fontWeight: '500' as const },
        bold: { fontFamily: 'System', fontWeight: '700' as const },
        heavy: { fontFamily: 'System', fontWeight: '800' as const },
    },
};

// ── Tab Bar Config ──────────────────────────────────────────────────────────

export const tabBarTheme = {
    activeTintColor: colors.gold,
    inactiveTintColor: colors.textMuted,
    style: {
        backgroundColor: colors.surface,
        borderTopColor: colors.borderLight,
        borderTopWidth: 1,
    },
};

// ── Drawer Config ───────────────────────────────────────────────────────────

export const drawerTheme = {
    background: '#0D0D0D',
    activeTint: colors.gold,
    inactiveTint: colors.textCaption,
    activeBackground: colors.goldSubtle,
    separator: colors.borderLight,
};
