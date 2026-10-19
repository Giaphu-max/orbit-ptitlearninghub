/**
 * Tạo nội dung học từ video YouTube bằng Gemini, ghi ra src/data/.
 *
 *   npx tsx scripts/generate-content.ts                 # tạo các bài chưa có trong cache + bài đọc Daily
 *   npx tsx scripts/generate-content.ts --only bai-1    # chỉ (tạo lại) một bài
 *   npx tsx scripts/generate-content.ts --force         # bỏ qua cache, gọi Gemini lại toàn bộ
 *   npx tsx scripts/generate-content.ts --skip-daily    # không tạo bài đọc Daily
 *   npx tsx scripts/generate-content.ts --model gemini-3.8-flash --config path --out dir
 *
 * Danh sách video nằm trong scripts/content.config.json. Cần GEMINI_API_KEY trong .env.local.
 * Kết quả thô của Gemini được cache ở scripts/.cache/ để chạy lại (chỉnh hậu xử lý)
 * không tốn thêm lượt API. Trạng thái ban đầu lấy từ "status" trong config (mặc định draft để giảng viên duyệt).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { ApiError, MediaResolution } from '@google/genai'
import { z } from 'zod'
import type { Badge, Course, DailyArticle, Lesson } from '../src/data/types.js'
import { getGemini, withFallback } from '../api/_lib/gemini.js'
import { DailyDraft, LessonDraft, LessonDraftWire, fromWireDraft, toGeminiSchema } from './lib/schemas.js'
import { normalizeDaily, normalizeLesson, type Report } from './lib/postprocess.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE_DIR = path.join(ROOT, 'scripts/.cache')

const { values: args } = parseArgs({
    options: {
        only: { type: 'string' },
        force: { type: 'boolean', default: false },
        'skip-daily': { type: 'boolean', default: false },
        model: { type: 'string' },
        config: { type: 'string', default: path.join(ROOT, 'scripts/content.config.json') },
        out: { type: 'string', default: path.join(ROOT, 'src/data') },
    },
})

try {
    process.loadEnvFile(path.join(ROOT, '.env.local'))
} catch {
    // Không có .env.local: dùng biến môi trường sẵn có
}
if (args.model) process.env.GEMINI_MODEL = args.model

// ── Config ───────────────────────────────────────────────────────────────────

const Config = z.object({
    dailyCount: z.number().int().min(0).max(20).default(6),
    /** Trạng thái duyệt khi mới tạo; bản demo đặt published để sinh viên thấy ngay, giảng viên vẫn gỡ/duyệt lại được */
    status: z.enum(['draft', 'published']).default('draft'),
    courses: z.array(
        z.object({
            id: z.string().regex(/^[a-z0-9-]+$/, 'id chỉ gồm a-z, 0-9 và gạch ngang'),
            title: z.string(),
            subject: z.string(),
            instructor: z.string(),
            description: z.string(),
            lessons: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), url: z.string().url() })).min(1),
        }),
    ),
})

function loadConfig() {
    const parsed = Config.safeParse(JSON.parse(readFileSync(args.config!, 'utf8')))
    if (!parsed.success) fail(`Config không hợp lệ (${args.config}):\n${z.prettifyError(parsed.error)}`)
    const ids = parsed.data.courses.flatMap((c) => c.lessons.map((l) => l.id))
    const dup = ids.find((id, i) => ids.indexOf(id) !== i)
    if (dup) fail(`Trùng id bài học trong config: ${dup}`)
    return parsed.data
}

// ── Tiện ích ─────────────────────────────────────────────────────────────────

function fail(message: string): never {
    console.error(`\n✖ ${message}`)
    process.exit(1)
}

function stopQuota(err: Error, at: string): never {
    console.error(`\n⛔ DỪNG: hết lượt/quá tải ở ${at}. ${err.message}`)
    console.error('Các bài đã tạo xong được lưu ở scripts/.cache (chạy lại sẽ bỏ qua). src/data chưa bị ghi đè.')
    console.error('Hãy chờ hạn mức được cấp lại (thường 0h giờ Thái Bình Dương) hoặc đổi GEMINI_API_KEY, rồi chạy lại.')
    process.exit(2)
}

function printReport(label: string, report: Report) {
    for (const w of report.warnings) console.log(`   ⚠ ${w}`)
    for (const e of report.errors) console.log(`   ✖ ${e}`)
    if (!report.warnings.length && !report.errors.length) console.log(`   ✓ ${label}: không có cảnh báo`)
}

