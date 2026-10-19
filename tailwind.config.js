import typography from '@tailwindcss/typography'
import animate from 'tailwindcss-animate'

const token = (name) => `hsl(var(--${name}) / <alpha-value>)`
// Thang màu lưu dạng kênh RGB trong CSS variables để đổi theo giao diện sáng/tối mà vẫn dùng được độ trong suốt
const scale = (name, steps) => Object.fromEntries(steps.map((n) => [n, `rgb(var(--${name}-${n}) / <alpha-value>)`]))

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Thang đỏ PTIT, 600 là màu gốc #C4161C
        brand: {
          ...scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
          /** Màu chữ/nhấn đỏ trên nền theo giao diện (sáng hơn ở chế độ tối để đủ tương phản) */
          ink: token('brand-ink'),
          /** Đỏ nhạt luôn dùng trên nền tối/đỏ (hero, màn nhận XP), không đổi theo giao diện */
          light: token('brand-light'),
          DEFAULT: token('brand'),
          foreground: token('brand-foreground'),
          soft: token('brand-soft'),
        },
        // Trung tính ấm thay cho xám lạnh mặc định
        /** Nền tối cố định ở cả hai giao diện (khung video, lớp phủ, thông báo) */
        ink: { DEFAULT: token('ink'), foreground: token('ink-foreground') },
        info: token('info'),
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
        // Vệt sáng quét qua thẻ "Học tiếp": quét nhanh rồi nghỉ
        sheen: 'sheen 5s ease-in-out infinite',
      },
      keyframes: {
        sheen: {
          '0%, 55%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(520%) skewX(-18deg)' },
        },
        flash: {
          '0%': { opacity: '0.9' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [typography, animate],
}
