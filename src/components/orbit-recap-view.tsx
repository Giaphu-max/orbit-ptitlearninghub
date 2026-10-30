import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Award, Check, Play, X } from 'lucide-react'
import { getLessonsOfCourse } from '@/data'
import { useEffectiveLesson, useCourseLessons } from '@/lib/lesson-edits'
import { buildRecap, type RecapConcept, type RecapData } from '@/lib/recap'
import { LessonHeader } from '@/components/lesson/lesson-header'
import { UNLOCK_THRESHOLD } from '@/lib/gamification'
import { quickKey, quickSetFor, resolveSet, sourcedBank } from '@/lib/test-sets'
import { QUIZ_XP } from '@/lib/quiz'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'
import './recap/recap.css'

const RING_LEN = 131.95 // 2π · 21 (vòng % 52px của hàng khái niệm)
const vi = (n: number) => Math.round(n).toLocaleString('vi-VN')
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pct = (n: number) => Math.round(n * 100)

/** /recap/:lessonId – tổng kết chặng: hero "Chặng N.", mức nắm vững từng khái niệm trước/sau, học từ lỗi sai, huy hiệu gần đạt. */
export function OrbitRecapView() {
    const { lessonId } = useParams()
    const lesson = useEffectiveLesson(lessonId)
    const visible = useCourseLessons(lesson?.courseId)
    const state = useOrbitStore()
    if (!lesson) return <Navigate to="/learning" replace />
    const data = buildRecap(lesson, visible.length ? visible : getLessonsOfCourse(lesson.courseId), state)
    if (!data) return <Navigate to="/learning" replace />
    return <Recap key={lesson.id} data={data} />
}

