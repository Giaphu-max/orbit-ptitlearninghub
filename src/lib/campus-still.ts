// Ảnh tĩnh khuôn viên (public/brand/campus-still.webp) thay cảnh 3D trong lúc intro chạy. Ảnh được chụp từ chính cảnh R3F
// (mở trang chủ với ?campussnap ở môi trường dev, xem FrameDriver trong campus-scene.tsx) nên khớp với 3D thật.

export const CAMPUS_STILL_URL = '/brand/campus-still.webp'

let p: Promise<HTMLImageElement | null> | null = null

/** Tải + decode sẵn ảnh; resolve null nếu chưa có file/lỗi (khi đó trang dùng ảnh minh họa SVG cũ). */
export function loadCampusStill(): Promise<HTMLImageElement | null> {
    p ??= new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image()
        img.src = CAMPUS_STILL_URL
        img.decode().then(
            () => resolve(img),
            () => resolve(null),
        )
    })
    return p
}
