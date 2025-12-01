import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design System: Primary mint green
        mint: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#C5E8D5', // Main background color from design system
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
        },
        // Design System: Secondary pastel accents
        'pale-blue': '#D4E4F7',
        'pale-yellow': '#FFD966',
        'pale-peach': '#F5D5C8',
        // Design System: Text colors
        'ds-text': {
          primary: '#1F2937',
          secondary: '#4B5563',
          muted: '#6B7280',
        },
        // Design System: Surface colors
        'ds-surface': {
          white: '#FFFFFF',
          card: '#F9FAFB',
        },
        // Design System: Input colors
        'input': {
          fill: '#F5FFF7', // Very light mint green - input background
          stroke: '#D8EBD8', // Soft sage green - input border
        },
        // Legacy colors (kept for backward compatibility)
        coral: {
          50: '#fef7f4',
          100: '#fdeee7',
          200: '#fad9c4',
          300: '#f6bfa1',
          400: '#f0925b',
          500: '#ea6b47',
          600: '#d85a3a',
          700: '#b8472e',
          800: '#973a26',
          900: '#7c3022',
        },
        ocean: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#4a9eff',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        sand: {
          50: '#fefcf9',
          100: '#fdf8f1',
          200: '#faf0e1',
          300: '#f6e6cc',
          400: '#f0d4a8',
          500: '#e8c084',
          600: '#d4a574',
          700: '#b8895f',
          800: '#9a6f4d',
          900: '#7d5a3f',
        },
      },
      // Design System: Spacing scale (8px base)
      spacing: {
        'ds-xs': '8px',
        'ds-sm': '16px',
        'ds-md': '24px',
        'ds-lg': '32px',
        'ds-xl': '48px',
        'ds-2xl': '64px',
      },
      // Design System: Border radius
      borderRadius: {
        'ds-sm': '8px',
        'ds-md': '12px',
        'ds-lg': '16px',
        'ds-xl': '24px',
        'ds-full': '9999px',
      },
      // Design System: Shadows
      boxShadow: {
        'ds-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'ds-md': '0 4px 6px rgba(0, 0, 0, 0.07)',
        'ds-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'ds-card': '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      // Design System: Font sizes
      fontSize: {
        'ds-h1': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'ds-h2': ['24px', { lineHeight: '1.2', fontWeight: '600' }],
        'ds-h3': ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        'ds-body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'ds-small': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'ds-tiny': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;