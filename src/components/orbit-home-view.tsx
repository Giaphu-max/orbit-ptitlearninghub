import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Flame, Play, Sparkles, Zap } from 'lucide-react'
import { dailyArticles, getConcept, getLesson, lessons } from '@/data'
import { levelFromXp, visibleStreak } from '@/lib/gamification'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'
import { CampusHero } from '@/components/home/campus-hero'

/** Trang chủ 3 tầng: hero tối + "Học tiếp" → Orbit Daily → dải tiến độ thu gọn. */
export function OrbitHomeView() {
    const role = useOrbitStore((s) => s.role)
    const review = useOrbitStore((s) => s.lessonReview)
    const progress = useOrbitStore((s) => s.lessonProgress)

    // Sinh viên chỉ thấy bài đã xuất bản; giảng viên thấy tất cả
    const visible = lessons.filter((l) => role === 'teacher' || (review[l.id] ?? l.status) === 'published')
    const inProgress = visible.find((l) => progress[l.id] && !progress[l.id].completed && progress[l.id].lastPositionSec > 0)
    const resume = inProgress ?? visible.find((l) => !progress[l.id]?.completed) ?? visible[0]
    const resumeAt = resume ? progress[resume.id]?.lastPositionSec ?? 0 : 0

    return (
        <div className="h-full w-full overflow-y-auto bg-surface">
            {/* ── Tầng 1: hero ── */}
            <section className="relative isolate overflow-hidden bg-[#12090A] text-white [background-image:radial-gradient(90%_80%_at_85%_15%,#C4161C_0%,transparent_60%),radial-gradient(70%_70%_at_5%_100%,#7A0C10_0%,transparent_65%),linear-gradient(160deg,#2A0E0F_0%,#12090A_100%)]">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 opacity-80 [background-image:radial-gradient(rgba(255,255,255,0.16)_1px,transparent_1.4px)] [background-size:28px_28px] [mask-image:linear-gradient(180deg,#000,transparent_80%)]"
                />
                <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-8 px-5 py-10 lg:px-10">
                    <div className="flex min-w-0 max-w-[440px] flex-[1_1_320px] flex-col gap-5">
                        <span className="text-eyebrow uppercase text-[#FFB4A8]">Orbit · PTIT Learning Hub</span>
                        <h1 className="text-[clamp(2.5rem,5vw,4.25rem)] font-black leading-[0.98] tracking-[-0.045em] [text-wrap:balance]">
                            Học tập trung, có điểm dừng.
                        </h1>
                        <p className="text-base leading-relaxed text-white/75">
                            Mỗi tòa nhà là một khu khóa học. Học đến đâu hiểu đến đó, điểm thưởng chỉ đến khi bạn thật sự nắm bài.
                        </p>

                        {resume ? (
                            <Link
                                to={`/lesson/${resume.id}`}
                                className="group mt-2 flex items-center gap-4 rounded-card bg-white p-4 text-gray-900 shadow-raised transition duration-base ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            >
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition duration-base group-hover:scale-105">
                                    <Play size={20} className="fill-current" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-eyebrow uppercase text-brand-600">{resumeAt > 0 ? 'Học tiếp' : 'Bắt đầu học'}</span>
                                    <span className="mt-1 block truncate font-bold">{resume.title}</span>
                                    {resumeAt > 0 && (
                                        <span className="block font-mono text-xs text-gray-500">
                                            Dừng ở {formatTime(resumeAt)} / {formatTime(resume.durationSec)}
                                        </span>
                                    )}
                                </span>
                                <ArrowRight size={18} className="shrink-0 text-gray-400 transition duration-base group-hover:translate-x-1 group-hover:text-brand-600" />
                            </Link>
                        ) : (
                            <p className="rounded-card bg-white/10 p-4 text-sm text-white/80">Chưa có bài nào được giảng viên xuất bản.</p>
                        )}
                        <span className="text-sm text-white/60">Rê chuột để xoay, di vào một tòa nhà để làm nổi nó lên.</span>
                    </div>

                    <div className="relative h-[clamp(380px,62vw,620px)] min-w-0 flex-[999_1_560px]">
                        <CampusHero />
                    </div>
                </div>
            </section>

            <div className="mx-auto flex max-w-[1320px] flex-col gap-12 px-5 py-12 lg:px-10">
                {/* ── Tầng 2: Orbit Daily ── */}
                <section aria-labelledby="daily-title">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-eyebrow uppercase text-brand-600">Orbit Daily</p>
                            <h2 id="daily-title" className="mt-2 text-headline text-gray-900">Hôm nay đọc gì?</h2>
                        </div>
                        <p className="text-sm text-gray-600">Tối đa 3 bài mỗi ngày, ưu tiên phần bạn còn yếu.</p>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-4">
                        {dailyArticles.slice(0, 3).map((a, i) => {
                            const first = a.paragraphs[0]?.sources[0]
                            const source = first ? getLesson(first.lessonId) : undefined
                            const big = i === 0
                            return (
                                <Link
                                    key={a.id}
                                    to={source ? `/lesson/${source.id}` : '/learning'}
                                    className={`group flex flex-col justify-between rounded-panel border border-border bg-card p-6 shadow-card transition duration-base ease-out hover:-translate-y-1 hover:border-brand-200 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                                        big ? 'md:col-span-2 md:row-span-1 md:p-8' : 'md:col-span-1'
                                    }`}
                                >
                                    <div>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-700">
                                            <Sparkles size={13} /> {big ? 'Ưu tiên hôm nay' : 'Gợi ý'} · {a.readingMinutes} phút
                                        </span>
                                        <h3 className={`mt-4 text-gray-900 ${big ? 'text-title md:text-[1.75rem] md:leading-tight' : 'text-lg font-bold leading-snug'}`}>{a.title}</h3>
                                        {big && <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-gray-600">{a.paragraphs[0]?.text}</p>}
                                    </div>
                                    <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                        {a.conceptIds.slice(0, 2).map((id) => (
                                            <span key={id} className="rounded-full bg-muted px-2.5 py-1 font-semibold">{getConcept(id)?.name ?? id}</span>
                                        ))}
                                        <span className="ml-auto inline-flex items-center gap-1 font-bold text-brand-600">
                                            Xem bài nguồn <ArrowRight size={14} className="transition duration-base group-hover:translate-x-1" />
                                        </span>
                                    </div>
                                </Link>
                            )
                        })}
                        {dailyArticles.length < 3 && (
                            <div className="flex flex-col justify-center rounded-panel border border-dashed border-border bg-white/60 p-6 text-sm text-gray-600 md:col-span-2">
                                <span className="font-bold text-gray-800">Còn {3 - dailyArticles.length} lượt hôm nay</span>
                                Hoàn thành thêm bài học để mở thêm bài đọc mới.
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Tầng 3: dải tiến độ ── */}
                <ProgressStrip total={visible.length} />
            </div>
        </div>
    )
}

function ProgressStrip({ total }: { total: number }) {
    const xp = useOrbitStore((s) => s.xp)
    const streakState = useOrbitStore((s) => s.streak)
    const progress = useOrbitStore((s) => s.lessonProgress)
    const mastery = useOrbitStore((s) => s.conceptMastery)

    const done = Object.values(progress).filter((p) => p.completed).length
    const tracked = Object.values(mastery)
    const avg = tracked.length ? Math.round((tracked.reduce((a, b) => a + b, 0) / tracked.length) * 100) : 0

    const items = [
        { icon: <Zap size={18} className="fill-brand-500 text-brand-500" />, label: `Cấp ${levelFromXp(xp)}`, value: `${xp} XP` },
        { icon: <Flame size={18} className="text-brand-500" />, label: 'Chuỗi ngày học', value: `${visibleStreak(streakState).count} ngày` },
        { icon: <BookOpen size={18} className="text-brand-500" />, label: 'Bài đã hoàn thành', value: `${done}/${total}` },
        { icon: <Sparkles size={18} className="text-brand-500" />, label: 'Mức nắm vững', value: tracked.length ? `${avg}%` : 'Chưa có' },
    ]
    return (
        <Link to="/journey" aria-label="Xem hành trình" className="group block"><section aria-label="Tiến độ của bạn" className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card md:grid-cols-4">
            {items.map((it) => (
                <div key={it.label} className="flex items-center gap-3 bg-card px-5 py-4">
                    {it.icon}
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-500">{it.label}</p>
                        <p className="truncate font-mono text-lg font-bold text-gray-900">{it.value}</p>
                    </div>
                </div>
            ))}
        </section></Link>
    )
}
