import { getCourse } from '@/data'

// Mỗi tòa trên mô hình khuôn viên dẫn tới một khóa thật trong src/data; tòa chưa có khóa thì ghi "Sắp mở".
// Thêm khóa mới: gắn id khóa vào một tòa ở đây, nhãn và liên kết trên mô hình tự cập nhật.

export const BUILDING_COURSE_IDS: Record<string, string | null> = {
    'Tòa A2': 'nhiep-anh-va-anh-sang',
    'Hội trường A2': null,
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

/** Hướng mặt đẹp của tòa (độ, 0 = mặt trước nhìn về +z). Dùng để sắp thứ tự các tòa có khóa (rồi tới thứ tự khai báo). */
export const BUILDING_FACE_AZ: Record<string, number> = {
    'Tòa A2': 0,
    'Hội trường A2': 0,
    'Tòa A3': 0,
    'Hội trường A1': 0,
    'Tòa A1': 0,
    Canteen: 0,
    'Cổng trường': 0,
}

/** Các tòa có khóa (trong số `names`) theo thứ tự hiển thị ở chương Khóa học. */
export function courseStops(names: Iterable<string>): string[] {
    const decl = Object.keys(BUILDING_COURSE_IDS)
    const have = new Set(names)
    return decl
        .filter((n) => BUILDING_COURSE_IDS[n] && have.has(n))
        .sort((a, b) => (BUILDING_FACE_AZ[a] ?? 0) - (BUILDING_FACE_AZ[b] ?? 0) || decl.indexOf(a) - decl.indexOf(b))
}
