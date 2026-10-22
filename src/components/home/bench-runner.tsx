import { useEffect, useRef, useState } from 'react'
import { BENCH_CONFIGS, benchText, benchUrl, currentFlag, initBench, makeRow, newPhase, saveBench, shortUA, type BenchRow } from '@/lib/bench'
import { setFrameObserver } from '@/lib/frame-loop'
import { benchState, FLAGS } from '@/lib/perf'
import { getLenis, goChapter, isCameraFlying, isChapterReady, isPagedMode } from '@/lib/scroll'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
async function waitFor(cond: () => boolean, timeout: number) {
    const t0 = performance.now()
    while (!cond() && performance.now() - t0 < timeout) await sleep(100)
}

/** Chương đi qua trong một lượt đo: hero → Hôm nay → Khóa học → Studio → lùi về Hôm nay (bước chương thường, không cắt cảnh) */
const TOUR = [1, 2, 3, 1]

/** Chạy ?bench: đo từng cấu hình, tải lại trang sang cấu hình kế; xong thì hiện bảng. Không render gì khi không có ?bench. */
export function BenchRunner() {
    if (!FLAGS.bench) return null
    return <Bench />
}

function Bench() {
    const [state] = useState(initBench)
    const [rows, setRows] = useState<BenchRow[] | null>(null)
    const pre = useRef<HTMLPreElement>(null)
    const [copied, setCopied] = useState<'ok' | 'sel' | null>(null)

    useEffect(() => {
        // Cờ trong URL không khớp cấu hình đang chờ (mở /?bench&... tay): về cấu hình đầu
        if (BENCH_CONFIGS[state.i].flag !== currentFlag()) {
            window.location.replace(benchUrl(state.i))
            return
        }
        let cancelled = false
        const fly = newPhase()
        const still = newPhase()
        const foot = newPhase()
        let inFooter = false
        ;(async () => {
            await waitFor(() => isChapterReady() && (FLAGS.no3d || !!document.querySelector('canvas')), 20000)
            await sleep(1500)
            if (cancelled) return
            setFrameObserver((gap, js) => {
                const p = inFooter ? foot : isCameraFlying() ? fly : still
                p.gaps.push(gap)
                p.js += js
                if (gap > p.worstGap) {
                    p.worstGap = gap
                    p.worstJs = js
                }
            })
            await sleep(1000)
            for (const c of TOUR) {
                if (cancelled) return
                goChapter(c, false)
                await sleep(150)
                await waitFor(() => !isCameraFlying(), 9000)
                await sleep(1000)
            }
            // Chặng footer: Studio → cuộn Lenis xuống hết footer → dừng 1s → cuộn ngược lên Studio
            if (cancelled) return
            goChapter(3, false)
            await sleep(150)
            await waitFor(() => !isCameraFlying(), 9000)
            await sleep(500)
            const studioY = window.scrollY
            const bottom = () => document.documentElement.scrollHeight - window.innerHeight
            inFooter = true
            if (isPagedMode()) {
                // Paged: vào/ra chương 4 (footer trượt lên/xuống), không cuộn tài liệu
                goChapter(4, false)
                await sleep(150)
                await waitFor(() => !isCameraFlying(), 5000)
                await sleep(1000)
                goChapter(3, false)
                await sleep(150)
                await waitFor(() => !isCameraFlying(), 5000)
                await sleep(300)
            } else {
                getLenis()?.scrollTo(bottom(), { duration: 1.6, force: true })
                await sleep(200)
                await waitFor(() => bottom() - window.scrollY < 3, 6000)
                await sleep(1000)
                getLenis()?.scrollTo(studioY, { duration: 1.6, force: true })
                await sleep(200)
                await waitFor(() => Math.abs(window.scrollY - studioY) < 3, 6000)
                await sleep(300)
            }
            inFooter = false
            setFrameObserver(null)
            if (cancelled) return
            const all = [...state.rows, makeRow(BENCH_CONFIGS[state.i].label, fly, still, foot)]
            if (state.i + 1 < BENCH_CONFIGS.length) {
                saveBench({ i: state.i + 1, rows: all })
                window.location.replace(benchUrl(state.i + 1))
            } else {
                saveBench({ i: state.i, rows: all, done: true })
                benchState.active = false
                setRows(all)
            }
        })()
        return () => {
            cancelled = true
            setFrameObserver(null)
        }
    }, [state])

    // Chặn chuột/chạm trong lúc đo (cuộn đã bị useScrollStage bỏ qua)
    useEffect(() => {
        if (rows) return
        const stop = (e: Event) => {
            e.preventDefault()
            e.stopPropagation()
        }
        const evs = ['pointerdown', 'click', 'mousedown'] as const
        evs.forEach((n) => window.addEventListener(n, stop, true))
        return () => evs.forEach((n) => window.removeEventListener(n, stop, true))
    }, [rows])

    if (!rows) {
        return (
            <p role="status" className="pointer-events-none fixed bottom-3 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 font-mono text-xs text-ink-foreground">
                Đang đo cấu hình {state.i + 1}/{BENCH_CONFIGS.length} — đừng chạm chuột
            </p>
        )
    }

    const text = benchText(rows)
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied('ok')
        } catch {
            if (pre.current) {
                const sel = window.getSelection()
                sel?.removeAllRanges()
                const r = document.createRange()
                r.selectNodeContents(pre.current)
                sel?.addRange(r)
            }
            setCopied('sel')
        }
    }
    const rerun = () => {
        saveBench(null)
        window.location.replace(benchUrl(0))
    }
    const n = (v: number) => (v ? v.toFixed(1) : '–')
    return (
        <div className="fixed inset-0 z-[9999] grid place-items-center overflow-auto bg-ink/85 p-4">
            <div className="w-full max-w-6xl rounded-2xl bg-card p-6 text-foreground shadow-raised">
                <p className="font-mono text-sm text-muted-foreground">
                    {shortUA()} · dpr {window.devicePixelRatio} · {window.innerWidth}×{window.innerHeight}
                </p>
                <table className="mt-4 w-full text-left font-mono text-lg">
                    <thead className="text-sm text-muted-foreground">
                        <tr>
                            <th className="py-1">Cấu hình</th>
                            <th>FPS TB bay</th>
                            <th>1% low bay</th>
                            <th>Chậm nhất</th>
                            <th>FPS yên</th>
                            <th>Giật</th>
                            <th>Footer FPS</th>
                            <th>Footer 1%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.label} className="border-t border-border">
                                <td className="py-2 font-bold">{r.label}</td>
                                <td>{n(r.flyFps)}</td>
                                <td>{n(r.flyLow)}</td>
                                <td>{r.flyWorst.toFixed(0)}ms</td>
                                <td>{n(r.stillFps)}</td>
                                <td>{r.jank}</td>
                                <td>{n(r.footFps)}</td>
                                <td>{n(r.footLow)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <pre ref={pre} className="mt-4 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs select-all">
                    {text}
                </pre>
                <div className="mt-4 flex items-center gap-3">
                    <button type="button" onClick={copy} className="rounded-full bg-brand-600 px-5 py-2 font-bold text-ink-foreground">
                        Chép kết quả
                    </button>
                    <button type="button" onClick={rerun} className="rounded-full border border-border px-5 py-2 font-bold">
                        Chạy lại
                    </button>
                    {copied && <span className="text-sm text-muted-foreground">{copied === 'ok' ? 'Đã chép.' : 'Không chép được, văn bản đã được chọn sẵn: nhấn Cmd+C.'}</span>}
                </div>
            </div>
        </div>
    )
}
