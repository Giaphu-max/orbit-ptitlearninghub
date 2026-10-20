import type {
    Concept,
    DailyArticle,
    DailyBlock,
    Lesson,
    LessonQuizQuestion,
    QuizChoiceQuestion,
    SourceRef,
    TranscriptSegment,
} from '../../src/data/types.js'
import type { DailyDraft, LessonDraft } from './schemas.js'
import { normalizeName, normalizeTitle } from './vi-text.js'

// Hậu xử lý đầu ra Gemini thành dữ liệu sạch cho src/data/.
// Gemini làm tốt phần nội dung nhưng hay lệch ở chi tiết máy móc: mốc giờ chồng nhau,
// id có dấu, khái niệm nền vòng tròn, đáp án đúng dồn về một vị trí, dẫn nguồn sai mốc.
// Các hàm ở đây sửa được thì sửa và ghi cảnh báo, không sửa được thì báo lỗi.

type ChoiceDraft = LessonDraft['quiz'][number]['variants'][number]

export interface Report {
    warnings: string[]
    errors: string[]
}

export function slugify(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
}

/** RNG có seed để kết quả trộn đáp án ổn định giữa các lần chạy. */
function seededRandom(seed: string) {
    let h = 2166136261
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507)
        h = Math.imul(h ^ (h >>> 13), 3266489909)
        return ((h ^= h >>> 16) >>> 0) / 4294967296
    }
}

/** Trộn phương án để đáp án đúng không dồn về một vị trí. */
function shuffleOptions(q: { options: string[]; correctIndex: number }, seed: string) {
    const rand = seededRandom(seed)
    const order = q.options.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
    }
    return { options: order.map((i) => q.options[i].trim()), correctIndex: order.indexOf(q.correctIndex) }
}

function cleanTranscript(raw: LessonDraft['transcript'], durationSec: number | null, report: Report): TranscriptSegment[] {
    const segs = raw
        .map((s) => ({ start: Math.round(s.start), end: Math.round(s.end), text: s.text.trim() }))
        .filter((s) => s.text)
        .sort((a, b) => a.start - b.start)

    const out: TranscriptSegment[] = []
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i]
        if (durationSec !== null && seg.start >= durationSec) {
            report.warnings.push(`Bỏ đoạn transcript ở ${seg.start}s vì vượt độ dài video ${durationSec}s`)
            continue
        }
        const prev = out[out.length - 1]
        if (prev && seg.start <= prev.start) {
            // Hai đoạn cùng mốc bắt đầu: gộp lời vào đoạn trước
            prev.text = `${prev.text} ${seg.text}`
            prev.end = Math.max(prev.end, seg.end)
            continue
        }
        if (prev && prev.end > seg.start) prev.end = seg.start
        const next = segs[i + 1]
        let end = seg.end
        if (end <= seg.start) end = next ? next.start : seg.start + 10
        if (durationSec !== null) end = Math.min(end, durationSec)
        out.push({ start: seg.start, end, text: seg.text })
    }
    return out
}

/** Mốc bắt đầu đoạn transcript gần nhất ở trước hoặc đúng tại t. */
function snapToSegmentStart(t: number, transcript: TranscriptSegment[]) {
    let best = transcript[0].start
    for (const s of transcript) if (s.start <= t) best = s.start
    return best
}

/** Mốc kết thúc đoạn transcript đầu tiên ở sau hoặc đúng tại t. */
function snapToSegmentEnd(t: number, transcript: TranscriptSegment[]) {
    for (const s of transcript) if (s.end >= t) return s.end
    return transcript[transcript.length - 1].end
}

export interface LessonMeta {
    id: string
    courseId: string
    youtubeId: string
    /** Độ dài thật lấy từ YouTube; null nếu không lấy được */
    durationSec: number | null
}

