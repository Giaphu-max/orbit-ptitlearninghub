/**
 * Tự đo hiệu năng trang chủ (?bench): chạy lần lượt các cấu hình, mỗi cấu hình tải lại trang với cờ tương ứng.
 * Tiến độ và kết quả giữ trong sessionStorage để đi tiếp sau mỗi lần tải lại. Chỉ chạy khi URL có ?bench.
 */
export const BENCH_CONFIGS = [
    { label: 'Gốc', flag: '' },
    { label: 'no3d', flag: 'no3d' },
    { label: 'nolenis', flag: 'nolenis' },
    { label: 'nolabels', flag: 'nolabels' },
    { label: 'noreveal', flag: 'noreveal' },
    { label: 'nokiosk', flag: 'nokiosk' },
    { label: 'opaque', flag: 'opaque' },
] as const

export interface BenchRow {
    label: string
    flyFps: number
    flyLow: number
    flyJs: number
    stillFps: number
    stillLow: number
    stillJs: number
    /** Số khung > 50ms trong cả lượt đo */
    jank: number
    flyFrames: number
    stillFrames: number
}
export interface BenchState {
    i: number
    rows: BenchRow[]
    done?: boolean
}

const KEY = 'orbit-bench'

export const loadBench = (): BenchState | null => {
    try {
        const raw = sessionStorage.getItem(KEY)
        return raw ? (JSON.parse(raw) as BenchState) : null
    } catch {
        return null
    }
}
export const saveBench = (s: BenchState | null) => {
    try {
        if (s) sessionStorage.setItem(KEY, JSON.stringify(s))
        else sessionStorage.removeItem(KEY)
    } catch {
        /* sessionStorage bị chặn: bench chạy được một cấu hình rồi dừng */
    }
}

/** Cờ cấu hình có trong URL hiện tại ('' = bản gốc) */
export const currentFlag = () => {
    const q = new URLSearchParams(window.location.search)
    return BENCH_CONFIGS.find((c) => c.flag && q.has(c.flag))?.flag ?? ''
}
export const benchUrl = (i: number) => `${window.location.pathname}?bench${BENCH_CONFIGS[i].flag ? `&${BENCH_CONFIGS[i].flag}` : ''}`

/** Trạng thái khi vào trang: tiếp tục nếu cờ trong URL khớp cấu hình đang chờ, không thì đo lại từ đầu */
export function initBench(): BenchState {
    const st = loadBench()
    const ok = st && !st.done && BENCH_CONFIGS[st.i]?.flag === currentFlag()
    const next: BenchState = ok ? st : { i: 0, rows: [] }
    saveBench(next)
    return next
}

export interface Phase {
    gaps: number[]
    js: number
}
export const newPhase = (): Phase => ({ gaps: [], js: 0 })

const stats = (p: Phase) => {
    const n = p.gaps.length
    if (!n) return { fps: 0, low: 0, js: 0 }
    const mean = p.gaps.reduce((a, b) => a + b, 0) / n
    const worst = [...p.gaps].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(n * 0.01)))
    return { fps: 1000 / mean, low: 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length), js: p.js / n }
}

export function makeRow(label: string, fly: Phase, still: Phase): BenchRow {
    const f = stats(fly)
    const s = stats(still)
    const jank = [...fly.gaps, ...still.gaps].filter((g) => g > 50).length
    return { label, flyFps: f.fps, flyLow: f.low, flyJs: f.js, stillFps: s.fps, stillLow: s.low, stillJs: s.js, jank, flyFrames: fly.gaps.length, stillFrames: still.gaps.length }
}

/** userAgent rút gọn: "Safari 18.3" / "Chrome 130" */
export function shortUA() {
    const ua = navigator.userAgent
    const v = ua.match(/Version\/([\d.]+)/)
    if (v && /Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) return `Safari ${v[1]}`
    const c = ua.match(/(Chrome|Firefox|Edg)\/([\d]+)/)
    return c ? `${c[1] === 'Edg' ? 'Edge' : c[1]} ${c[2]}` : ua.slice(0, 60)
}

const f1 = (n: number) => (n ? n.toFixed(1) : '–')
export function benchText(rows: BenchRow[]) {
    const head = `${shortUA()} · dpr ${window.devicePixelRatio} · ${window.innerWidth}×${window.innerHeight}`
    const lines = rows.map((r) => `${r.label.padEnd(9)} bay ${f1(r.flyFps)} fps (1% low ${f1(r.flyLow)}) · yên ${f1(r.stillFps)} fps · giật ${r.jank} · js bay ${r.flyJs.toFixed(1)}ms / yên ${r.stillJs.toFixed(1)}ms`)
    return [head, ...lines].join('\n')
}
