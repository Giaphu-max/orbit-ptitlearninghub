import type { Concept, Lesson, LessonQuizQuestion, QuizChoiceQuestion, TranscriptSegment } from './types'
import { DEMO_VIDEO_TRANSCRIPT } from './demo-video'

/**
 * Nội dung bài giảng mẫu cho video giảng viên tải lên (bản demo không có AI xử lý video thật): transcript, khái niệm, câu hỏi dừng video
 * và câu biến thể được viết sẵn. Thời gian được co giãn cho vừa độ dài video nền để mốc dừng quiz luôn nằm trong video.
 */
export const SAMPLE_SOURCE_SEC = 492

interface ConceptDef {
    key: string
    name: string
    definition: string
    seg: [number, number]
    pre: string[]
}
const CONCEPTS: ConceptDef[] = [
    { key: 'c1', name: 'Bốn nhóm âm thanh', definition: 'Âm thanh trong bản dựng chia thành lời thoại, nhạc, hiệu ứng và âm nền, mỗi nhóm đặt trên track riêng để chỉnh âm lượng độc lập.', seg: [38, 132], pre: [] },
    { key: 'c2', name: 'Âm nền và hiệu ứng', definition: 'Âm nền (room tone) lấp khoảng lặng giữa các đoạn thoại; hiệu ứng âm thanh (foley, SFX) làm thế giới trong phim thật hơn và khớp từng hành động.', seg: [132, 226], pre: ['c1'] },
    { key: 'c3', name: 'J-cut và L-cut', definition: 'J-cut cho âm thanh cảnh sau vào trước khi đổi hình; L-cut giữ âm thanh cảnh trước chạy sang cảnh sau, giúp chuyển cảnh mềm.', seg: [275, 322], pre: ['c2'] },
]

interface QuizDef {
    n: number
    concept: string
    pauseAt: number
    answer: [number, number]
    prompt: string
    options: string[]
    correct: number
    explanation: string
    variant: { prompt: string; options: string[]; correct: number; explanation: string }
}
const QUIZ: QuizDef[] = [
    {
        n: 1,
        concept: 'c1',
        pauseAt: 132,
        answer: [85, 132],
        prompt: 'Khi trộn âm, nhóm âm thanh nào được dùng làm mức chuẩn để các nhóm khác hạ xuống theo?',
        options: ['Nhạc phim', 'Lời thoại', 'Hiệu ứng âm thanh', 'Âm nền'],
        correct: 1,
        explanation: 'Lời thoại luôn phải nghe rõ nên mức lời thoại được đặt làm chuẩn, nhạc và hiệu ứng hạ xuống để không che lời nói.',
        variant: {
            prompt: 'Vì sao các nhóm âm thanh nên đặt trên các track riêng?',
            options: ['Để file nhẹ hơn', 'Để chỉnh âm lượng từng nhóm độc lập với nhau', 'Để phần mềm xuất nhanh hơn', 'Để không cần trộn âm'],
            correct: 1,
            explanation: 'Mỗi nhóm nằm trên track riêng thì có thể chỉnh âm lượng độc lập, ví dụ hạ nhạc mà không đổi lời thoại.',
        },
    },
    {
        n: 2,
        concept: 'c2',
        pauseAt: 178,
        answer: [132, 178],
        prompt: 'Room tone (âm nền) được thu thêm ở mỗi cảnh để làm gì?',
        options: ['Làm nhạc nền cho cảnh', 'Lấp khoảng lặng giữa các đoạn thoại để âm thanh không bị đứt', 'Thay cho lời thoại bị lỗi', 'Tăng âm lượng tổng thể'],
        correct: 1,
        explanation: 'Room tone là tiếng không khí của không gian quay, dùng lấp những khoảng lặng để tránh cảm giác âm thanh bị đứt.',
        variant: {
            prompt: 'Tiếng bước chân, tiếng cửa được thêm vào sau khi quay thuộc nhóm âm thanh nào?',
            options: ['Lời thoại', 'Nhạc phim', 'Hiệu ứng âm thanh (foley, SFX)', 'Âm nền'],
            correct: 2,
            explanation: 'Foley và SFX là hiệu ứng được thêm vào sau, khớp với từng hành động trên hình để thế giới trong phim có thật hơn.',
        },
    },
    {
        n: 3,
        concept: 'c3',
        pauseAt: 322,
        answer: [275, 322],
        prompt: 'Trong kỹ thuật L-cut, điều gì xảy ra?',
        options: ['Âm thanh cảnh sau vào trước khi hình đổi', 'Âm thanh cảnh trước chạy tiếp sang cảnh sau', 'Hình và tiếng cắt cùng một lúc', 'Âm thanh bị tắt khi chuyển cảnh'],
        correct: 1,
        explanation: 'L-cut giữ âm thanh của cảnh trước chạy tiếp sang cảnh sau; còn J-cut thì ngược lại, cho âm thanh cảnh sau vào trước.',
        variant: {
            prompt: 'Cho âm thanh của cảnh tiếp theo vào trước khi hình đổi là kỹ thuật nào?',
            options: ['J-cut', 'L-cut', 'Cắt thẳng', 'Fade out'],
            correct: 0,
            explanation: 'J-cut là cho âm thanh cảnh sau vào trước khi đổi hình, giúp chuyển cảnh mềm và tự nhiên hơn.',
        },
    },
]

/** Dựng một bài mẫu hoàn chỉnh với id/khóa/video cho trước; `durationSec` là độ dài video nền. */
export function makeSampleLesson(opts: { id: string; courseId: string; title: string; youtubeId: string; durationSec: number }): Lesson {
    const k = opts.durationSec / SAMPLE_SOURCE_SEC
    const t = (sec: number) => Math.round(sec * k)
    const transcript: TranscriptSegment[] = DEMO_VIDEO_TRANSCRIPT.map((s) => ({ start: t(s.start), end: t(s.end), text: s.text }))
    const cid = (key: string) => `${opts.id}-${key}`
    const concepts: Concept[] = CONCEPTS.map((c) => ({ id: cid(c.key), name: c.name, definition: c.definition, segment: { start: t(c.seg[0]), end: t(c.seg[1]) }, prerequisiteIds: c.pre.map(cid) }))
    const quiz: LessonQuizQuestion[] = QUIZ.map((q) => {
        const v: QuizChoiceQuestion = { id: `${opts.id}-q${q.n}v1`, conceptId: cid(q.concept), prompt: q.variant.prompt, options: q.variant.options, correctIndex: q.variant.correct, explanation: q.variant.explanation }
        return { id: `${opts.id}-q${q.n}`, conceptId: cid(q.concept), prompt: q.prompt, options: q.options, correctIndex: q.correct, explanation: q.explanation, pauseAt: t(q.pauseAt), answerSegment: { start: t(q.answer[0]), end: t(q.answer[1]) }, variants: [v] }
    })
    return {
        id: opts.id,
        courseId: opts.courseId,
        title: opts.title,
        youtubeId: opts.youtubeId,
        durationSec: opts.durationSec,
        summary: 'Âm thanh quyết định một nửa cảm xúc của người xem. Bài giảng giới thiệu bốn nhóm âm thanh, vai trò của âm nền và hiệu ứng, và kỹ thuật J-cut, L-cut để chuyển cảnh mềm.',
        concepts,
        transcript,
        quiz,
        origin: 'sample',
        status: 'published',
    }
}
