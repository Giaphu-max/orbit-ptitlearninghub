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
        // Thang đỏ PTIT, 600 là màu gốc #E2261C
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
        /** Bộ màu logo Khoa Đa phương tiện */
        mm: { blue: 'var(--mm-blue)', sky: 'var(--mm-sky)', teal: 'var(--mm-teal)', yellow: 'var(--mm-yellow)', orange: 'var(--mm-orange)', red: 'var(--mm-red)', pink: 'var(--mm-pink)' },
        info: token('info'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        /** Tiêu đề navy (giao diện tối trùng foreground) */
        strong: token('foreground-strong'),
        /** Nền footer đỏ thương hiệu PTIT (theo --brand-800: 154 21 14) */
        footer: 'rgb(var(--footer-bg) / <alpha-value>)',
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
        // Các keyframes chép từ docs/mockup (Main, Lesson, Reward). Chỉ transform + opacity.
        sheen: 'sweep 3.5s 1.2s ease-in-out infinite',
        'blob-a': 'blobA 14s ease-in-out infinite',
        'blob-b': 'blobB 18s ease-in-out infinite',
        'spin-24': 'spin 24s linear infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        'twinkle-a': 'twinkle 2.4s ease-in-out infinite',
        'twinkle-b': 'twinkle 3.1s .6s ease-in-out infinite',
        'twinkle-c': 'twinkle 2.8s 1s ease-in-out infinite',
        'rise-0': 'rise .6s ease-out both',
        'rise-1': 'rise .7s .1s ease-out both',
        'rise-2': 'rise .7s .2s ease-out both',
        'rise-3': 'rise .7s .3s ease-out both',
        'rise-quiz': 'rise .4s ease-out both',
        'pulse-ring': 'pulseRing 1.6s ease-in-out infinite',
        pop: 'pop .7s cubic-bezier(.2,.9,.3,1.3) both',
        'rise-r1': 'rise .5s .3s ease-out both',
        'rise-r2': 'rise .6s .45s ease-out both',
        'fill-bar': 'fillBar 1.2s .6s ease-out both',
        'glow-ring': 'glowRing 2s ease-in-out infinite',
        'drift-28': 'drift 2.8s ease-in-out infinite alternate',
        'drift-30': 'drift 3s ease-in-out infinite alternate',
        'drift-32': 'drift 3.2s ease-in-out infinite alternate',
        'drift-34': 'drift 3.4s ease-in-out infinite alternate',
        'drift-36': 'drift 3.6s ease-in-out infinite alternate',
        'drift-40': 'drift 4s ease-in-out infinite alternate',
      },
      keyframes: {
        sweep: {
          from: { transform: 'translateX(-120%)' },
          to: { transform: 'translateX(220%)' },
        },
        blobA: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(80px,40px) scale(1.15)' },
        },
        blobB: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(-90px,-50px) scale(.9)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '.25' },
          '50%': { opacity: '1' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        // Mockup dùng box-shadow; ở đây là vòng mở rộng + mờ dần để chỉ cần transform/opacity
        pulseRing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '.5' },
          '50%': { transform: 'scale(2.2)', opacity: '0' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(.6)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        // Mockup đổi width 58% -> 86%; ở đây scaleX từ gốc bên trái, giá trị đầu/cuối lấy từ biến CSS
        fillBar: {
          from: { transform: 'scaleX(var(--fill-from, 0))' },
          to: { transform: 'scaleX(var(--fill-to, 1))' },
        },
        glowRing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '.55' },
          '50%': { transform: 'scale(1.35)', opacity: '0' },
        },
        drift: {
          '0%': { transform: 'translateY(0) rotate(0)' },
          '100%': { transform: 'translateY(40px) rotate(180deg)' },
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