function readJson<T>(file: string): T | null {
    try {
        return JSON.parse(readFileSync(file, 'utf8')) as T
    } catch {
        return null
    }
}

function writeJson(file: string, data: unknown) {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

export function youtubeIdFromUrl(url: string): string | null {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.hostname.endsWith('youtube.com')) {
        if (u.pathname === '/watch') return u.searchParams.get('v')
        const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/)
        if (m) return m[2]
    }
    return null
}

/** Kiểm tra video công khai (oEmbed) và lấy độ dài thật từ trang xem (best effort). */
async function fetchVideoMeta(youtubeId: string) {
    const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`
    const oembed = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`)
    if (!oembed.ok) throw new Error(`Video ${youtubeId} không công khai hoặc không tồn tại (oEmbed ${oembed.status})`)
    const { title, author_name } = (await oembed.json()) as { title: string; author_name: string }

    let durationSec: number | null = null
    try {
        const html = await (await fetch(watchUrl, { headers: { 'Accept-Language': 'vi,en' } })).text()
        const m = html.match(/"lengthSeconds":"(\d+)"/)
        if (m) durationSec = Number(m[1])
    } catch {
        // Không lấy được: dùng mốc cuối transcript
    }
    return { title, author: author_name, durationSec }
}

// ── Gemini ───────────────────────────────────────────────────────────────────

const lessonPrompt = (durationSec: number | null) => `Bạn là trợ lý soạn học liệu cho giảng viên khoa Đa phương tiện, Học viện Công nghệ Bưu chính Viễn thông (PTIT).
Xem toàn bộ video bài giảng đính kèm và tạo học liệu theo schema JSON.${durationSec === null ? '' : ` Video dài ${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}.`}

Yêu cầu:
- Mọi nội dung phải bám sát những gì giảng viên nói và trình chiếu trong video. Không thêm kiến thức ngoài video; chỗ nào không chắc thì bỏ qua.
- Viết bằng tiếng Việt. Nếu video không nói tiếng Việt, transcript dịch sang tiếng Việt tự nhiên, giữ nguyên thuật ngữ chuyên ngành quen dùng (ví dụ: timeline, clip, transition).
- Mọi mốc thời gian viết dạng MM:SS đúng như đồng hồ của trình phát video (ví dụ 03:47), tính từ đầu video, khớp thời điểm thực tế câu đó được nói/hiện ra. Không vượt quá độ dài video.
- transcript: phủ từ đầu tới cuối video, mỗi đoạn 15–45 giây, cắt ở ranh giới câu; bỏ tiếng ậm ừ, lặp từ.
- concepts: 3–6 khái niệm cốt lõi theo thứ tự xuất hiện; segment là đoạn giảng chính khái niệm đó; prerequisiteIds chỉ chứa khái niệm xuất hiện trước trong cùng bài mà khái niệm này thực sự dựa vào.
- quiz: 4–6 câu, mỗi khái niệm quan trọng một câu, pauseAt ngay sau khi giảng xong khái niệm đó; answerSegment là đoạn video giảng viên nói ra đáp án (thường trùng đoạn giảng khái niệm, 10–60 giây). Câu hỏi kiểm tra hiểu và vận dụng (tình huống dựng phim thực tế, chọn thao tác phù hợp…), không hỏi chi tiết vụn vặt. 4 phương án, phương án sai là những hiểu lầm sinh viên hay mắc. Mỗi câu kèm đúng 1 câu biến thể cùng khái niệm, cùng độ khó, khác tình huống.`

function dailyPrompt(lessons: Lesson[], count: number) {
    const context = lessons
        .map((l) => {
            const concepts = l.concepts.map((c) => `  - ${c.id}: ${c.name} — ${c.definition}`).join('\n')
            const transcript = l.transcript.map((s) => `  [lessonId=${l.id} start=${s.start}] ${s.text}`).join('\n')
            return `### Bài "${l.title}" (lessonId=${l.id})\nKhái niệm:\n${concepts}\nTranscript:\n${transcript}`
        })
        .join('\n\n')
    return `Bạn soạn "Orbit Daily": bài đọc ngắn 2–3 phút giúp sinh viên ôn lại kiến thức từ các bài giảng dưới đây.

Viết ${count} bài đọc. Yêu cầu:
- Mỗi bài tập trung 1–3 khái niệm, ưu tiên nối kiến thức giữa các bài giảng khác nhau.
- Tổng 350–500 chữ (đọc 2–3 phút): 4–5 đoạn, mỗi đoạn 80–110 chữ, giọng gần gũi, có ví dụ tình huống thực tế trong chủ đề của video.
- Chỉ dùng kiến thức có trong transcript. Mỗi đoạn có ít nhất một nguồn {lessonId, start} lấy ĐÚNG các giá trị lessonId và start trong ngoặc vuông của đoạn transcript chứa ý đó.
- conceptIds lấy đúng id trong danh sách khái niệm.
- checks: 1–2 câu kiểm tra nhanh 4 phương án, trả lời được nếu đọc kỹ bài.
- Các bài không trùng nội dung với nhau.

${context}`
}

