import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        gold: { DEFAULT: '#F0B35B', dim: '#A87B3A', light: '#F5D89A' },
        purple: { DEFAULT: '#8B5CF6', dim: '#6D28D9', light: '#A78BFA' },
        teal: { DEFAULT: '#34D399', dim: '#059669', light: '#6EE7B7' },
        rose: { DEFAULT: '#FB7185', dim: '#E11D48' },
        surface: { 0: '#0A0A0F', 1: '#111118', 2: '#1A1A24', 3: '#242430' },
        border: { DEFAULT: 'rgba(255,255,255,0.06)', hover: 'rgba(255,255,255,0.12)' },
      },
      borderRadius: { '2xl': '16px', '3xl': '20px' },
    },
  },
  plugins: [],
};
export default config;
