// Dữ liệu mẫu: giảng viên đứng nhiều lớp. Mỗi khóa học gắn với một hoặc nhiều lớp;
// số liệu từng lớp (sai lần đầu, phân bố đáp án, test) dẫn xuất từ class-stats.json ở lib/class-stats.ts.

export interface TeacherClass {
    /** Mã lớp, cũng là id */
    id: string
    subject: string
    size: number
    courseIds: string[]
}

export const TEACHER_CLASSES: TeacherClass[] = [
    { id: 'D24CQPT01', subject: 'Dựng phim', size: 32, courseIds: ['dung-audio-video-phi-tuyen'] },
    { id: 'D24CQPT02', subject: 'Nhiếp ảnh', size: 29, courseIds: ['nhiep-anh-va-anh-sang'] },
    { id: 'D23CQPT01', subject: 'Hậu kỳ nâng cao', size: 35, courseIds: ['dung-audio-video-phi-tuyen'] },
]

export const DEFAULT_CLASS_ID = TEACHER_CLASSES[0].id