/** Mọi model trong danh sách dự phòng đều hết lượt/quá tải: dừng cả lượt chạy, không thử tiếp. */
class QuotaExhausted extends Error {}

let usedModel = ''

async function generateJson<T>(schema: z.ZodType<T>, parts: object[], extraConfig: object = {}): Promise<T> {
    const gemini = getGemini()
    const res = await withFallback(gemini, (model) => {
        console.log(`   … gọi ${model}`)
        usedModel = model
        return gemini.ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: 'application/json',
                responseJsonSchema: toGeminiSchema(schema),
                temperature: 0.3,
                ...extraConfig,
            },
        })
    }).catch((err) => {
        if (err instanceof ApiError && (err.status === 429 || err.status === 503)) {
            const models = [...new Set([gemini.model, ...gemini.fallbackModels])].join(', ')
            throw new QuotaExhausted(`Gemini trả ${err.status} ở tất cả model (${models}).`)
        }
        throw err
    })
    let raw: unknown
    try {
        raw = JSON.parse(res.text ?? '')
    } catch {
        throw new Error(`Gemini trả về không phải JSON:\n${res.text?.slice(0, 500)}`)
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) throw new Error(`JSON sai cấu trúc:\n${z.prettifyError(parsed.error)}`)
    return parsed.data
}

// ── Chạy ─────────────────────────────────────────────────────────────────────

interface LessonCache {
    url: string
    youtubeId: string
    durationSec: number | null
    videoTitle: string
    model: string
    generatedAt: string
    draft: LessonDraft
    /** Phiên bản mốc thời gian MM:SS; cache cũ (số giây) bị bỏ qua */
    format: 'clock-v1'
}

