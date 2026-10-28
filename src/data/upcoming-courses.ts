import type { Course } from './types'

/**
 * DỮ LIỆU MẪU: học phần "Sắp mở" chỉ để thẻ lớp học phần ở /learning trông đầy đủ. Chưa có bài giảng nên không nằm trong courses.json
 * và không tính vào số liệu tổng quan, bài học hay bản đồ kỹ năng.
 */
export const upcomingCourses: Course[] = [
    {
        id: 'bo-cuc-da-phuong-tien',
        title: 'Bố cục đa phương tiện',
        subject: 'Thiết kế',
        instructor: 'Khoa Đa phương tiện, PTIT',
        description: 'Nguyên tắc bố cục, phân cấp thị giác và nhịp điệu trong sản phẩm đa phương tiện.',
        lessonIds: [],
        classCode: 'MUL1417-20261-01',
        cover: { motif: 'grid', accent: 'design', seed: 3 },
    },
    {
        id: 'thiet-ke-chuyen-dong',
        title: 'Thiết kế chuyển động',
        subject: 'Chuyển động',
        instructor: 'Khoa Đa phương tiện, PTIT',
        description: 'Nguyên lý hoạt hình, easing và kể chuyện bằng chuyển động.',
        lessonIds: [],
        classCode: 'MUL1418-20261-03',
        cover: { motif: 'wave', accent: 'audio', seed: 5 },
    },
]
