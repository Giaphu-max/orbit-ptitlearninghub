import { Navigate, useSearchParams } from 'react-router-dom'

/** Link cũ /teacher?tab=… chuyển sang route mới: thống kê và kết quả kiểm tra về Lớp học, còn lại về Bài giảng. */
export function OrbitTeacherRedirect() {
    const [params] = useSearchParams()
    const tab = params.get('tab')
    return <Navigate to={tab === 'stats' || tab === 'tests' ? '/teacher/class' : '/teacher/library'} replace />
}