async function main() {
    const config = loadConfig()
    const lessonsOut: Lesson[] = []
    const coursesOut: Course[] = []
    const failed: string[] = []
    let regenerated = false

    const existingLessons = readJson<Lesson[]>(path.join(args.out!, 'lessons.json')) ?? []

    for (const course of config.courses) {
        const lessonIds: string[] = []
        for (const item of course.lessons) {
            const label = `${course.id}/${item.id}`
            // --only: giữ nguyên các bài khác từ lessons.json hiện có
            if (args.only && args.only !== item.id) {
                const kept = existingLessons.find((l) => l.id === item.id && l.origin === 'gemini')
                if (kept) {
                    lessonsOut.push(kept)
                    lessonIds.push(kept.id)
                }
                continue
            }
            console.log(`\n▶ ${label}  ${item.url}`)
            try {
                const youtubeId = youtubeIdFromUrl(item.url)
                if (!youtubeId) throw new Error('Không đọc được id video từ link YouTube')

                const cacheFile = path.join(CACHE_DIR, 'lessons', `${item.id}.json`)
                let cache = readJson<LessonCache>(cacheFile)
                if (cache && cache.url === item.url && cache.format === 'clock-v1' && !args.force) {
                    console.log(`   ↺ dùng cache (${cache.model}, ${cache.generatedAt})`)
                } else {
                    const meta = await fetchVideoMeta(youtubeId)
                    console.log(`   video: "${meta.title}" – ${meta.author}, ${meta.durationSec ?? '?'}s`)
                    const wire = await generateJson(
                        LessonDraftWire,
                        [
                            { fileData: { fileUri: `https://www.youtube.com/watch?v=${youtubeId}`, mimeType: 'video/*' } },
                            { text: lessonPrompt(meta.durationSec) },
                        ],
                        // Độ phân giải thấp đủ để đọc slide, tiết kiệm token cho video dài
                        { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW },
                    )
                    const draft = fromWireDraft(wire)
                    cache = {
                        url: item.url,
                        youtubeId,
                        durationSec: meta.durationSec,
                        videoTitle: meta.title,
                        model: usedModel,
                        generatedAt: new Date().toISOString(),
                        draft,
                        format: 'clock-v1',
                    }
                    writeJson(cacheFile, cache)
                    regenerated = true
                }

                const { lesson, report } = normalizeLesson(cache.draft, {
                    id: item.id,
                    courseId: course.id,
                    youtubeId,
                    durationSec: cache.durationSec,
                })
                printReport(label, report)
                if (!lesson) throw new Error('Nội dung không đạt yêu cầu tối thiểu (xem lỗi ở trên)')
                lesson.status = config.status
                console.log(`   ✓ "${lesson.title}": ${lesson.transcript.length} đoạn, ${lesson.concepts.length} khái niệm, ${lesson.quiz.length} câu hỏi`)
                lessonsOut.push(lesson)
                lessonIds.push(lesson.id)
            } catch (err) {
                if (err instanceof QuotaExhausted) stopQuota(err, `bài ${label}`)
                console.error(`   ✖ ${label}: ${err instanceof Error ? err.message : err}`)
                failed.push(label)
            }
        }
        if (lessonIds.length) {
            const { lessons: _, ...rest } = course
            coursesOut.push({ ...rest, lessonIds })
        }
    }

    if (!lessonsOut.length) fail('Không tạo được bài học nào, không ghi đè src/data.')

    // ── Orbit Daily ──
    let daily: DailyArticle[] = readJson<DailyArticle[]>(path.join(args.out!, 'daily.json'))?.filter((a) => a.origin === 'gemini') ?? []
    if (!args['skip-daily'] && config.dailyCount > 0) {
        console.log(`\n▶ Orbit Daily (${config.dailyCount} bài từ ${lessonsOut.length} bài giảng)`)
        const lessonsHash = createHash('sha256').update(JSON.stringify(lessonsOut.map((l) => [l.id, l.transcript, l.concepts]))).digest('hex')
        const cacheFile = path.join(CACHE_DIR, 'daily.json')
        let cache = readJson<{ lessonsHash: string; count: number; draft: DailyDraft }>(cacheFile)
        if (cache && cache.lessonsHash === lessonsHash && cache.count === config.dailyCount && !args.force && !regenerated) {
            console.log('   ↺ dùng cache')
        } else {
            try {
                const draft = await generateJson(DailyDraft, [{ text: dailyPrompt(lessonsOut, config.dailyCount) }])
                cache = { lessonsHash, count: config.dailyCount, draft }
                writeJson(cacheFile, cache)
            } catch (err) {
                if (err instanceof QuotaExhausted) stopQuota(err, 'bài đọc Daily')
                console.error(`   ✖ Daily: ${err instanceof Error ? err.message : err}`)
                failed.push('daily')
                cache = null
            }
        }
        if (cache) {
            const { articles, report } = normalizeDaily(cache.draft, lessonsOut)
            printReport('Daily', report)
            console.log(`   ✓ ${articles.length}/${cache.draft.articles.length} bài đọc hợp lệ`)
            daily = articles
        }
    }

    // ── Ghi kết quả ──
    writeJson(path.join(args.out!, 'courses.json'), coursesOut)
    writeJson(path.join(args.out!, 'lessons.json'), lessonsOut)
    writeJson(path.join(args.out!, 'daily.json'), daily)

    const conceptIds = new Set(lessonsOut.flatMap((l) => l.concepts.map((c) => c.id)))
    const badges = readJson<Badge[]>(path.join(args.out!, 'badges.json')) ?? []
    for (const b of badges) {
        if (b.criterion.type !== 'concept-mastery') continue
        const missing = b.criterion.conceptIds.filter((c) => !conceptIds.has(c))
        if (missing.length) console.log(`\n⚠ Huy hiệu "${b.id}" trỏ tới khái niệm không còn tồn tại: ${missing.join(', ')} (sửa src/data/badges.json)`)
    }

    console.log(`\nĐã ghi ${coursesOut.length} khóa, ${lessonsOut.length} bài, ${daily.length} bài Daily vào ${path.relative(ROOT, args.out!) || '.'}`)
    console.log(`Khái niệm: ${[...conceptIds].join(', ')}`)
    if (failed.length) {
        console.log(`\n✖ Lỗi: ${failed.join(', ')}. Chạy lại để thử lần nữa (bài thành công đã được cache).`)
        process.exit(1)
    }
}

main().catch((err) => fail(err instanceof Error ? err.stack ?? err.message : String(err)))
