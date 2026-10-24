import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, Flame, PlayCircle } from 'lucide-react'
import { getLessonsOfCourse } from '@/data'
import { useEffectiveLesson, useCourseLessons } from '@/lib/lesson-edits'
import { buildRecap, type RecapBadge, type RecapConcept, type RecapData } from '@/lib/recap'
import { UNLOCK_THRESHOLD } from '@/lib/gamification'
import { TEST_PASS_RATIO, CHECKPOINT_QUESTION_COUNT } from '@/lib/final-test'
import { QUIZ_XP } from '@/lib/quiz'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'
import './recap/recap.css'

const RING_LEN = 194.8 // 2π · 31
const vi = (n: number) => Math.round(n).toLocaleString('vi-VN')
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** /recap/:lessonId – tổng kết chặng: mức nắm vững từng khái niệm trước/sau, học từ lỗi sai, huy hiệu mới, ôn tiếp, chặng kế. */
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
    const { lesson, course, index, concepts, checkpoint, xp, video } = data
    const markRecapSeen = useOrbitStore((s) => s.markRecapSeen)
    const totalXp = useOrbitStore((s) => s.xp)
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
        q('now').forEach((bar, i) => {
            bar.style.transition = 'none'
            bar.style.width = bar.dataset.was ?? '0%'
            void bar.offsetWidth
            bar.style.transition = ''
            later(() => (bar.style.width = bar.dataset.final ?? ''), 700 + i * 160)
        })
        q('state').forEach((st, i) => {
            st.style.opacity = '0'
            later(() => {
                st.style.opacity = ''
                st.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' })
            }, 1500 + i * 160)
        })
        const badge = q('badge')[0]
        if (badge) {
            badge.dataset.unlock = 'false'
            later(() => {
                badge.dataset.unlock = 'true'
                later(() => {
                    for (let i = 0; i < 14; i++) {
                        const s = document.createElement('span')
                        s.className = 'pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-ink-foreground'
                        s.style.left = '56px'
                        s.style.top = '92px'
                        badge.appendChild(s)
                        const a = Math.random() * Math.PI * 2
                        const d = 50 + Math.random() * 70
                        s.animate([{ opacity: 1, transform: 'translate(0,0) scale(1)' }, { opacity: 0, transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.3)` }], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => s.remove()
                    }
                }, 450)
            }, 1900)
        }
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
    const lessonConceptCount = concepts.length

    return (
        <div ref={root} data-play={play} className="w-full">
            <div className="container-page py-8 lg:py-12">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-14">
                    <div className="min-w-0">
                        <Link to={`/learning?course=${course.id}`} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                            <ChevronLeft size={16} /> {course.title}
                        </Link>
                        <StageTrack data={data} />

                        <div className="mt-9">
                            <p className="rc-rise text-xs font-extrabold uppercase tracking-[0.12em] text-brand-ink">Tổng kết chặng {index + 1}</p>
                            <h1 style={rise(1)} className="rc-rise mt-3.5 text-[clamp(2.75rem,6.4vw,5.25rem)] font-black leading-[0.98] tracking-[-0.045em] text-foreground [text-wrap:balance]">
                                {data.completed ? `Xong chặng ${index + 1}.` : `Chặng ${index + 1}.`}
                                <span className="mt-3 block text-[0.42em] font-extrabold leading-[1.2] tracking-[-0.025em] text-muted-foreground">
                                    Bạn đã nắm {data.masteredCount}/{lessonConceptCount} khái niệm của bài “{lesson.title}”.
                                </span>
                            </h1>
                            <p style={rise(2)} className="rc-rise mt-[18px] max-w-[60ch] text-[17px] leading-relaxed text-muted-foreground">
                                <Lead data={data} />
                            </p>
                        </div>

                        <div className="mt-8 grid grid-cols-2 border-y border-border">
                            <div className="col-span-2 flex items-center gap-4 border-b border-border py-5">
                                {checkpoint ? (
                                    <>
                                        <svg className="h-[76px] w-[76px] flex-none" viewBox="0 0 76 76" role="img" aria-label={`Test cuối chặng ${checkpoint.pct}%`}>
                                            <circle cx="38" cy="38" r="31" fill="none" strokeWidth="7" className="stroke-foreground/15" />
                                            <circle data-fx="ring" data-final={RING_LEN * (1 - checkpoint.correct / checkpoint.total)} className="rc-ring-fg stroke-brand-600" cx="38" cy="38" r="31" fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={RING_LEN} style={{ strokeDashoffset: RING_LEN * (1 - checkpoint.correct / checkpoint.total), transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
                                            <text x="38" y="44" textAnchor="middle" className="fill-foreground font-mono text-[17px] font-bold">
                                                {checkpoint.correct}/{checkpoint.total}
                                            </text>
                                        </svg>
                                        <div className="flex flex-col gap-1">
                                            <small className="text-xs font-semibold text-muted-foreground">Test cuối chặng</small>
                                            <span className="font-mono text-3xl font-bold leading-tight tracking-tight">
                                                <span data-fx="count" data-to={checkpoint.pct}>{checkpoint.pct}</span>%
                                            </span>
                                            <span className="text-[12.5px] text-muted-foreground">Ngưỡng đạt {Math.round(TEST_PASS_RATIO * 100)}%</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <small className="text-xs font-semibold text-muted-foreground">Test cuối chặng</small>
                                        <span className="text-[13px] text-muted-foreground">Chưa làm. {CHECKPOINT_QUESTION_COUNT} câu, mỗi khái niệm ít nhất một câu.</span>
                                        <Link to={`/checkpoint/${lesson.id}`} className="inline-flex items-center gap-2 self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                                            <PlayCircle size={16} /> Làm test {CHECKPOINT_QUESTION_COUNT} câu
                                        </Link>
                                    </div>
                                )}
                            </div>
                            <div className="flex min-w-0 flex-col gap-1 py-5 pr-4">
                                <small className="text-xs font-semibold text-muted-foreground">XP chặng này</small>
                                <span className="font-mono text-3xl font-bold leading-tight tracking-tight">
                                    +<span data-fx="count" data-to={xp.gain} data-dur="1400" data-delay="400">{vi(xp.gain)}</span>
                                </span>
                                <span className="text-[12.5px] text-muted-foreground">{xpNote(data)}</span>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1 border-l border-border py-5 pl-5">
                                <small className="text-xs font-semibold text-muted-foreground">Câu trong video</small>
                                <span className="font-mono text-3xl font-bold leading-tight tracking-tight">
                                    {video.correct + video.corrected + video.missed}
                                    <span className="text-[0.5em] font-medium text-muted-foreground">/{video.total} câu</span>
                                </span>
                                <span className="text-[12.5px] text-muted-foreground">
                                    <b className="font-mono text-foreground">{video.correct}</b> đúng ngay · <b className="font-mono text-foreground">{video.corrected}</b> sửa được · <b className="font-mono text-foreground">{video.missed}</b> bỏ lỡ
                                </span>
                            </div>
                        </div>

                        <section className="mt-12" aria-labelledby="h-mastery">
                            <div className="flex flex-wrap items-baseline justify-between gap-4">
                                <h2 id="h-mastery" className="text-2xl font-extrabold tracking-[-0.025em] text-foreground">Mức nắm vững từng khái niệm</h2>
                                <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
                                    <span><i className="mr-1.5 inline-block h-1.5 w-3.5 rounded-sm bg-foreground/15 align-middle" />Đầu chặng</span>
                                    <span><i className="mr-1.5 inline-block h-1.5 w-3.5 rounded-sm bg-brand-600 align-middle" />Bây giờ</span>
                                </div>
                            </div>
                            <ol className="mt-[18px] grid">
                                {concepts.map((c, i) => (
                                    <ConceptRow key={c.id} c={c} lessonId={lesson.id} first={i === 0} />
                                ))}
                            </ol>
                        </section>

                        <MistakeSection data={data} />
                    </div>

                    <aside className="grid gap-4 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
                        <BadgeCards data={data} />
                        <ReviewCard data={data} />
                        <NextCard data={data} />
                    </aside>
                </div>
            </div>
        </div>
    )
}

// ─── Thanh tiến độ khóa ────────────────────────────────────────────────────

function StageTrack({ data }: { data: RecapData }) {
    return (
        <ol aria-label="Tiến độ khóa học" className="mt-8 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted-foreground">
            {data.stages.map((st, i) => {
                const here = i === data.index
                return (
                    <li key={st.lesson.id} className="contents">
                        {i > 0 && (
                            <span aria-hidden className="relative h-0.5 w-8 overflow-hidden rounded bg-foreground/15">
                                {data.stages[i - 1].state === 'done' && <span className="rc-track-fill absolute inset-0 bg-brand-600" />}
                            </span>
                        )}
                        <span className={`flex items-center gap-2 ${st.state === 'done' ? 'font-semibold text-foreground' : ''} ${here ? 'text-foreground' : ''}`}>
                            <span className={`grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] font-mono text-[11px] font-bold ${st.state === 'done' ? 'border-brand-600 bg-brand-600 text-ink-foreground' : st.state === 'open' ? 'border-brand-600 text-brand-ink' : 'border-foreground/15'}`}>
                                {st.state === 'done' ? <Check size={12} strokeWidth={3} /> : i + 1}
                            </span>
                            <span className={here ? '' : 'hidden sm:inline'}>
                                {here || st.state !== 'todo' ? `Chặng ${i + 1} · ` : ''}
                                {st.lesson.shortTitle ?? st.lesson.title}
                            </span>
                        </span>
                    </li>
                )
            })}
        </ol>
    )
}

// ─── Câu tóm tắt dưới tiêu đề ──────────────────────────────────────────────

function Lead({ data }: { data: RecapData }) {
    const { checkpoint, weakest, review } = data
    const test = checkpoint ? (
        <>
            Bài test cuối chặng đúng <b className="text-foreground">{checkpoint.correct}/{checkpoint.total} câu</b>, {checkpoint.passed ? 'vượt' : 'chưa tới'} ngưỡng {Math.round(TEST_PASS_RATIO * 100)}%.{' '}
        </>
    ) : (
        <>Bạn chưa làm bài test cuối chặng; làm xong, số liệu ở đây sẽ đầy đủ hơn. </>
    )
    if (!weakest) return <>{test}Cả {data.concepts.length} khái niệm đều từ {Math.round(UNLOCK_THRESHOLD * 100)}% trở lên, không có chỗ hổng nào cần ôn.</>
    return (
        <>
            {test}Khái niệm còn yếu là <b className="text-foreground">{weakest.name}</b>
            {review?.daily ? ', hệ thống đã xếp nó vào bài đọc ngày mai.' : '. Xem lại đoạn video của nó trước khi sang chặng sau.'}
        </>
    )
}

function xpNote(data: RecapData) {
    const { xp } = data
    const parts = [xp.correct && `Đúng ngay ${xp.correct}`, xp.corrected && `Sửa được lỗi ${xp.corrected}`, xp.test && `Test ${xp.test}`, xp.other && `Khác ${xp.other}`].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'Chưa có XP trong chặng này'
}

// ─── Khái niệm ─────────────────────────────────────────────────────────────

function TimeChip({ lessonId, start, end, play }: { lessonId: string; start: number; end?: number; play?: boolean }) {
    return (
        <Link to={`/lesson/${lessonId}?t=${Math.floor(start)}`} className="whitespace-nowrap rounded-full bg-brand-soft px-[9px] py-[3px] font-mono text-[11.5px] font-bold text-brand-ink transition hover:bg-brand-600 hover:text-ink-foreground">
            {play && '▶ Xem lại '}
            {formatTime(start)}
            {end !== undefined && `–${formatTime(end)}`}
        </Link>
    )
}

function ConceptRow({ c, lessonId, first }: { c: RecapConcept; lessonId: string; first: boolean }) {
    const now = Math.round(c.now * 100)
    const was = Math.round(c.was * 100)
    return (
        <li className={`grid grid-cols-[minmax(0,1fr)_72px] items-center gap-x-3.5 gap-y-2.5 border-t border-border py-4 last:border-b sm:grid-cols-[minmax(0,1fr)_220px_96px] sm:gap-5`}>
            <div className="min-w-0">
                <div className="text-[15.5px] font-bold text-foreground">{c.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted-foreground">
                    <TimeChip lessonId={lessonId} start={c.segment.start} end={c.segment.end} />
                    <span data-fx="state" className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${c.mastered ? 'bg-success/15 text-success' : 'bg-warning/25 text-foreground'}`}>
                        {c.mastered ? '✓ Nắm chắc' : 'Cần ôn'}
                    </span>
                    {c.note && <span>{c.note}</span>}
                </div>
            </div>
            <div className="relative order-3 col-span-2 h-2.5 rounded-md bg-muted sm:order-none sm:col-span-1" role="img" aria-label={`Từ ${was}% lên ${now}%`}>
                <span className="absolute inset-y-0 left-0 rounded-md bg-foreground/15" style={{ width: `${was}%` }} />
                <span data-fx="now" data-was={`${was}%`} data-final={`${now}%`} className={`rc-now absolute inset-y-0 left-0 rounded-md ${c.mastered ? 'bg-brand-600' : 'bg-warning'}`} style={{ width: `${now}%` }} />
                <span aria-hidden className="absolute -bottom-[5px] -top-[5px] left-[80%] w-0.5 rounded-sm bg-foreground/55">
                    {first && <span className="absolute -top-[17px] left-1/2 -translate-x-1/2 font-mono text-[9.5px] text-muted-foreground">80%</span>}
                </span>
            </div>
            <div className="text-right font-mono text-[13px] text-muted-foreground">
                <b className="block text-xl text-foreground">{now}%</b>từ {was}%
            </div>
        </li>
    )
}

// ─── Học từ lỗi sai ────────────────────────────────────────────────────────

function MistakeSection({ data }: { data: RecapData }) {
    const { mistake, video, lesson } = data
    const answered = video.correct + video.corrected + video.missed
    const head = (sub: string) => (
        <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="h-mistake" className="text-2xl font-extrabold tracking-[-0.025em] text-foreground">Học từ lỗi sai</h2>
            <p className="text-[13px] text-muted-foreground">{sub}</p>
        </div>
    )
    if (!mistake) {
        const msg =
            answered === 0
                ? 'Bạn chưa làm câu quiz nào trong video của chặng này.'
                : video.missed > 0
                  ? `${video.missed} câu trong video chưa đúng, nên xem lại đoạn tương ứng.`
                  : `Đúng ngay cả ${video.correct} câu trong video. Chưa có lỗi nào cần sửa, giữ phong độ này.`
        return (
            <section className="mt-[52px]" aria-labelledby="h-mistake">
                {head('Sai rồi sửa đúng được XP gấp đôi')}
                <p className="mt-[18px] flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5 text-[15px] text-foreground">
                    {video.missed === 0 && answered > 0 && <Check size={18} className="text-success" aria-hidden />}
                    <span>{msg}</span>
                    {answered === 0 && (
                        <Link to={`/lesson/${lesson.id}`} className="font-bold text-brand-ink hover:underline">Vào học bài</Link>
                    )}
                </p>
            </section>
        )
    }
    const { root, firstWrong, fixed, others, reviewCount } = mistake
    return (
        <section className="mt-[52px]" aria-labelledby="h-mistake">
            {head(`${video.corrected} câu sai trong video đã được sửa đúng, mỗi câu nhận XP gấp đôi.`)}
            <div className="mt-[18px] grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-2 p-5">
                    <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Lần đầu · {formatTime(root.pauseAt)}</span>
                    <p className="text-sm text-foreground">{root.prompt}</p>
                    {firstWrong && <span className="rounded-[10px] bg-brand-soft px-[11px] py-[9px] text-[13.5px] leading-snug text-foreground line-through decoration-brand-600 decoration-[1.5px]">{firstWrong}</span>}
                </div>
                <div className="flex min-w-0 flex-col gap-2 border-t border-border p-5 md:border-l md:border-t-0">
                    <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Trợ giảng AI</span>
                    <p className="text-sm text-foreground">
                        Giải thích lỗi sai, rồi tua lại đoạn <TimeChip lessonId={lesson.id} start={root.answerSegment.start} end={root.answerSegment.end} /> chứa đáp án.
                    </p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 border-t border-border p-5 md:border-l md:border-t-0">
                    <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Câu biến thể</span>
                    {fixed && <span className="rounded-[10px] bg-success/15 px-[11px] py-[9px] text-[13.5px] leading-snug text-foreground">{fixed.options[fixed.correctIndex]}</span>}
                    <span className="font-mono font-bold text-success">✓ +{QUIZ_XP.corrected} XP (×2)</span>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
                <span>
                    {others.length > 0 ? (
                        <>
                            Câu còn lại: <b className="text-foreground">{others.map((o) => o.conceptName).join(', ')}</b>, sửa đúng ở lần thứ {others[0].attempts}.
                        </>
                    ) : (
                        'Đây là câu sai duy nhất của chặng.'
                    )}
                </span>
                <Link to={`/lesson/${lesson.id}?t=${Math.floor(root.answerSegment.start)}`} className="whitespace-nowrap rounded-full bg-brand-soft px-[9px] py-[3px] text-[11.5px] font-bold text-brand-ink transition hover:bg-brand-600 hover:text-ink-foreground">
                    Xem lại {reviewCount} câu đã sai
                </Link>
            </div>
        </section>
    )
}

// ─── Cột phải ──────────────────────────────────────────────────────────────

function Medal() {
    return (
        <svg className="rc-medal h-20 w-[72px] flex-none" viewBox="0 0 72 80" aria-hidden>
            <path d="M36 2 68 20v40L36 78 4 60V20Z" className="fill-ink-foreground/15 stroke-ink-foreground/70" strokeWidth="2" />
            <path d="M36 12 59 25v30L36 68 13 55V25Z" className="fill-ink-foreground" />
            <rect x="21" y="29" width="18" height="6" rx="3" className="fill-brand-600" />
            <rect x="29" y="38" width="22" height="6" rx="3" className="fill-brand-600/75" />
            <rect x="24" y="47" width="14" height="6" rx="3" className="fill-brand-600/50" />
            <rect x="43" y="25" width="2.4" height="32" rx="1.2" className="fill-ink" />
        </svg>
    )
}

function BadgeCards({ data }: { data: RecapData }) {
    const fresh = data.newBadges[0]
    const near = data.nearBadge
    return (
        <>
            {fresh ? (
                <div data-fx="badge" data-unlock="true" className="bg-reward relative overflow-hidden rounded-2xl p-[22px] shadow-raised">
                    <span aria-hidden className="rc-shine pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,hsl(var(--ink-foreground)/0.35)_50%,transparent_65%)]" />
                    <div className="text-[11.5px] font-bold uppercase tracking-[0.1em] opacity-85">Huy hiệu mới{data.newBadges.length > 1 ? ` · +${data.newBadges.length - 1} huy hiệu khác` : ''}</div>
                    <div className="mt-3.5 flex items-center gap-4">
                        <Medal />
                        <div>
                            <h3 className="text-[22px] font-bold leading-tight tracking-tight">{fresh.badge.name}</h3>
                            <p className="mt-1.5 text-[13px] opacity-90">{fresh.badge.description}</p>
                        </div>
                    </div>
                    <div className="mt-4 grid gap-1.5 text-[12.5px]">
                        {fresh.rows.map((r) => (
                            <div key={r.label} className="flex justify-between gap-3 border-t border-ink-foreground/25 pt-1.5">
                                <span>{r.label}</span>
                                <span className="font-mono font-bold">{r.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                near && <NearBadge b={near} big />
            )}
            {fresh && near && <NearBadge b={near} />}
        </>
    )
}

function NearBadge({ b, big }: { b: RecapBadge; big?: boolean }) {
    const ratio = Math.round((b.current / b.target) * 100)
    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            {big && <div className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Huy hiệu gần đạt nhất</div>}
            <div className={`flex items-center justify-between gap-3 text-[13px] ${big ? 'mt-2' : ''}`}>
                <span className="font-bold text-foreground">{b.badge.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{b.current}/{b.target}</span>
            </div>
            <span className="mt-2 block h-1.5 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={ratio} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ huy hiệu ${b.badge.name}`}>
                <i className="block h-full rounded bg-brand-600" style={{ width: `${ratio}%` }} />
            </span>
            {big && <p className="mt-2.5 text-[13px] text-muted-foreground">{b.badge.description}</p>}
        </div>
    )
}

function ReviewCard({ data }: { data: RecapData }) {
    const { review, lesson } = data
    if (!review) {
        return (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-1.5 text-xs font-bold text-success"><Check size={14} /> Không còn gì cần ôn</div>
                <p className="mt-2 text-[13.5px] text-muted-foreground">Cả {data.concepts.length} khái niệm của chặng đều từ {Math.round(UNLOCK_THRESHOLD * 100)}% trở lên.</p>
            </div>
        )
    }
    const { concept, daily, dailyQueued } = review
    return (
        <div className="rounded-2xl border border-warning bg-warning/10 p-5">
            <div className="text-xs font-bold text-foreground">Ôn tiếp · {Math.round(concept.now * 100)}%</div>
            <h4 className="mt-1.5 text-base font-bold text-foreground">{concept.name}</h4>
            <p className="mb-3 mt-1.5 text-[13.5px] text-muted-foreground">
                {daily ? (
                    <>
                        Bài đọc ngày mai sẽ ưu tiên <Link to={`/daily/${daily.id}`} className="font-semibold text-foreground underline-offset-2 hover:underline">“{daily.title}”</Link>, vì có khái niệm này. Muốn ôn luôn thì xem lại đoạn video gốc.
                    </>
                ) : dailyQueued ? (
                    <>Bài đọc “{dailyQueued.title}” có khái niệm này nhưng chưa nằm trong 3 bài ưu tiên ngày mai. Xem lại đoạn video gốc để ôn ngay.</>
                ) : (
                    <>Chưa có bài đọc nào về khái niệm này, nên cách ôn tốt nhất là xem lại đoạn video gốc.</>
                )}
            </p>
            <TimeChip lessonId={lesson.id} start={concept.segment.start} end={concept.segment.end} play />
        </div>
    )
}

function NextCard({ data }: { data: RecapData }) {
    const { next, course, index, completed } = data
    const lesson = next.lesson
    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-1.5 text-xs font-bold text-success">
                {completed ? <Check size={14} /> : <Flame size={14} />} {lesson ? (completed ? 'Chặng tiếp theo' : 'Chặng tiếp theo, sau khi xong chặng này') : 'Đích của khóa'}
            </div>
            <h4 className="mt-2 text-lg font-bold leading-snug tracking-tight text-foreground">{lesson ? `Chặng ${index + 2} · ${lesson.title}` : `Test cuối chương · ${course.title}`}</h4>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
                {lesson ? `${lesson.concepts.length} khái niệm, 1 video ${formatTime(lesson.durationSec)}.` : 'Đây là chặng cuối của khóa. Test cuối chương gom kiến thức của cả khóa.'}
                {next.unlocked.length > 0 && (
                    <>
                        {' '}
                        Vừa mở trên cây kỹ năng: <b className="text-foreground">{next.unlocked.map((u) => u.name).join(', ')}</b> (nhờ nắm {[...new Set(next.unlocked.map((u) => u.because))].join('; ')} từ {Math.round(UNLOCK_THRESHOLD * 100)}%).
                    </>
                )}
            </p>
            <Link to={next.to} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-[18px] py-3.5 text-[15px] font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                {next.label} <ArrowRight size={16} />
            </Link>
            <Link to={`/learning?course=${course.id}`} className="mt-2.5 block text-center text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
                Về trang khóa học
            </Link>
        </div>
    )
}
