/** Cắt một đoạn transcript dài thành các cụm ngắn (tối đa ~max ký tự, ưu tiên cắt ở dấu câu rồi khoảng trắng) để phụ đề không che màn hình. */
export function splitCaption(text: string, max = 80): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean)
    const chunks: string[] = []
    let cur = ''
    for (const w of words) {
        const next = cur ? `${cur} ${w}` : w
        if (next.length > max && cur) {
            chunks.push(cur)
            cur = w
        } else if (/[.!?;:…]$/.test(w) && next.length > max * 0.55) {
            chunks.push(next)
            cur = ''
        } else cur = next
    }
    if (cur) chunks.push(cur)
    return chunks.length ? chunks : [text]
}

/** Cụm phụ đề đang hiện tại thời điểm t: thời gian của đoạn chia theo tỉ lệ số ký tự từng cụm. */
export function captionAt(seg: { text: string; start: number; end: number }, t: number, max = 80): string {
    const chunks = splitCaption(seg.text, max)
    if (chunks.length === 1) return chunks[0]
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const span = Math.max(0.001, seg.end - seg.start)
    let acc = 0
    for (const c of chunks) {
        acc += c.length
        if (t < seg.start + (acc / total) * span) return c
    }
    return chunks[chunks.length - 1]
}
