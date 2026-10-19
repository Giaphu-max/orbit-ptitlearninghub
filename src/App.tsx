import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { OrbitHomeView } from '@/components/orbit-home-view'
import { OrbitLearningView } from '@/components/orbit-learning-view'
import { OrbitLessonView } from '@/components/orbit-lesson-view'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<OrbitHomeView />} />
          <Route path="/learning" element={<OrbitLearningView />} />
          <Route path="/lesson" element={<OrbitLessonView />} />
          <Route path="/lesson/:lessonId" element={<OrbitLessonView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