export function normalizeLesson(draft: LessonDraft, meta: LessonMeta): { lesson: Lesson | null; report: Report } {
    const report: Report = { warnings: [], errors: [] }

    const transcript = cleanTranscript(draft.transcript, meta.durationSec, report)
    if (transcript.length < 3) {
        report.errors.push(`Transcript chỉ có ${transcript.length} đoạn hợp lệ`)
        return { lesson: null, report }
    }
    const durationSec = meta.durationSec ?? transcript[transcript.length - 1].end

    // Khái niệm: sắp theo thứ tự xuất hiện, id dạng slug không trùng
    const idMap = new Map<string, string>()
    const concepts: Concept[] = []
    for (const c of [...draft.concepts].sort((a, b) => a.segment.start - b.segment.start)) {
        let id = slugify(c.id || c.name) || `khai-niem-${concepts.length + 1}`
        while (concepts.some((x) => x.id === id)) id = `${id}-2`
        idMap.set(c.id, id)
        const start = snapToSegmentStart(Math.min(c.segment.start, c.segment.end), transcript)
        let end = snapToSegmentEnd(Math.max(c.segment.start, c.segment.end), transcript)
        if (end <= start) end = snapToSegmentEnd(start + 1, transcript)
        concepts.push({ id, name: normalizeName(c.name), definition: c.definition.trim(), segment: { start, end }, prerequisiteIds: c.prerequisiteIds })
    }
    // Chỉ giữ khái niệm nền xuất hiện trước trong bài: đảm bảo cây kỹ năng không có vòng
    concepts.forEach((c, idx) => {
        const earlier = new Set(concepts.slice(0, idx).map((x) => x.id))
        const mapped = c.prerequisiteIds.map((p) => idMap.get(p) ?? slugify(p))
        const kept = [...new Set(mapped.filter((p) => earlier.has(p)))]
        if (kept.length !== mapped.length) report.warnings.push(`Bỏ khái niệm nền không hợp lệ của "${c.id}": ${mapped.filter((p) => !kept.includes(p)).join(', ')}`)
        c.prerequisiteIds = kept
    })
    if (concepts.length < 2) report.errors.push(`Chỉ có ${concepts.length} khái niệm`)

    // Quiz: gắn đúng khái niệm, dừng sau khi giảng xong khái niệm, trộn phương án
    const quiz: LessonQuizQuestion[] = []
    const perConcept = new Map<string, number>()
    for (const q of draft.quiz) {
        const conceptId = idMap.get(q.conceptId) ?? slugify(q.conceptId)
        const concept = concepts.find((c) => c.id === conceptId)
        if (!concept) {
            report.warnings.push(`Bỏ câu hỏi "${q.prompt.slice(0, 40)}…" vì không khớp khái niệm "${q.conceptId}"`)
            continue
        }
        const n = (perConcept.get(conceptId) ?? 0) + 1
        perConcept.set(conceptId, n)
        const id = `q-${conceptId}-${n}`
        // Đoạn chứa đáp án: khớp ranh giới transcript; hỏng thì lấy đoạn giảng khái niệm
        const aStart = Math.min(q.answerSegment.start, q.answerSegment.end)
        const aEnd = Math.max(q.answerSegment.start, q.answerSegment.end)
        let answerSegment = { start: snapToSegmentStart(aStart, transcript), end: snapToSegmentEnd(aEnd, transcript) }
        if (answerSegment.end <= answerSegment.start || answerSegment.start >= durationSec) {
            report.warnings.push(`Câu ${id}: đoạn chứa đáp án không hợp lệ, dùng đoạn giảng khái niệm`)
            answerSegment = { ...concept.segment }
        }
        // Dừng sau khi giảng xong khái niệm và sau khi đã nói ra đáp án
        const pauseAt = Math.min(snapToSegmentEnd(Math.max(q.pauseAt, concept.segment.end, answerSegment.end), transcript), durationSec - 1)
        if (pauseAt !== q.pauseAt) report.warnings.push(`Câu ${id}: dời điểm dừng ${q.pauseAt}s → ${pauseAt}s (sau đoạn giảng khái niệm)`)

        const toChoice = (c: ChoiceDraft, qid: string): QuizChoiceQuestion => ({
            id: qid,
            conceptId,
            prompt: c.prompt.trim(),
            ...shuffleOptions(c, qid),
            explanation: c.explanation.trim(),
        })
        for (const c of [q, ...q.variants]) {
            if (new Set(c.options.map((o) => o.trim().toLowerCase())).size !== c.options.length) {
                report.warnings.push(`Câu ${id}: có phương án trùng nhau ("${c.prompt.slice(0, 40)}…")`)
            }
        }
        quiz.push({
            ...toChoice(q, id),
            pauseAt,
            answerSegment,
            variants: q.variants.map((v, i) => toChoice(v, `${id}-v${i + 1}`)),
        })
    }
    quiz.sort((a, b) => a.pauseAt - b.pauseAt)
    if (quiz.length < 1) report.errors.push('Không có câu hỏi quiz hợp lệ')
    const uncovered = concepts.filter((c) => !quiz.some((q) => q.conceptId === c.id))
    if (uncovered.length) report.warnings.push(`Khái niệm chưa có câu hỏi: ${uncovered.map((c) => c.id).join(', ')}`)

    if (report.errors.length) return { lesson: null, report }
    return {
        lesson: {
            id: meta.id,
            courseId: meta.courseId,
            title: normalizeTitle(draft.title),
            ...(draft.shortTitle?.trim() ? { shortTitle: normalizeName(draft.shortTitle) } : {}),
            youtubeId: meta.youtubeId,
            durationSec,
            summary: draft.summary.trim(),
            concepts,
            transcript,
            quiz,
            origin: 'gemini',
            status: 'draft',
        },
        report,
    }
}

