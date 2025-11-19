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
        coral: {
          50: '#fef7f4',
          100: '#fdeee7',
          200: '#fad9c4',
          300: '#f6bfa1',
          400: '#f0925b',
          500: '#ea6b47', // Main coral from logo
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
          500: '#4a9eff', // Main blue from logo
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
          500: '#e8c084', // Main sandy color
          600: '#d4a574',
          700: '#b8895f',
          800: '#9a6f4d',
          900: '#7d5a3f',
        },
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