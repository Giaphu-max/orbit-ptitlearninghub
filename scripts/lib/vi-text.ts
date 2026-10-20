// Chuẩn hóa chữ cho nội dung do AI tạo: tiếng Việt chỉ viết hoa chữ đầu câu và tên riêng,
// dấu "?" ở tiêu đề chỉ dùng khi tiêu đề thật sự là câu hỏi.
// Gemini hay viết kiểu tiếng Anh ("Nhịp Điệu Dựng Phim") và gắn "?" cho cả câu khẳng định.

/** Tên riêng / thương hiệu giữ nguyên cách viết (so khớp không phân biệt hoa thường). */
const PROPER = [
    'PTIT', 'Premiere Pro', 'Premiere', 'Adobe', 'DaVinci Resolve', 'DaVinci', 'Resolve', 'Final Cut Pro', 'Final Cut', 'Avid', 'Media Composer',
    'After Effects', 'YouTube', 'Hollywood', 'Việt Nam', 'Walter Murch', 'Eisenstein', 'Kuleshov', 'Orbit', 'Gemini', 'Windows', 'Mac', 'Apple',
]

const PROPER_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${PROPER.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'giu')

const properCanonical = new Map(PROPER.map((p) => [p.toLowerCase(), p]))

const isUpperInitial = (w: string) => /^\p{Lu}/u.test(w)
/** Từ viết tắt (NLE, EDL, PTIT…): có từ 2 chữ cái hoa trở lên và không có chữ thường */
const isAcronym = (w: string) => /^[\p{Lu}\p{N}]{2,}[\p{L}\p{N}]*$/u.test(w) && !/\p{Ll}/u.test(w)

function lowerWord(w: string): string {
    if (isAcronym(w)) return w
    // Từ ghép có gạch nối kiểu "Non-Destructive"
    return w.toLowerCase()
}

/** Có đang viết hoa từng chữ (Title Case) không: từ thứ 2 trở đi, ít nhất nửa số từ viết hoa chữ đầu. */
function looksTitleCased(text: string, minUpper = 2): boolean {
    const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).slice(1)
    const upper = words.filter((w) => isUpperInitial(w) && !isAcronym(w)).length
    return upper >= minUpper && upper / words.length >= 0.5
}

function fixSegment(segment: string): string {
    const protectedSpans: string[] = []
    const masked = segment.replace(PROPER_RE, (m) => {
        protectedSpans.push(properCanonical.get(m.toLowerCase()) ?? m)
        return `\uE000${protectedSpans.length - 1}\uE000`
    })
    const lowered = masked.replace(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu, (w) => lowerWord(w))
    return lowered.replace(/\uE000(\d+)\uE000/g, (_, i: string) => protectedSpans[Number(i)])
}

const capitalizeFirst = (s: string) => s.replace(/\p{L}/u, (c) => c.toUpperCase())

/**
 * Sentence case cho tên bài/khái niệm: chỉ chữ đầu và tên riêng/từ viết tắt viết hoa.
 * Chỉ sửa khi văn bản thật sự đang viết hoa từng chữ, để không làm hỏng tên riêng mà AI viết đúng.
 */
export function sentenceCase(text: string, minUpper = 2): string {
    let out = text.trim().replace(/\s+/g, ' ')
    // Cụm trong ngoặc, ví dụ "(Cognitive Load)", "(Non-destructive)": thuật ngữ nước ngoài thường viết thường
    out = out.replace(/\(([^)]+)\)/g, (m, inner: string) => (isUpperInitial(inner) && !isAcronym(inner.split(/\s+/)[0]) && (/^[\p{L}-]+$/u.test(inner) || looksTitleCased(`x ${inner}`)) ? `(${fixSegment(inner)})` : m))
    const main = out.replace(/\([^)]*\)/g, '')
    if (looksTitleCased(main, minUpper)) {
        out = out
            .split(/(\([^)]*\))/)
            .map((part) => (part.startsWith('(') ? part : fixSegment(part)))
            .join('')
    }
    return capitalizeFirst(out)
}

const QUESTION_MARKERS =
    /(^|\s)(tại sao|vì sao|thế nào|như thế nào|ra sao|là gì|là ai|bao nhiêu|bao lâu|bằng cách nào|khi nào|ở đâu|có phải|liệu|làm sao|gì|nào|đâu|ai)(\s|$|\?)|(^|\s)có\s.+\skhông$/iu

/** Tiêu đề có phải câu hỏi không (theo dấu hiệu tiếng Việt). */
export function isQuestion(text: string): boolean {
    return QUESTION_MARKERS.test(text.replace(/\?+$/, '').trim())
}

/** Chuẩn hóa tiêu đề: sentence case; chỉ giữ "?" khi là câu hỏi thật, và gắn "?" nếu là câu hỏi mà thiếu. */
export function normalizeTitle(text: string): string {
    const base = sentenceCase(text).replace(/[\s?!.]+$/u, '')
    return isQuestion(base) ? `${base}?` : base
}

/** Tên khái niệm: sentence case, không có dấu câu cuối. */
export function normalizeName(text: string): string {
    return sentenceCase(text, 1).replace(/[\s?!.:;,]+$/u, '')
}