/** Gắn nguồn về đúng đầu đoạn transcript chứa mốc đó (lệch tối đa 15 giây), sai thì bỏ. */
function resolveSource(src: SourceRef, lessons: Lesson[]): SourceRef | null {
    const lesson = lessons.find((l) => l.id === src.lessonId)
    if (!lesson) return null
    const containing = lesson.transcript.find((s) => src.start >= s.start && src.start < s.end)
    if (containing) return { lessonId: lesson.id, start: containing.start }
    const nearest = lesson.transcript.reduce((a, b) => (Math.abs(b.start - src.start) < Math.abs(a.start - src.start) ? b : a))
    return Math.abs(nearest.start - src.start) <= 15 ? { lessonId: lesson.id, start: nearest.start } : null
}

const MARK = /\{\{([^|}]*)\|([^}]*)\}\}/g

/** Giữ dấu khái niệm hợp lệ `{{id|chữ}}`; id lạ thì bỏ dấu, giữ chữ. Dấu `{{` lỗi còn sót thì xóa. */
function cleanMarks(text: string, known: Set<string>, keep: boolean): string {
    // Dấu hợp lệ tạm đổi sang ký tự private-use để bước xóa `{{`/`}}` lỗi còn sót không đụng tới
    const out = text.replace(MARK, (_m, id: string, label: string) => (keep && known.has(id.trim()) ? `\uE000${id.trim()}|${label.trim()}\uE001` : label.trim()))
    return out.replace(/\{\{|\}\}/g, '').replace(/\uE000/g, '{{').replace(/\uE001/g, '}}').trim()
}

