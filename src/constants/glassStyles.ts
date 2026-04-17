/**
 * Glassmorphic / Liquid Glass Design Tokens
 * ─────────────────────────────────────────
 * Import these everywhere instead of inline colors/shadows.
 * All styles assume a dark base (#0A0A0A / #111111).
 */

import { StyleSheet, Platform } from 'react-native';

/* ─── Color palette ────────────────────────────────── */
export const G = {
  // Base
  bg: '#0A0A0A',
  bgAlt: '#111111',

  // Glass surfaces — VISIBLE translucency
  glass1: 'rgba(255,255,255,0.06)',   // subtle section bg
  glass2: 'rgba(255,255,255,0.10)',   // card default — clearly visible
  glass3: 'rgba(255,255,255,0.14)',   // elevated card
  glass4: 'rgba(255,255,255,0.20)',   // modal / overlay card — strong

  // Borders — VISIBLE frosted edges
  border1: 'rgba(255,255,255,0.12)',
  border2: 'rgba(255,255,255,0.20)',
  border3: 'rgba(255,255,255,0.30)',
  borderAccent: 'rgba(201,168,76,0.40)',

  // Accent
  accent: '#C9A84C',
  accentSoft: 'rgba(201,168,76,0.18)',
  accentGlow: 'rgba(201,168,76,0.40)',
  accentBg: 'rgba(201,168,76,0.08)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.70)',
  textMuted: 'rgba(255,255,255,0.45)',
  textOnAccent: '#0A0A0A',

  // Semantic
  success: '#10b981',
  successSoft: 'rgba(16,185,129,0.15)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245,158,11,0.15)',
  error: '#ef4444',
  errorSoft: 'rgba(239,68,68,0.15)',
  info: '#3b82f6',
  infoSoft: 'rgba(59,130,246,0.15)',
} as const;

/* ─── Reusable glass card styles ───────────────────── */
export const glass = StyleSheet.create({
  /** Screen-level container */
  screen: {
    flex: 1,
    backgroundColor: G.bg,
  },

  /** Standard glass card — VISIBLE frosted look */
  card: {
    backgroundColor: G.glass2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: G.border2,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },

  /** Elevated glass card (modals, important sections) */
  cardElevated: {
    backgroundColor: G.glass3,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: G.border3,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 28,
      },
      android: {
        elevation: 18,
      },
    }),
  },

  /** Subtle section divider card */
  section: {
    backgroundColor: G.glass1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border1,
    padding: 14,
  },

  /** Row item (for list items, fare rows) */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: G.border1,
  },

  /** Glass header bar */
  header: {
    backgroundColor: G.glass2,
    borderBottomWidth: 1,
    borderBottomColor: G.border2,
    paddingHorizontal: 16,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  /** Accent-bordered card — gold glow */
  cardAccent: {
    backgroundColor: G.glass2,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: G.borderAccent,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: G.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },

  /** Primary gold button */
  buttonPrimary: {
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Platform.select({
      ios: {
        shadowColor: G.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  /** Ghost / outline button */
  buttonGhost: {
    backgroundColor: G.glass2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.border3,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  /** Input field */
  input: {
    backgroundColor: G.glass1,
    borderWidth: 1,
    borderColor: G.border2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: G.textPrimary,
  },

  /** Status pill */
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: G.glass3,
    borderWidth: 1,
    borderColor: G.border2,
  },

  /** Modal overlay */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },

  /** Bottom sheet style */
  bottomSheet: {
    backgroundColor: G.glass4,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: G.border3,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },

  /** Divider line */
  divider: {
    height: 1,
    backgroundColor: G.border1,
    marginVertical: 12,
  },
});

/* ─── Typography shortcuts ─────────────────────────── */
export const gText = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', color: G.textPrimary },
  h2: { fontSize: 22, fontWeight: '700', color: G.textPrimary },
  h3: { fontSize: 18, fontWeight: '700', color: G.textPrimary },
  h4: { fontSize: 16, fontWeight: '600', color: G.textPrimary },
  body: { fontSize: 15, fontWeight: '400', color: G.textSecondary, lineHeight: 22 },
  bodySm: { fontSize: 13, fontWeight: '400', color: G.textSecondary, lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: '400', color: G.textMuted },
  accent: { color: G.accent, fontWeight: '600' },
  btnPrimary: { fontSize: 16, fontWeight: '700', color: G.textOnAccent, letterSpacing: 0.3 },
  btnGhost: { fontSize: 15, fontWeight: '600', color: G.textPrimary },
  label: { fontSize: 14, fontWeight: '500', color: G.textSecondary },
  value: { fontSize: 15, fontWeight: '600', color: G.textPrimary },
});
