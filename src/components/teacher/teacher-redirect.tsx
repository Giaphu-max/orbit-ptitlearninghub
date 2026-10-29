import { Navigate, useSearchParams } from 'react-router-dom'

/** Link cũ /teacher?tab=… chuyển sang route mới: thống kê và kết quả test về Lớp học, còn lại về Duyệt nội dung. */
export function OrbitTeacherRedirect() {
    const [params] = useSearchParams()
    const tab = params.get('tab')
    return <Navigate to={tab === 'stats' || tab === 'tests' ? '/teacher/class' : '/teacher/review'} replace />
}
