// Dữ liệu cho hộp "Thêm bài giảng từ YouTube" (bản demo, GIẢ LẬP: không gọi Gemini lúc bấm).
//
// TODO: nội dung dưới đây tạm lấy từ ba bài đã có (transcript, tóm tắt, khái niệm, câu hỏi + biến thể), đổi id để không trùng số liệu lớp.
// Khi có danh sách phát thật của khoa: thêm video vào scripts/content.config.json, chạy `npx tsx scripts/generate-content.ts --out <thư mục>`
// (cần GEMINI_API_KEY trong .env.local), rồi thay `template` bằng bài sinh ra, điền videoId/tên/thời lượng thật.
import { staticLessons } from '@/data'
import type { Course, Lesson } from '@/data/types'

export interface SampleVideo {
    /** Bài có sẵn dùng làm nội dung đã tạo */
    template: string
}

export const SAMPLE_PLAYLIST = {
    listId: 'PLptitDemoAnhSang',
    title: 'Ánh sáng và màu sắc trong hình ảnh (danh sách phát mẫu)',
    url: 'https://www.youtube.com/playlist?list=PLptitDemoAnhSang',
    videos: [{ template: 'ba-loai-anh-sang-co-ban' }, { template: 'nguyen-ly-mau-sac' }, { template: 'tu-duy-nhiep-anh' }] as SampleVideo[],
}

export interface SampleItem {
    key: string
    videoId: string
    title: string
    durationSec: number
}

export function sampleItems(): SampleItem[] {
    return SAMPLE_PLAYLIST.videos.flatMap((v) => {
        const l = staticLessons.find((x) => x.id === v.template)
        return l ? [{ key: v.template, videoId: l.youtubeId, title: l.title, durationSec: l.durationSec }] : []
    })
}

export type ParsedLink = { kind: 'video'; videoId: string } | { kind: 'playlist'; listId: string }

/** Nhận diện link video (watch?v=, youtu.be/) hoặc danh sách phát (list=); sai thì null. */
export function parseYoutubeLink(raw: string): ParsedLink | null {
    const text = raw.trim()
    let url: URL
    try {
        url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    } catch {
        return null
    }
    const host = url.hostname.replace(/^www\.|^m\./, '')
    const list = url.searchParams.get('list')
    if (list && /^[\w-]{10,}$/.test(list) && (host === 'youtube.com' || host === 'youtu.be')) return { kind: 'playlist', listId: list }
    if (host === 'youtube.com') {
        const v = url.searchParams.get('v')
        if (v && /^[\w-]{11}$/.test(v) && url.pathname === '/watch') return { kind: 'video', videoId: v }
    }
    if (host === 'youtu.be') {
        const v = url.pathname.slice(1)
        if (/^[\w-]{11}$/.test(v)) return { kind: 'video', videoId: v }
    }
    return null
}

/** Bài nhập từ YouTube: nội dung đã tạo sẵn (xem TODO), trạng thái nháp để giảng viên duyệt. */
export function buildImportedLesson(item: SampleItem, courseId: string): Lesson | null {
    const tpl = staticLessons.find((x) => x.id === item.key)
    if (!tpl) return null
    let json = JSON.stringify(tpl)
    const ids = [...tpl.concepts.map((c) => c.id), ...tpl.quiz.flatMap((q) => [q.id, ...q.variants.map((v) => v.id)])]
    for (const id of ids) json = json.split(`"${id}"`).join(`"${id}__imp"`)
    const copy = JSON.parse(json) as Lesson
    return { ...copy, id: `imp-${item.videoId}`, courseId, status: 'draft', origin: 'gemini' }
}

export function buildImportedCourse(): Course {
    return {
        id: `imp-${SAMPLE_PLAYLIST.listId}`,
        title: SAMPLE_PLAYLIST.title,
        subject: 'Nhiếp ảnh',
        instructor: 'Khoa Đa phương tiện, PTIT',
        description: 'Khóa học tạo từ danh sách phát YouTube (bản demo).',
        lessonIds: [],
        cover: { motif: 'light', accent: 'photo', seed: 3 },
    }
}