export function normalizeDaily(draft: DailyDraft, lessons: Lesson[]): { articles: DailyArticle[]; report: Report } {
    const report: Report = { warnings: [], errors: [] }
    const knownConcepts = new Set(lessons.flatMap((l) => l.concepts.map((c) => c.id)))
    const articles: DailyArticle[] = []

    draft.articles.forEach((a, idx) => {
        const label = `Bài Daily "${a.title.slice(0, 40)}"`
        const conceptIds = [...new Set(a.conceptIds.filter((c) => knownConcepts.has(c)))]
        if (!conceptIds.length) {
            report.warnings.push(`${label}: bỏ vì không gắn được khái niệm nào`)
            return
        }

        // Id theo vị trí trong lượt tạo, không theo tiêu đề: tiêu đề sửa hay chuẩn hóa lại thì link và tiến độ đã lưu không mất
        const id = `daily-${idx + 1}`
        let checkNo = 0
        const blocks: DailyBlock[] = []
        for (const b of a.blocks) {
            const seen = new Set<string>()
            const sources = b.sources
                .map((s) => resolveSource(s, lessons))
                .filter((s): s is SourceRef => !!s && !seen.has(`${s.lessonId}@${s.start}`) && !!seen.add(`${s.lessonId}@${s.start}`))
            if (!sources.length) {
                report.warnings.push(`${label}: bỏ một khối ${b.type} không có nguồn hợp lệ`)
                continue
            }
            const marked = b.type !== 'quote'
            const text = cleanMarks(b.text ?? '', knownConcepts, marked)
            if (b.type === 'bullets') {
                const items = (b.items ?? []).map((i) => cleanMarks(i, knownConcepts, true)).filter(Boolean)
                if (items.length < 2) report.warnings.push(`${label}: bỏ khối bullets có dưới 2 ý`)
                else blocks.push({ type: 'bullets', items, sources })
            } else if (b.type === 'check') {
                const c = b.question
                if (!c) {
                    report.warnings.push(`${label}: bỏ khối check thiếu câu hỏi`)
                    continue
                }
                const qid = `${id}-c${++checkNo}`
                blocks.push({
                    type: 'check',
                    sources,
                    question: {
                        id: qid,
                        conceptId: knownConcepts.has(c.conceptId) ? c.conceptId : conceptIds[0],
                        prompt: c.prompt.trim(),
                        ...shuffleOptions(c, qid),
                        explanation: c.explanation.trim(),
                    },
                })
            } else if (text) {
                // Nhãn "Điểm cốt lõi" đã có ở giao diện, bỏ phần Gemini tự thêm vào đầu câu
                blocks.push({ type: b.type, text: b.type === 'keypoint' ? text.replace(/^điểm cốt lõi\s*[:：-]\s*/i, '') : text, sources })
            }
        }

        const count = (t: DailyBlock['type']) => blocks.filter((b) => b.type === t).length
        if (!count('check')) {
            report.warnings.push(`${label}: bỏ vì không có câu kiểm tra`)
            return
        }
        if (count('paragraph') + count('keypoint') + count('example') < 3) {
            report.warnings.push(`${label}: bỏ vì còn quá ít khối nội dung`)
            return
        }
        // hook phải đứng đầu, check dồn về cuối
        blocks.sort((x, y) => rank(x.type) - rank(y.type))

        // Daily là bài tổng hợp: nguồn phải đến từ ít nhất 2 bài giảng khác nhau
        const sourceLessons = new Set(blocks.flatMap((b) => b.sources.map((s) => s.lessonId)))
        if (sourceLessons.size < 2) {
            report.warnings.push(`${label}: bỏ vì chỉ dẫn nguồn từ ${sourceLessons.size} bài giảng (cần ít nhất 2)`)
            return
        }

        const marks = blocks.reduce((n, b) => n + (b.type === 'bullets' ? b.items : b.type === 'check' ? [] : [b.text]).reduce((m, t) => m + (t.match(MARK)?.length ?? 0), 0), 0)
        if (marks < 2) report.warnings.push(`${label}: chỉ có ${marks} từ khóa được đánh dấu`)

        const words = blocks.reduce((n, b) => n + (b.type === 'bullets' ? b.items.join(' ') : b.type === 'check' ? '' : b.text).replace(MARK, '$2').split(/\s+/).length, 0)
        articles.push({
            id,
            title: normalizeTitle(a.title),
            readingMinutes: Math.min(3, Math.max(1, Math.round(words / 150))),
            conceptIds,
            blocks,
            origin: 'gemini',
        })
    })
    const covered = new Set(articles.flatMap((a) => a.conceptIds))
    const missing = [...knownConcepts].filter((c) => !covered.has(c))
    if (missing.length) report.warnings.push(`Khái niệm chưa có bài Daily nào: ${missing.join(', ')}`)
    return { articles, report }
}

/** Thứ tự cố định: hook, nội dung, check. Giữ nguyên thứ tự Gemini trong từng nhóm (sort ổn định). */
const rank = (t: DailyBlock['type']) => (t === 'hook' ? 0 : t === 'check' ? 2 : 1)
