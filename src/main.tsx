import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { armFeedback } from '@/lib/feedback'
import { armAudio } from '@/lib/sfx'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/be-vietnam-pro/800.css'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'

// Tự quản lý vị trí cuộn (xem ScrollManager): tải lại trang (F5) luôn bắt đầu từ đầu trang, không nhảy xuống
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

armAudio()
armFeedback()

// Vòng focus chỉ hiện khi đang dùng bàn phím: html[data-input] = 'key' | 'pointer' (CSS ở index.css). Một số webview coi cú bấm chuột vào link là focus-visible.
document.documentElement.dataset.input = 'pointer'
addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') document.documentElement.dataset.input = 'key'
}, true)
addEventListener('pointerdown', () => (document.documentElement.dataset.input = 'pointer'), true)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
