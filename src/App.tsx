import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { ThemeCurtain } from '@/components/theme-curtain'
import { router } from '@/router'

function App() {
  return (
    // Tôn trọng prefers-reduced-motion cho mọi animation của thư viện motion
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
      <ThemeCurtain />
    </MotionConfig>
  )
}

export default App
