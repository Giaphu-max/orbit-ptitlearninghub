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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
