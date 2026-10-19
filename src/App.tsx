import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { MainLayout } from '@/layouts/MainLayout'
import { ThemeToggle } from '@/components/theme-toggle'

// Mỗi trang một chunk riêng: trang chủ không phải tải trình phát, quiz, markdown…
// (Suspense nằm trong MainLayout để sidebar vẫn hiện khi trang đang tải)
const OrbitHomeView = lazy(() => import('@/components/orbit-home-view').then((m) => ({ default: m.OrbitHomeView })))
const OrbitLearningView = lazy(() => import('@/components/orbit-learning-view').then((m) => ({ default: m.OrbitLearningView })))
const OrbitLessonView = lazy(() => import('@/components/orbit-lesson-view').then((m) => ({ default: m.OrbitLessonView })))
const OrbitTeacherView = lazy(() => import('@/components/orbit-teacher-view').then((m) => ({ default: m.OrbitTeacherView })))
const OrbitJourneyView = lazy(() => import('@/components/orbit-journey-view').then((m) => ({ default: m.OrbitJourneyView })))

function App() {
  return (
    // Tôn trọng prefers-reduced-motion cho mọi animation của thư viện motion
    <MotionConfig reducedMotion="user">
      <ThemeToggle />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<OrbitHomeView />} />
            <Route path="/learning" element={<OrbitLearningView />} />
            <Route path="/lesson" element={<OrbitLessonView />} />
            <Route path="/lesson/:lessonId" element={<OrbitLessonView />} />
            <Route path="/journey" element={<OrbitJourneyView />} />
            <Route path="/teacher" element={<OrbitTeacherView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  )
}

export default App
