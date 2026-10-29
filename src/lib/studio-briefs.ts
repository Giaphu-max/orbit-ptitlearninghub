import { getConcept } from '@/data'
import { getBriefByConcept, getBriefById, STUDIO_BRIEFS } from '@/data/studio-briefs'
import type { StudioBrief } from '@/data/types'

export { STUDIO_BRIEFS, getBriefById }

/** Đề gắn với một khái niệm (link từ trang học bài: /studio?concept=…); không có thì undefined. */
export const getStudioBrief = (conceptId: string | null | undefined) => getBriefByConcept(conceptId)

/** Đề đang chọn theo URL: ?brief=<id> hoặc ?concept=<conceptId>, mặc định đề đầu tiên. */
export function resolveBrief(params: URLSearchParams): StudioBrief {
    return getBriefById(params.get('brief')) ?? getBriefByConcept(params.get('concept')) ?? STUDIO_BRIEFS[0]
}

/** Tên khái niệm của đề (dùng cho bộ lọc và thẻ đề). */
export const briefConceptNames = (b: StudioBrief) => b.conceptIds.flatMap((id) => getConcept(id)?.name ?? [])

/** Nhóm khái niệm dùng làm bộ lọc trong hộp thoại chọn đề. */
export const BRIEF_GROUPS: { title: string; ids: string[] }[] = [
    { title: 'Ánh sáng', ids: ['key-light', 'fill-light', 'back-light', 'practical-light'] },
    { title: 'Màu sắc', ids: ['cac-thuat-ngu-mau-sac', 'tam-ly-hoc-mau-sac', 'phoi-hop-mau-sac'] },
    { title: 'Ngôn ngữ hình ảnh', ids: ['ngon-ngu-thi-giac-dien-anh'] },
]
export const briefGroupOf = (b: StudioBrief) => BRIEF_GROUPS.find((g) => b.conceptIds.some((id) => g.ids.includes(id)))?.title