function Recap({ data }: { data: RecapData }) {
    const { lesson, course, index, concepts, checkpoint, xp, video, weakest, next, stages } = data
    const markRecapSeen = useOrbitStore((s) => s.markRecapSeen)
    const totalXp = useOrbitStore((s) => s.xp)
    const quickStored = useOrbitStore((s) => s.testSets[quickKey(lesson.id)])
    const quick = quickSetFor(lesson, quickStored)
    const CHECKPOINT_QUESTION_COUNT = resolveSet(quick, sourcedBank([lesson])).length
    const TEST_PASS_RATIO = quick.rules.passRatio
    // Hiệu ứng chỉ chạy lần đầu mở màn tổng kết của chặng này
    const [play] = useState(() => !useOrbitStore.getState().recapSeen[lesson.id] && !reducedMotion())
    const root = useRef<HTMLDivElement>(null)
    const final = useRef({ xp: totalXp, gain: xp.gain })
    useEffect(() => {
        final.current = { xp: totalXp, gain: xp.gain }
    })

    useEffect(() => {
        markRecapSeen(lesson.id)
    }, [lesson.id, markRecapSeen])

    // Chuỗi hiệu ứng: chữ trồi lên (CSS) → vòng điểm và số chạy → thanh khái niệm dài ra lần lượt → huy hiệu bật lên + tia sáng → XP cộng vào chip trên nav
    useLayoutEffect(() => {
        const el = root.current
        if (!el || !play) return
        const timers: number[] = []
        const rafs = new Set<number>()
        const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms))
        const q = (k: string) => [...el.querySelectorAll<HTMLElement>(`[data-fx="${k}"]`)]
        const count = (node: HTMLElement, to: number, dur: number, delay: number) => {
            node.textContent = '0'
            later(() => {
                const t0 = performance.now()
                const tick = (now: number) => {
                    const k = Math.min(1, (now - t0) / dur)
                    node.textContent = vi(to * (1 - Math.pow(1 - k, 3)))
                    if (k < 1) rafs.add(requestAnimationFrame(tick))
                }
                rafs.add(requestAnimationFrame(tick))
            }, delay)
        }

        q('ring').forEach((c) => {
            c.style.strokeDashoffset = String(RING_LEN)
            later(() => (c.style.strokeDashoffset = c.dataset.final ?? '0'), 250)
        })
        q('count').forEach((n) => count(n, Number(n.dataset.to), Number(n.dataset.dur ?? 1200), Number(n.dataset.delay ?? 250)))
        // Thanh mức nắm vững chạy từ 0 lên trong 1.2s, lần lượt từng khái niệm
        q('now').forEach((bar, i) => {
            bar.style.transition = 'none'
            bar.style.width = '0%'
            void bar.offsetWidth
            bar.style.transition = ''
            later(() => (bar.style.width = bar.dataset.final ?? ''), 500 + i * 140)
        })
        // XP chặng cộng vào chip trên thanh điều hướng
        later(() => window.dispatchEvent(new CustomEvent('orbit:xp-count', { detail: { from: Math.max(0, final.current.xp - final.current.gain), to: final.current.xp } })), 2700)
        return () => {
            timers.forEach(window.clearTimeout)
            rafs.forEach(cancelAnimationFrame)
            // Về trạng thái cuối (StrictMode chạy hiệu ứng hai lần, và rời trang giữa chừng không để lại gì)
            q('ring').forEach((c) => (c.style.strokeDashoffset = c.dataset.final ?? '0'))
            q('now').forEach((bar) => (bar.style.width = bar.dataset.final ?? ''))
        }
    }, [play])

    const rise = (n: number) => ({ ['--d' as string]: `${n * 0.08}s` }) as React.CSSProperties
    const stageNo = index + 1
    const nextNo = stageNo + 1
    const videoRight = video.correct + video.corrected
    const toMistake = (id: string) => document.getElementById(`mistake-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
    const shownBadge = data.newBadges[0] ?? data.nearBadge

    return (
        <div ref={root} data-play={play} className="w-full">
            <div className="container-wide py-6">
                <LessonHeader lesson={lesson} currentStep="recap" doneSteps={checkpoint ? ['lesson', 'checkpoint'] : ['lesson']} />

                {/* ── Hero: chữ display (8) | chặng tiếp theo (4) ── */}
                <section className="lesson-grid mt-6 items-stretch">
                    <div className="flex min-w-0 flex-col">
                        <p style={rise(0)} className="rc-rise text-[13px] font-bold uppercase tracking-[0.16em] text-brand-ink">
                            Tổng kết chặng {stageNo} · {stages.length} chặng
                        </p>
                        <p style={rise(1)} className="rc-rise mt-1.5 text-[clamp(96px,8.4vw,150px)] font-black leading-[0.92] tracking-[-0.055em] text-strong">
                            Chặng {stageNo}.
                        </p>
                        <h2 style={rise(2)} className="rc-rise mt-3.5 text-[clamp(28px,2.4vw,40px)] font-extrabold leading-[1.15] tracking-[-0.025em] text-muted-foreground">
                            Bạn đã vững{' '}
                            <em className="not-italic text-brand-ink">
                                {data.masteredCount}/{concepts.length}
                            </em>{' '}
                            khái niệm của bài.
                        </h2>
                        <p style={rise(3)} className="rc-rise mt-3.5 max-w-[62ch] text-base leading-relaxed text-muted-foreground">
                            {checkpoint ? (
                                <>
                                    Đúng <b className="text-strong">{checkpoint.correct}/{checkpoint.total}</b> ở bài test · {checkpoint.passed ? 'đạt' : 'chưa đạt'} {pct(TEST_PASS_RATIO)}%.
                                    {weakest && !checkpoint.passed && (
                                        <>
                                            {' '}Còn yếu nhất là <b className="text-strong">{weakest.name}</b>, xem lại đoạn đó rồi làm test lần nữa.
                                        </>
                                    )}
                                </>
                            ) : weakest ? (
                                <>
                                    Còn yếu nhất là <b className="text-strong">{weakest.name}</b>. Làm test {CHECKPOINT_QUESTION_COUNT} câu để chốt lại — đạt từ {pct(TEST_PASS_RATIO)}% là khái niệm sáng lên trong bản đồ kỹ năng.
                                </>
                            ) : (
                                <>Bạn đã nắm chắc mọi khái niệm của bài. Làm test {CHECKPOINT_QUESTION_COUNT} câu để chốt lại — đạt từ {pct(TEST_PASS_RATIO)}% là khái niệm sáng lên trong bản đồ kỹ năng.</>
                            )}
                        </p>
                        <div style={rise(4)} className="rc-rise mt-auto flex flex-wrap items-center pt-6">
                            <Link
                                to={checkpoint ? next.to : `/checkpoint/${lesson.id}`}
                                className="tier-1-bob surface-red mr-7 inline-flex items-center gap-2 rounded-[14px] px-[22px] py-3.5 text-base font-extrabold text-ink-foreground shadow-brand"
                            >
                                {checkpoint ? (
                                    `${next.label} →`
                                ) : (
                                    <>
                                        <Play size={16} className="fill-current" /> Làm test {CHECKPOINT_QUESTION_COUNT} câu
                                    </>
                                )}
                            </Link>
                            <Kpi value={`+${xp.gain}`} fxTo={xp.gain} label="XP chặng này" />
                            <Kpi value={`${videoRight}/${video.total}`} label="câu đúng trong video" />
                            <Kpi value={checkpoint ? `${checkpoint.correct}/${checkpoint.total}` : '—'} label={checkpoint ? 'kết quả test' : 'test chưa làm'} />
                        </div>
                    </div>

                    <aside className="flex min-w-0 flex-col rounded-[22px] border border-border bg-card p-6 shadow-card">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{next.lesson ? 'Chặng tiếp theo' : 'Cuối khóa'}</p>
                        {next.lesson ? (
                            <>
                                <div className="relative mt-3 aspect-[16/8] overflow-hidden rounded-[14px] bg-gradient-to-br from-ink/80 to-ink">
                                    {next.lesson.youtubeId && <img src={`https://i.ytimg.com/vi/${next.lesson.youtubeId}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                                    <span className="absolute bottom-2.5 right-2.5 rounded-md bg-ink/60 px-[7px] py-[3px] font-mono text-[11.5px] font-bold text-ink-foreground">{formatTime(next.lesson.durationSec)}</span>
                                </div>
                                <b className="mt-3.5 block text-[17px] font-extrabold leading-snug text-strong">
                                    Chặng {nextNo} · {next.lesson.title}
                                </b>
                                <small className="mt-1 block text-[13px] text-muted-foreground">
                                    {next.lesson.concepts.length} khái niệm · {data.completed ? 'sẵn sàng học' : 'mở khi xong chặng này'}
                                </small>
                                {next.unlocked.length > 0 && (
                                    <small className="mt-1 block text-[13px] font-semibold text-success">Vừa mở trong bản đồ: {next.unlocked.map((u) => u.name).join(', ')}</small>
                                )}
                            </>
                        ) : (
                            <>
                                <b className="mt-3.5 block text-[17px] font-extrabold leading-snug text-strong">Test cuối chương · {course.title}</b>
                                <small className="mt-1 block text-[13px] text-muted-foreground">Bạn đã đi hết các chặng. Làm test tổng hợp để chốt cả học phần.</small>
                            </>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                            <Link to={next.to} className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-strong px-4 py-[11px] text-sm font-extrabold text-strong transition hover:bg-muted">
                                {next.lesson ? `Bắt đầu chặng ${nextNo} →` : 'Làm test cuối chương →'}
                            </Link>
                            <Link to={`/learning?course=${course.id}`} className="text-[13px] font-bold text-muted-foreground hover:text-strong">
                                Về học phần
                            </Link>
                        </div>
                    </aside>
                </section>

                {/* ── Mức nắm vững từng khái niệm ── */}
                <div className="mb-3.5 mt-9 flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-xl font-black tracking-tight text-strong">Mức nắm vững từng khái niệm</h3>
                    <small className="flex items-center gap-3.5 text-[13px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <i className="h-1.5 w-3.5 rounded-sm bg-muted-foreground/30" />
                            Đầu chặng
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <i className="h-1.5 w-3.5 rounded-sm bg-brand-600" />
                            Bây giờ
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <i className="h-3 w-0.5 rounded-sm bg-strong/60" />
                            Mốc {pct(UNLOCK_THRESHOLD)}%
                        </span>
                    </small>
                </div>
                <section className="rounded-[22px] border border-border bg-card p-1.5 shadow-card">
                    {concepts.map((c) => (
                        <ConceptRow
                            key={c.id}
                            c={c}
                            lessonId={lesson.id}
                            weakest={weakest?.id === c.id}
                            wrongIds={data.mistakes.filter((m) => m.root.conceptId === c.id).map((m) => m.root.id)}
                            onWrong={toMistake}
                        />
                    ))}
                </section>

                {/* ── Học từ lỗi sai | huy hiệu ── */}
                <section className="lesson-grid mt-6 items-start">
                    <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-card px-6 py-[22px] shadow-card">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <h3 className="text-xl font-black tracking-tight text-strong">Học từ lỗi sai</h3>
                            <small className="text-[13px] text-muted-foreground">Sửa đúng sau khi sai được XP gấp đôi</small>
                        </div>
                        {data.mistakes.length === 0 ? (
                            <p className="flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-3.5 text-sm font-bold text-success">
                                <Check size={16} aria-hidden /> Không có câu sai trong chặng này
                            </p>
                        ) : (
                            data.mistakes.map(({ root, outcome }) => {
                                const canRetry = root.variants.length > 0
                                const xpGain = outcome === 'missed' ? QUIZ_XP.corrected : 0
                                return (
                                    <div key={root.id} id={`mistake-${root.id}`} className="grid scroll-mt-24 grid-cols-[36px_1fr_auto] items-center gap-3.5 rounded-[14px] bg-muted px-4 py-3.5">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand-50 text-brand-ink">
                                            <X size={16} strokeWidth={3} aria-hidden />
                                        </span>
                                        <span className="min-w-0">
                                            <b className="block text-[14.5px] font-bold text-strong">“{root.prompt}”</b>
                                            <small className="mt-0.5 block text-[13px] text-muted-foreground">
                                                {outcome === 'missed' ? 'Bạn bỏ lỡ câu này' : 'Bạn sai rồi sửa được câu này'} ở <span className="font-mono">{formatTime(root.pauseAt)}</span> · đáp án ở{' '}
                                                <span className="font-mono">
                                                    {formatTime(root.answerSegment.start)}–{formatTime(root.answerSegment.end)}
                                                </span>
                                            </small>
                                        </span>
                                        <Link
                                            to={canRetry ? `/lesson/${lesson.id}?retry=${root.id}` : `/lesson/${lesson.id}?t=${Math.floor(root.answerSegment.start)}`}
                                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand-600 px-3 py-2 text-[13px] font-extrabold text-ink-foreground transition hover:bg-brand-700"
                                        >
                                            <Play size={12} className="fill-current" aria-hidden />
                                            {canRetry ? 'Làm lại câu này' : 'Xem đoạn đáp án'}
                                            {canRetry && xpGain > 0 && <span className="font-mono"> · +{xpGain} XP</span>}
                                        </Link>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {shownBadge && (
                        <aside className="flex items-center gap-4 rounded-[22px] border border-border bg-card px-6 py-[22px] shadow-card">
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mm-blue to-mm-teal text-white">
                                <Award size={26} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                                <small className="block text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                    {data.newBadges[0] ? 'Huy hiệu mới trong chặng' : 'Huy hiệu gần đạt nhất'}
                                </small>
                                <b className="mt-1 block text-base font-extrabold text-strong">{shownBadge.badge.name}</b>
                                <span className="my-2.5 block h-1.5 overflow-hidden rounded-sm bg-muted">
                                    <i className="block h-full bg-mm-blue" style={{ width: `${Math.min(100, (shownBadge.current / Math.max(1, shownBadge.target)) * 100)}%` }} />
                                </span>
                                <span className="text-[12.5px] text-muted-foreground">
                                    <span className="font-mono">
                                        {shownBadge.current}/{shownBadge.target}
                                    </span>{' '}
                                    · {shownBadge.badge.description}
                                </span>
                            </span>
                        </aside>
                    )}
                </section>
            </div>
        </div>
    )
}

function Kpi({ value, label, fxTo }: { value: string; label: string; fxTo?: number }) {
    return (
        <span className="border-l border-border px-[22px]">
            <b className="block font-mono text-[22px] font-extrabold leading-tight text-strong">
                {fxTo !== undefined ? (
                    <>
                        +<span data-fx="count" data-to={fxTo} data-dur="1400" data-delay="400">{vi(fxTo)}</span>
                    </>
                ) : (
                    value
                )}
            </b>
            <small className="text-[12.5px] text-muted-foreground">{label}</small>
        </span>
    )
}

function ConceptRow({ c, lessonId, weakest, wrongIds, onWrong }: { c: RecapConcept; lessonId: string; weakest: boolean; wrongIds: string[]; onWrong: (id: string) => void }) {
    const now = pct(c.now)
    const was = pct(c.was)
    const delta = now - was
    const tone = c.now >= UNLOCK_THRESHOLD ? 'ok' : c.now >= 0.5 ? 'mid' : 'low'
    const ring = { ok: 'stroke-success', mid: 'stroke-mm-orange', low: 'stroke-brand-600' }[tone]
    const fill = { ok: 'bg-success', mid: 'bg-mm-orange', low: 'bg-brand-600' }[tone]
    const seek = `/lesson/${lessonId}?t=${Math.floor(c.segment.start)}`
    return (
        <div className={`grid grid-cols-[52px_minmax(0,1.3fr)_minmax(0,1.6fr)_110px_170px] items-center gap-5 rounded-2xl px-[18px] py-4 [&+&]:border-t [&+&]:border-border ${weakest ? 'bg-brand-50' : ''}`}>
            <span className="relative h-[52px] w-[52px]">
                <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90" aria-hidden>
                    <circle cx="26" cy="26" r="21" fill="none" strokeWidth="6" className={weakest ? 'stroke-brand-100' : 'stroke-muted'} />
                    <circle
                        data-fx="ring"
                        data-final={RING_LEN * (1 - c.now)}
                        cx="26"
                        cy="26"
                        r="21"
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={RING_LEN}
                        strokeDashoffset={RING_LEN * (1 - c.now)}
                        className={`rc-ring-fg ${ring}`}
                    />
                </svg>
                <b className="absolute inset-0 grid place-items-center font-mono text-[13px] font-extrabold text-strong">{now}</b>
            </span>
            <span className="min-w-0">
                <b className="block text-[15.5px] font-bold text-strong">{c.name}</b>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    {tone === 'ok' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-[9px] py-[3px] font-bold text-success">
                            <Check size={11} strokeWidth={3} aria-hidden /> Nắm chắc
                        </span>
                    ) : weakest ? (
                        <span className="rounded-full bg-brand-50 px-[9px] py-[3px] font-bold text-brand-ink ring-1 ring-brand-100">Yếu nhất · ôn trước</span>
                    ) : (
                        <span className="rounded-full bg-warning/15 px-[9px] py-[3px] font-bold text-foreground">Cần ôn</span>
                    )}
                    <span className="font-mono text-[11.5px] font-bold text-muted-foreground">
                        {formatTime(c.segment.start)}–{formatTime(c.segment.end)}
                    </span>
                    {wrongIds.length > 0 && (
                        <button type="button" onClick={() => onWrong(wrongIds[0])} className="rounded-full bg-brand-50 px-2 py-[2px] font-bold text-brand-ink transition hover:bg-brand-100">
                            {wrongIds.length} câu sai ↓
                        </button>
                    )}
                </span>
            </span>
            <span className="relative h-2.5 rounded-[5px] bg-muted">
                <i className="absolute inset-y-0 left-0 rounded-[5px] bg-muted-foreground/30" style={{ width: `${was}%` }} />
                <i data-fx="now" data-final={`${now}%`} className={`rc-now absolute inset-y-0 left-0 rounded-[5px] ${fill}`} style={{ width: `${now}%` }} />
                <u className="absolute -top-[5px] h-5 w-0.5 rounded-sm bg-strong/60" style={{ left: `${pct(UNLOCK_THRESHOLD)}%` }} />
            </span>
            <span className="text-right">
                <b className="block font-mono text-lg font-extrabold text-strong">{now}%</b>
                <small className={`font-mono text-xs font-bold ${delta < 0 ? 'text-brand-ink' : delta > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {delta > 0 ? '+' : ''}
                    {delta}%
                </small>
            </span>
            <span className="text-right">
                {weakest ? (
                    <Link to={seek} className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-600 px-3 py-2 text-[13px] font-extrabold text-ink-foreground transition hover:bg-brand-700">
                        <Play size={12} className="fill-current" aria-hidden /> Xem lại {formatTime(c.segment.start)}
                    </Link>
                ) : (
                    <Link to={seek} className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-muted-foreground transition hover:text-strong">
                        Xem lại {formatTime(c.segment.start)}
                    </Link>
                )}
            </span>
        </div>
    )
}
