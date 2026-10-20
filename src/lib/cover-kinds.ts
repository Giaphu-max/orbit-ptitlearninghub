// Họa tiết và màu nhấn của bìa khóa học. File thuần (không import gì) để cả giao diện lẫn scripts/generate-content.ts dùng chung.

export const COVER_MOTIFS = ['timeline', 'light', 'wave', 'grid', 'shapes'] as const
export type CoverMotif = (typeof COVER_MOTIFS)[number]

/** Tên màu nhấn = hậu tố của token --subject-* trong index.css */
export const COVER_ACCENTS = ['film', 'photo', 'audio', 'design', 'default'] as const
export type CoverAccent = (typeof COVER_ACCENTS)[number]

export const MOTIF_LABELS: Record<CoverMotif, string> = {
    timeline: 'Dòng thời gian dựng phim',
    light: 'Ánh sáng và ống kính',
    wave: 'Sóng âm',
    grid: 'Lưới bố cục',
    shapes: 'Khối hình học',
}

/** Bìa lưu trong courses.json; mọi trường đều tùy chọn (thiếu thì suy từ môn học). */
export interface CourseCoverSpec {
    motif?: CoverMotif
    accent?: CoverAccent
    seed?: number
}

/** Họa tiết và màu nhấn suy từ tên môn khi khóa chưa có cover. */
export function deriveCover(subject: string): { motif: CoverMotif; accent: CoverAccent } {
    switch (subject) {
        case 'Dựng phim':
            return { motif: 'timeline', accent: 'film' }
        case 'Nhiếp ảnh':
            return { motif: 'light', accent: 'photo' }
        case 'Âm thanh':
            return { motif: 'wave', accent: 'audio' }
        case 'Thiết kế':
            return { motif: 'grid', accent: 'design' }
        default:
            return { motif: 'shapes', accent: 'default' }
    }
}
