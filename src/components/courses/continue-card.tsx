import { Link } from 'react-router-dom'
import { ChevronDown, Play } from 'lucide-react'
import { clock, STRONG_MASTERY, type CourseSummary } from '@/lib/course-map'
import { useOrbitStore } from '@/store/useOrbitStore'
import { formatTime } from '@/lib/youtube'
import { FALLBACK_BG, Thumb } from '@/components/courses/thumb'

/**
 * Khối trái của /learning: nhãn "Học tiếp" + MỘT thẻ (khung video | thông tin bài đang dở) và chân thẻ là lộ trình các chặng thu gọn.
 * Chưa có bài đang dở thì thẻ hiện bài đầu của khóa được chọn với nút "Bắt đầu học".
 */
export function ContinueCard({ summary, expanded, onToggle }: { summary: CourseSummary; expanded: boolean; onToggle: (open: boolean) => void }) {
    const { course, lessons, pcts, curIndex, pct, status } = summary
    const progress = useOrbitStore((s) => s.lessonProgress)
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const idx = curIndex >= 0 ? curIndex : 0
    const lesson = lessons[idx]
    if (!lesson) return null
    const pos = progress[lesson.id]?.lastPositionSec ?? 0
    const resuming = pos > 0 && !progress[lesson.id]?.completed
    const watched = resuming ? Math.min(100, (pos / lesson.durationSec) * 100) : 0
    const remainMin = Math.max(1, Math.ceil((lesson.durationSec - (resuming ? pos : 0)) / 60))
    const strong = lesson.concepts.filter((c) => (mastery[c.id] ?? 0) >= STRONG_MASTERY).length
    const href = `/lesson/${lesson.id}${resuming ? `?t=${Math.floor(pos)}` : ''}`
    const action = status === 'done' ? 'Xem lại' : resuming ? `Học tiếp từ ${formatTime(pos)}` : 'Bắt đầu học'

    return (
        <article className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] grid-rows-[1fr_auto] overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_30px_60px_-36px_rgb(var(--brand-600)/0.45)]">
            <Link to={href} data-vt={`lesson-${lesson.id}`} aria-label={`${action}: ${lesson.title}`} className="group relative block min-h-[340px] overflow-hidden bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70" style={{ background: FALLBACK_BG }}>
                <div className="absolute inset-0 transition-transform duration-[6000ms] ease-out group-hover:scale-[1.04]">
                    <Thumb youtubeId={lesson.youtubeId} />
                </div>
                {resuming && <span className="absolute right-3.5 top-3.5 rounded-md bg-ink/60 px-2 py-1 font-mono text-xs font-bold text-ink-foreground">{formatTime(pos)} / {formatTime(lesson.durationSec)}</span>}
                <span aria-hidden className="absolute left-1/2 top-1/2 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink-foreground/95 text-brand-600 shadow-raised transition-transform duration-base ease-out group-hover:scale-[1.08]">
                    <Play size={26} className="ml-1 fill-current" />
                </span>
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[5px] bg-ink-foreground/25">
                    <i className="block h-full bg-brand-600" style={{ width: `${watched}%` }} />
                </span>
            </Link>

            <div className="flex flex-col px-8 py-[30px]">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-brand-ink">
                    <span aria-hidden className="relative h-2 w-2 shrink-0">
                        <span className="absolute inset-0 animate-ping rounded-full bg-brand-600/60 motion-reduce:animate-none" />
                        <span className="absolute inset-0 rounded-full bg-brand-600" />
                    </span>
                    {course.subject} · Chặng {String(idx + 1).padStart(2, '0')}/{lessons.length}
                </p>
                <h1 className="mt-3 text-[30px] font-black leading-[1.18] tracking-[-0.025em] text-strong">{lesson.title}</h1>
                <p className="mt-5 flex items-center gap-2.5 text-sm text-muted-foreground">
                    <span className="flex gap-1" aria-hidden>
                        {lesson.concepts.map((c) => {
                            const m = mastery[c.id] ?? 0
                            return <i key={c.id} title={c.name} className={`h-3 w-3 rounded-[3px] ${m >= STRONG_MASTERY ? 'bg-brand-600' : m > 0 ? 'bg-brand-300' : 'bg-muted'}`} />
                        })}
                    </span>
                    <span>
                        {strong}/{lesson.concepts.length} khái niệm vững · {resuming ? `còn ${remainMin} phút` : `${remainMin} phút`}
                    </span>
                </p>
                <div className="mt-auto pt-6">
                    <Link to={href} className="surface-red tier-1-bob inline-flex items-center gap-2.5 rounded-[14px] px-[22px] py-[15px] text-base font-extrabold text-ink-foreground shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                        <Play size={14} className="fill-current" /> {action}
                    </Link>
                </div>
            </div>

            <details open={expanded} onToggle={(e) => onToggle(e.currentTarget.open)} className="group/path col-span-2 border-t border-border">
                <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-[22px] px-[22px] py-4 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70">
                    <b className="whitespace-nowrap text-[14.5px] font-extrabold text-strong">
                        {course.title}
                        <em className="ml-2 font-mono text-[12.5px] font-semibold not-italic text-muted-foreground">{pct}%</em>
                    </b>
                    <span className="flex items-center" aria-hidden>
                        {lessons.map((l, i) => (
                            <span key={l.id} className="flex flex-1 items-center first:flex-none [&:not(:first-child)]:flex-1">
                                {i > 0 && <Seg fill={i - 1 < idx ? 100 : i - 1 === idx ? pcts[idx] : 0} />}
                                <i className={`h-3 w-3 shrink-0 rounded-full border-2 ${i === idx ? 'border-brand-600 bg-brand-600 shadow-[0_0_0_4px_rgb(var(--brand-600)/0.14)]' : pcts[i] >= 100 ? 'border-brand-600 bg-card' : 'border-border bg-card'}`} />
                            </span>
                        ))}
                        <span className="flex flex-1 items-center">
                            <Seg fill={lessons.length - 1 < idx ? 100 : lessons.length - 1 === idx ? pcts[idx] : 0} />
                            <i className="h-3 w-3 shrink-0 rotate-45 rounded-[3px] border-2 border-border bg-card" />
                        </span>
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13.5px] font-bold text-brand-ink">
                        Xem các chặng <ChevronDown size={14} className="transition-transform duration-base group-open/path:rotate-180" />
                    </span>
                </summary>
                <div className="grid grid-cols-4 gap-3.5 px-[22px] pb-[22px] pt-1">
                    {lessons.map((l, i) => (
                        <div key={l.id} className={`relative rounded-[14px] p-3 text-[13.5px] ${i === idx ? 'bg-brand-50 ring-2 ring-brand-200' : 'bg-muted'}`}>
                            <Link to={`/lesson/${l.id}`} aria-label={`Chặng ${i + 1}: ${l.title}`} className="absolute inset-0 rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70" />
                            <div className="relative mb-2.5 aspect-video overflow-hidden rounded-[10px]" style={{ background: FALLBACK_BG }}>
                                <Thumb youtubeId={l.youtubeId} />
                                <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-ink-foreground">{clock(l.durationSec)}</span>
                            </div>
                            <small className="font-mono text-[11.5px] text-muted-foreground">Chặng {String(i + 1).padStart(2, '0')}{i === idx && status === 'doing' ? ' · đang học' : ''}</small>
                            <b className="mt-0.5 block font-bold leading-[1.35] text-strong">{l.title}</b>
                            {pcts[i] >= 100 && (
                                <Link to={`/recap/${l.id}`} className="relative z-10 mt-2 inline-block text-xs font-bold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                                    Xem tổng kết
                                </Link>
                            )}
                        </div>
                    ))}
                    <div className="relative rounded-[14px] bg-muted p-3 text-[13.5px]">
                        <Link to={`/test/${course.id}`} aria-label={`Kiểm tra cuối khóa: ${course.title}`} className="absolute inset-0 rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70" />
                        <div aria-hidden className="mb-2.5 aspect-video rounded-[10px] bg-[repeating-conic-gradient(hsl(var(--border))_0_25%,hsl(var(--card))_0_50%)] [background-size:18px_18px]" />
                        <small className="font-mono text-[11.5px] text-muted-foreground">Đích</small>
                        <b className="mt-0.5 block font-bold leading-[1.35] text-strong">Kiểm tra cuối khóa</b>
                        {summary.record && <span className="font-mono text-xs text-muted-foreground">Tốt nhất {summary.record.bestCorrect}/{summary.record.bestTotal}</span>}
                    </div>
                </div>
            </details>
        </article>
    )
}

function Seg({ fill }: { fill: number }) {
    return (
        <span className="relative mx-1.5 h-[3px] flex-1 overflow-hidden rounded-sm bg-border">
            <i className="absolute inset-y-0 left-0 bg-brand-600" style={{ width: `${fill}%` }} />
        </span>
    )
}
