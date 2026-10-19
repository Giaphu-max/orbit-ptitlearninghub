import typography from '@tailwindcss/typography'
import animate from 'tailwindcss-animate'

const token = (name) => `hsl(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Thang đỏ PTIT, 600 là màu gốc #C4161C
        brand: {
          50: '#FDF3F2',
          100: '#FBE3E2',
          200: '#F6C4C3',
          300: '#EE9A98',
          400: '#E2605F',
          500: '#D42F31',
          600: '#C4161C',
          700: '#A11117',
          800: '#810F14',
          900: '#5E0C10',
          950: '#3A0709',
          DEFAULT: token('brand'),
          foreground: token('brand-foreground'),
          soft: token('brand-soft'),
        },
        // Trung tính ấm thay cho xám lạnh mặc định
        gray: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
          950: '#0C0A09',
        },
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        surface: token('surface'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
        success: { DEFAULT: token('success'), foreground: token('success-foreground') },
        warning: { DEFAULT: token('warning'), foreground: token('warning-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Tiêu đề kiểu editorial: lớn, chặt dòng
        'display': ['3.5rem', { lineHeight: '1.04', letterSpacing: '-0.035em', fontWeight: '800' }],
        'headline': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '800' }],
        'title': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '700' }],
        'eyebrow': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.18em', fontWeight: '700' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        brand: 'var(--shadow-brand)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        reward: 'var(--duration-reward)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        spring: 'var(--ease-spring)',
      },
      animation: {
        flash: 'flash 350ms ease-out forwards',
      },
      keyframes: {
        flash: {
          '0%': { opacity: '0.9' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [typography, animate],
}
