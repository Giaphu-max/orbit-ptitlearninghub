import { getCourse } from '@/data'

// Mỗi tòa trên mô hình khuôn viên dẫn tới một khóa thật trong src/data; tòa chưa có khóa thì ghi "Sắp mở".
// Thêm khóa mới: gắn id khóa vào một tòa ở đây, nhãn và liên kết trên mô hình tự cập nhật.

export const BUILDING_COURSE_IDS: Record<string, string | null> = {
    'Tòa A2': 'nhiep-anh-va-anh-sang',
    'Tòa A3': 'dung-audio-video-phi-tuyen',
    'Hội trường A1': null,
    'Tòa A1': null,
    Canteen: null,
    'Cổng trường': null,
}

/** Khóa gắn với tòa; undefined nếu tòa chưa có khóa (hoặc id không còn trong dữ liệu). */
export function courseOfBuilding(name: string) {
    const id = BUILDING_COURSE_IDS[name]
    return id ? getCourse(id) : undefined
}
