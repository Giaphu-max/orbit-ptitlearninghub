import { OrbitHomeView } from '@/components/orbit-home-view'
import { TeacherOverview } from '@/components/teacher/teacher-overview'
import { useOrbitStore } from '@/store/useOrbitStore'

/** Route "/": giảng viên vào Tổng quan (không có cảnh 3D), sinh viên vào trang chủ. */
export function OrbitHomeRoute() {
    const role = useOrbitStore((s) => s.role)
    return role === 'teacher' ? <TeacherOverview /> : <OrbitHomeView />
}
