import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RouteError, Shell, Spinner } from '@/components/route-shell'
import { installViewTransitions } from '@/lib/view-transition'

// Router dạng "data router" vì viewTransition của react-router 7 chỉ hoạt động với RouterProvider.
// Mỗi trang một chunk (route.lazy): chunk tải xong rồi mới đổi trang, nên view transition luôn thấy trang đích đã dựng, không thấy màn chờ.
const pages = {
    home: () => import('@/components/orbit-home-route').then((m) => m.OrbitHomeRoute),
    learning: () => import('@/components/orbit-learning-view').then((m) => m.OrbitLearningView),
    lesson: () => import('@/components/orbit-lesson-view').then((m) => m.OrbitLessonView),
    teacherKb: () => import('@/components/orbit-teacher-kb-view').then((m) => m.OrbitTeacherKbView),
    journey: () => import('@/components/orbit-journey-view').then((m) => m.OrbitJourneyView),
    today: () => import('@/components/orbit-today-view').then((m) => m.OrbitTodayView),
    daily: () => import('@/components/orbit-daily-view').then((m) => m.OrbitDailyView),
    test: () => import('@/components/orbit-test-view').then((m) => m.OrbitTestView),
    checkpoint: () => import('@/components/orbit-checkpoint-view').then((m) => m.OrbitCheckpointView),
    recap: () => import('@/components/orbit-recap-view').then((m) => m.OrbitRecapView),
    studio: () => import('@/components/orbit-studio-view').then((m) => m.OrbitStudioView),
}
const page = (key: keyof typeof pages) => async () => ({ Component: (await pages[key]()) as ComponentType })

export const router = createBrowserRouter([
    {
        element: <Shell />,
        errorElement: <RouteError />,
        hydrateFallbackElement: <Spinner />,
        children: [
            { path: '/', lazy: page('home') },
            { path: '/learning', lazy: page('learning') },
            { path: '/lesson', lazy: page('lesson') },
            { path: '/lesson/:lessonId', lazy: page('lesson') },
            { path: '/journey', lazy: page('journey') },
            { path: '/today', lazy: page('today') },
            { path: '/daily/:articleId', lazy: page('daily') },
            { path: '/test/:courseId', lazy: page('test') },
            { path: '/checkpoint/:lessonId', lazy: page('checkpoint') },
            { path: '/recap/:lessonId', lazy: page('recap') },
            { path: '/studio', lazy: page('studio') },
            { path: '/teacher', lazy: page('teacherKb') },
            { path: '/teacher/*', element: <Navigate to="/teacher" replace /> },
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
])

installViewTransitions(router as unknown as Parameters<typeof installViewTransitions>[0])

// Tải sẵn các trang lúc rảnh, lần lượt từng trang, để chuyển trang tức thì (chỉ bản build: ở dev, Vite biên dịch theo yêu cầu nên tải sẵn chỉ làm chậm)
if (import.meta.env.PROD && typeof window !== 'undefined') {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000))
    idle(async () => {
        for (const load of Object.values(pages)) await load().catch(() => undefined)
    })
}
