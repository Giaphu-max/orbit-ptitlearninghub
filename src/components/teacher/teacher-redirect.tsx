import { Navigate } from 'react-router-dom'

/** Link cũ /teacher?tab=… chuyển về kho Bài giảng. */
export function OrbitTeacherRedirect() {
    return <Navigate to="/teacher/library" replace />
}
