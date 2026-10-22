import type { CourseSummary } from '@/lib/course-map'
import { KIOSK_H, KIOSK_W } from './kiosk-screen'

const tok = (name: string, alpha = 1) => `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()} / ${alpha})`
const tokRgb = (name: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    g.beginPath()
    g.roundRect(x, y, w, h, r)
}

/** Chia dòng theo bề ngang, tối đa `max` dòng (dòng cuối thêm …) */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number) {
    const words = text.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
        const next = cur ? `${cur} ${w}` : w
        if (g.measureText(next).width > width && cur) {
            lines.push(cur)
            cur = w
        } else cur = next
    }
    if (cur) lines.push(cur)
    if (lines.length > max) {
        lines.length = max
        lines[max - 1] = `${lines[max - 1].replace(/\s+\S*$/, '')}…`
    }
    return lines
}

/**
 * Ảnh tĩnh của màn kiosk (cùng bố cục với KioskScreen DOM, gấp đôi độ phân giải) để dán lên màn 3D trên Safari:
 * lúc máy quay còn bay thì chỉ thấy ảnh này, lớp DOM thật (bấm được) chỉ hiện khi máy quay đã dừng.
 */
export function drawKioskSnapshot(list: CourseSummary[]): HTMLCanvasElement {
    const K = 2
    const cv = document.createElement('canvas')
    cv.width = KIOSK_W * K
    cv.height = KIOSK_H * K
    const g = cv.getContext('2d')!
    g.scale(K, K)
    const fam = '"Be Vietnam Pro", Arial, sans-serif'
    const mono = '"JetBrains Mono Variable", "JetBrains Mono", monospace'
    const fg = tok('--ink-foreground')
    g.fillStyle = tok('--ink')
    g.fillRect(0, 0, KIOSK_W, KIOSK_H)
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    g.fillStyle = tok('--brand-light')
    g.font = `700 13px ${mono}`
    g.fillText('02 · KHÓA HỌC', 48, 66)
    g.fillStyle = fg
    g.font = `800 44px ${fam}`
    g.fillText('Khóa học của bạn', 48, 118)
    g.fillStyle = tok('--ink-foreground', 0.7)
    g.font = `400 17px ${fam}`
    g.fillText('Học theo chặng, đích là test cuối chương.', 48, 150)

    const top = 176
    const gap = 18
    const rows = list.length > 2 ? 2 : 1
    const bottom = KIOSK_H - 48 - 21 - 20
    const cw = (KIOSK_W - 96 - gap) / 2
    const ch = (bottom - top - gap * (rows - 1)) / rows
    list.slice(0, 4).forEach((s, i) => {
        const x = 48 + (i % 2) * (cw + gap)
        const y = top + Math.floor(i / 2) * (ch + gap)
        const { course, lessons: ls, status, pct, curIndex } = s
        const lesson = ls[curIndex] ?? ls[0]
        const sub = status === 'doing' ? `Chặng ${curIndex + 1}/${ls.length}` : status === 'done' ? 'Đã xong' : `${ls.length} bài`
        const action = status === 'done' ? 'Xem lại' : pct > 0 ? 'Học tiếp' : 'Bắt đầu'
        rrect(g, x, y, cw, ch, 18)
        g.fillStyle = tok('--ink-foreground', 0.05)
        g.fill()
        g.strokeStyle = tok('--ink-foreground', 0.1)
        g.lineWidth = 1
        g.stroke()
        // Ảnh bìa
        rrect(g, x + 24, y + 24, 64, 64, 12)
        g.fillStyle = tokRgb('--brand-700')
        g.fill()
        g.fillStyle = tok('--brand-light')
        g.font = `800 13px ${mono}`
        g.fillText(`${course.subject} · ${sub}`.toUpperCase().slice(0, 34), x + 104, y + 38)
        g.fillStyle = fg
        g.font = `700 24px ${fam}`
        wrap(g, course.title, cw - 104 - 24, 2).forEach((ln, k) => g.fillText(ln, x + 104, y + 68 + k * 28))
        g.font = `700 44px ${mono}`
        g.fillText(`${pct}%`, x + 24, y + ch - 36)
        if (lesson) {
            g.font = `800 16px ${fam}`
            const bw = g.measureText(action).width + 40 + 18
            rrect(g, x + cw - 24 - bw, y + ch - 36 - 38, bw, 42, 21)
            g.fillStyle = tokRgb('--brand-600')
            g.fill()
            g.fillStyle = fg
            g.fillText(action, x + cw - 24 - bw + 40, y + ch - 36 - 38 + 27)
        }
        rrect(g, x + 24, y + ch - 24 - 6, cw - 48, 6, 3)
        g.fillStyle = tok('--ink-foreground', 0.15)
        g.fill()
        rrect(g, x + 24, y + ch - 24 - 6, Math.max(6, ((cw - 48) * pct) / 100), 6, 3)
        g.fillStyle = tokRgb('--brand-600')
        g.fill()
    })
    g.fillStyle = tok('--ink-foreground', 0.7)
    g.font = `700 15px ${fam}`
    g.fillText('Xem tất cả khóa học →', 48, KIOSK_H - 48)
    return cv
}
