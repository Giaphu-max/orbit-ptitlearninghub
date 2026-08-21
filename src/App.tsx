import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { OrbitFeed } from '@/components/orbit-feed'
import { OrbitDiscoverView } from '@/components/orbit-discover-view'
import { OrbitLearningView } from '@/components/orbit-learning-view'
import { OrbitHomeView } from "./components/orbit-home-view";
import { OrbitLessonWatchView } from '@/components/orbit-lesson-watch-view'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<OrbitHomeView />} />
          <Route path="/discover" element={<OrbitDiscoverView />} />
          <Route path="/learning" element={<OrbitLearningView />} />
          <Route path="/vr" element={<OrbitFeed />} />
          <Route path="/lesson" element={<OrbitLessonWatchView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
