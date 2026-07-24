export type Theme = 'dark' | 'light' | 'midnight';

export type ThemeColors = {
  bg: string; bgSecondary: string; card: string; cardAlt: string;
  text: string; textSecondary: string; textTertiary: string;
  border: string; borderStrong: string; iconBg: string;
  red: string; redLight: string; green: string; amber: string;
};

export const THEMES: Record<Theme, ThemeColors> = {
  dark: {
    bg: '#0A0A0A', bgSecondary: '#1A1A1A', card: '#1A1A1A', cardAlt: '#14161A',
    text: '#FFFFFF', textSecondary: '#888888', textTertiary: '#666666',
    border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.12)',
    iconBg: 'rgba(255,255,255,0.06)',
    red: '#D42B2B', redLight: 'rgba(212,43,43,0.08)',
    green: '#22C55E', amber: '#F59E0B',
  },
  light: {
    bg: '#F7F7F7', bgSecondary: '#FFFFFF', card: '#FFFFFF', cardAlt: '#F0F0F0',
    text: '#1A1A1A', textSecondary: '#666666', textTertiary: '#999999',
    border: 'rgba(0,0,0,0.06)', borderStrong: 'rgba(0,0,0,0.12)',
    iconBg: 'rgba(0,0,0,0.04)',
    red: '#D42B2B', redLight: 'rgba(212,43,43,0.06)',
    green: '#16A34A', amber: '#D97706',
  },
  midnight: {
    bg: '#1C1C2E', bgSecondary: '#262638', card: '#262638', cardAlt: '#1E1E30',
    text: '#E8E8F0', textSecondary: '#9999AA', textTertiary: '#666677',
    border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.12)',
    iconBg: 'rgba(255,255,255,0.06)',
    red: '#D42B2B', redLight: 'rgba(212,43,43,0.08)',
    green: '#22C55E', amber: '#F59E0B',
  },
};
