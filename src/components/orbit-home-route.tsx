import { Navigate } from 'react-router-dom'
import { OrbitHomeView } from '@/components/orbit-home-view'
import { useOrbitStore } from '@/store/useOrbitStore'

/** Route "/": giảng viên về Kho tài liệu (/teacher), sinh viên vào trang chủ. */
export function OrbitHomeRoute() {
    const role = useOrbitStore((s) => s.role)
    return role === 'teacher' ? <Navigate to="/teacher" replace /> : <OrbitHomeView />
}
