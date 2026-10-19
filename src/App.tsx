import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { OrbitHomeView } from '@/components/orbit-home-view'
import { OrbitLearningView } from '@/components/orbit-learning-view'
import { OrbitLessonWatchView } from '@/components/orbit-lesson-watch-view'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<OrbitHomeView />} />
          <Route path="/learning" element={<OrbitLearningView />} />
          <Route path="/lesson" element={<OrbitLessonWatchView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
