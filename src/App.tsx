import { lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { MainLayout } from '@/layouts/MainLayout'

// Mỗi trang một chunk riêng: trang chủ không phải tải trình phát, quiz, markdown…
// (Suspense nằm trong MainLayout để sidebar vẫn hiện khi trang đang tải)
const OrbitHomeView = lazy(() => import('@/components/orbit-home-view').then((m) => ({ default: m.OrbitHomeView })))
const OrbitLearningView = lazy(() => import('@/components/orbit-learning-view').then((m) => ({ default: m.OrbitLearningView })))
const OrbitLessonView = lazy(() => import('@/components/orbit-lesson-view').then((m) => ({ default: m.OrbitLessonView })))
const OrbitTeacherView = lazy(() => import('@/components/orbit-teacher-view').then((m) => ({ default: m.OrbitTeacherView })))
const OrbitJourneyView = lazy(() => import('@/components/orbit-journey-view').then((m) => ({ default: m.OrbitJourneyView })))
const OrbitDailyView = lazy(() => import('@/components/orbit-daily-view').then((m) => ({ default: m.OrbitDailyView })))
const OrbitStudioView = lazy(() => import('@/components/orbit-studio-view').then((m) => ({ default: m.OrbitStudioView })))

/**
 * Cửa sổ trình duyệt là vùng cuộn duy nhất. Đổi trang thì cuộn về đầu; có #hash thì cuộn tới phần tử đó
 * (trang tải lười nên chờ phần tử xuất hiện tối đa ~1,5 giây).
 */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    const id = decodeURIComponent(hash.slice(1))
    let tries = 0
    let raf = 0
    const seek = () => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ block: 'start' })
      else if (tries++ < 90) raf = requestAnimationFrame(seek)
    }
    seek()
    return () => cancelAnimationFrame(raf)
  }, [pathname, hash])
  return null
}

function App() {
  return (
    // Tôn trọng prefers-reduced-motion cho mọi animation của thư viện motion
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ScrollManager />
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<OrbitHomeView />} />
            <Route path="/learning" element={<OrbitLearningView />} />
            <Route path="/lesson" element={<OrbitLessonView />} />
            <Route path="/lesson/:lessonId" element={<OrbitLessonView />} />
            <Route path="/journey" element={<OrbitJourneyView />} />
            <Route path="/daily/:articleId" element={<OrbitDailyView />} />
            <Route path="/studio" element={<OrbitStudioView />} />
            <Route path="/teacher" element={<OrbitTeacherView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  )
}

export default App
