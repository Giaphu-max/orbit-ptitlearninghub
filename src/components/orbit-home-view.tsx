import { Link } from 'react-router-dom'
import { ArrowRight, Check, Play } from 'lucide-react'
import { dailyArticles, getConcept, getCourse, getLesson, lessons } from '@/data'
import type { DailyArticle } from '@/data/types'
import { buildSkillTree, dailyFor, DAILY_ARTICLE_XP, MISSIONS, UNLOCK_THRESHOLD } from '@/lib/gamification'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'
import { CampusHero } from '@/components/home/campus-hero'
import { SiteFooter } from '@/components/site-footer'
import { SectionHeading } from '@/components/section-heading'
import { CoursesSection } from '@/components/home/courses-section'
import { StudioSection } from '@/components/home/studio-section'

const DAILY_LIMIT = 3

/** Trang chủ 3 tầng theo mockup: hero tối (nav trong suốt, lời chào, thẻ Học tiếp, mô hình 3D) → Orbit Daily → Tiến độ của bạn. */
export function OrbitHomeView() {
    return (
        <div className="w-full bg-surface">
            <Hero />
            <div className="container-page flex flex-col gap-16 pb-16 pt-6">
                <DailySection />
                <CoursesSection />
                <StudioSection />
                <ProgressSection />
            </div>
            <SiteFooter />
        </div>
    )
}

// ─── Tầng 1: hero ──────────────────────────────────────────────────────────

function Hero() {
    const role = useOrbitStore((s) => s.role)
    const name = useOrbitStore((s) => s.learnerName)
    const review = useOrbitStore((s) => s.lessonReview)
    const progress = useOrbitStore((s) => s.lessonProgress)

    // Sinh viên chỉ thấy bài đã xuất bản; giảng viên thấy tất cả
    const visible = lessons.filter((l) => role === 'teacher' || (review[l.id] ?? l.status) === 'published')
    const inProgress = visible.find((l) => progress[l.id] && !progress[l.id].completed && progress[l.id].lastPositionSec > 0)
    const resume = inProgress ?? visible.find((l) => !progress[l.id]?.completed) ?? visible[0]
    const resumeAt = resume ? progress[resume.id]?.lastPositionSec ?? 0 : 0
    const pct = resume ? Math.min(100, Math.round((resumeAt / resume.durationSec) * 100)) : 0

    return (
        <section id="top" className="relative isolate overflow-hidden bg-hero pt-[var(--nav-h)] text-ink-foreground">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-stripes" />
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-80 bg-dots mask-fade-b" />
            {/* Đốm sáng trôi + sao lấp lánh (mockup Main): chỉ transform và opacity */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -left-[10%] top-[30%] h-[520px] w-[520px] animate-blob-a rounded-full bg-[hsl(var(--hero-glow))] opacity-45 blur-[110px]" />
                <div className="absolute -right-[6%] -top-[18%] h-[600px] w-[600px] animate-blob-b rounded-full bg-[hsl(var(--reward-from))] opacity-35 blur-[130px]" />
                <span className="absolute left-[56%] top-[20%] h-1 w-1 animate-twinkle-a rounded-full bg-ink-foreground" />
                <span className="absolute left-[80%] top-[12%] h-[3px] w-[3px] animate-twinkle-b rounded-full bg-ink-foreground" />
                <span className="absolute left-[62%] top-[78%] h-1 w-1 animate-twinkle-c rounded-full bg-warning" />
            </div>

            <div className="container-page relative z-10 grid items-center gap-8 pb-24 pt-4 lg:min-h-[clamp(560px,78svh,740px)] lg:grid-cols-2 lg:gap-12 lg:pb-24">
                <div className="flex min-w-0 flex-col gap-6">
                    <h1 className="animate-rise-1 text-[clamp(2.75rem,8vw,4.5rem)] lg:text-[clamp(2.75rem,5.2vw,6rem)] font-black leading-[0.96] tracking-[-0.045em] [text-wrap:balance]">
                        Chào {name}.
                        <br />
                        Hôm nay chỉ cần
                        <br />
                        <span className="text-brand-light">25 phút.</span>
                    </h1>
                    <p className="max-w-xl animate-rise-2 text-lg leading-relaxed text-ink-foreground/75">
                        Học tiếp bài đang dở, rồi đọc 3 bài ngắn AI chọn riêng cho phần bạn còn hổng.
                    </p>

                    {resume ? (
                        <Link
                            to={`/lesson/${resume.id}`}
                            className="group pointer-events-auto relative mt-1 flex animate-rise-3 items-center gap-4 overflow-hidden rounded-[22px] bg-card p-3 pr-4 text-foreground shadow-raised transition duration-base ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70"
                        >
                            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[40%] animate-sheen bg-gradient-to-r from-transparent via-brand-500/20 to-transparent" />
                            <GridThumb />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-eyebrow uppercase text-brand-ink">
                                    {resumeAt > 0 ? 'Học tiếp' : 'Bắt đầu'} · {getCourse(resume.courseId)?.title ?? 'Khóa học'}
                                </span>
                                <span className="mt-1.5 line-clamp-2 text-lg font-bold leading-snug">{resume.title}</span>
                                <span className="mt-3 flex items-center gap-3">
                                    <span
                                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                                        role="progressbar"
                                        aria-valuenow={pct}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label="Tiến độ bài đang học"
                                    >
                                        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                                    </span>
                                    <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
                                </span>
                            </span>
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-ink-foreground shadow-brand transition duration-base group-hover:scale-105">
                                <Play size={20} className="ml-0.5 fill-current" />
                            </span>
                        </Link>
                    ) : (
                        <p className="max-w-md rounded-card bg-ink-foreground/10 p-4 text-sm text-ink-foreground/80">Chưa có bài nào được giảng viên xuất bản.</p>
                    )}
                    <span className="hidden text-sm text-ink-foreground/60 lg:block">Kéo để xoay mô hình, di vào một tòa nhà để làm nổi nó lên.</span>
                </div>

                {/* Cột mô hình: cạnh phải trùng lề phải trang, cạnh trái chữ trùng lề trái; canvas nằm gọn trong cột */}
                <div className="relative h-[400px] min-w-0 sm:h-[460px] lg:h-[clamp(460px,62svh,640px)]">
                    <CampusHero />
                </div>
            </div>

            {/* Đáy hero là đường cong mềm */}
            <svg aria-hidden viewBox="0 0 1440 90" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-px left-0 z-20 h-12 w-full fill-surface lg:h-20">
                <path d="M0,58 C220,8 470,6 720,42 C980,80 1220,78 1440,26 L1440,90 L0,90 Z" />
            </svg>
        </section>
    )
}

/** Ảnh thu nhỏ có lưới 1/3 (2 đường dọc, 2 đường ngang mờ) và chấm chủ thể ở một giao điểm, như mockup. */
function GridThumb() {
    return (
        <span className="relative block h-[92px] w-[92px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-300" aria-hidden>
            <span
                className="absolute inset-0 bg-[length:33.333%_33.333%] opacity-100"
                style={{
                    backgroundImage:
                        'linear-gradient(hsl(var(--ink-foreground) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--ink-foreground) / 0.3) 1px, transparent 1px)',
                }}
            />
            <span className="absolute left-[66.66%] top-[33.33%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-foreground shadow-card" />
        </span>
    )
}

// ─── Tầng 2: Orbit Daily ───────────────────────────────────────────────────

/** Bài ưu tiên = bài có khái niệm bạn còn yếu nhất (chưa làm quiz thì coi như 50%). */
function gapScore(a: DailyArticle, mastery: Record<string, number>) {
    return a.conceptIds.reduce((sum, id) => sum + (1 - (mastery[id] ?? 0.5)), 0) / Math.max(1, a.conceptIds.length)
}

function DailySection() {
    const read = useOrbitStore((s) => s.dailyRead)
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const today = new Date()
    const dateLabel = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`

    const articles = dailyArticles.slice(0, DAILY_LIMIT)
    const readCount = articles.filter((a) => read[a.id]).length
    const unread = articles.filter((a) => !read[a.id])
    const priority = [...unread].sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery))[0]
    const side = (priority ? articles.filter((a) => a.id !== priority.id) : articles).slice(0, 2)

    return (
        <section id="daily" aria-labelledby="daily-title" className="section-anchor">
            <SectionHeading id="daily-title" eyebrow={`Orbit Daily · ${dateLabel}`} title="3 bài đọc. Rồi nghỉ.">
                <div className="flex items-center gap-3" role="img" aria-label={`Đã đọc ${readCount} trên ${DAILY_LIMIT} bài hôm nay`}>
                    <div className="flex gap-1.5">
                        {Array.from({ length: DAILY_LIMIT }, (_, i) => (
                            <span key={i} className={`h-1.5 w-11 rounded-full transition-colors duration-slow ${i < readCount ? 'bg-brand-600' : 'bg-border'}`} />
                        ))}
                    </div>
                    <span className="font-mono text-sm font-semibold text-muted-foreground">
                        {readCount}/{DAILY_LIMIT}
                    </span>
                </div>
            </SectionHeading>

            <div className="mt-7 grid gap-5 lg:grid-cols-3 lg:grid-rows-2">
                {priority ? <PriorityCard article={priority} /> : <DoneCard articles={articles} />}
                {side.map((a) => (
                    <SmallCard key={a.id} article={a} index={articles.indexOf(a)} done={Boolean(read[a.id])} />
                ))}
            </div>
        </section>
    )
}

function PriorityCard({ article }: { article: DailyArticle }) {
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const weakest = [...article.conceptIds].sort((a, b) => (mastery[a] ?? 0.5) - (mastery[b] ?? 0.5))[0]
    const concept = getConcept(weakest)
    const m = mastery[weakest]
    const reason = concept ? (m === undefined ? `Ưu tiên · bạn chưa làm quiz “${concept.name}”` : `Ưu tiên · “${concept.name}” mới nắm ${Math.round(m * 100)}%`) : 'Ưu tiên cho bạn hôm nay'
    const src = article.paragraphs[0]?.sources[0]
    const lesson = src ? getLesson(src.lessonId) : undefined

    return (
        <Link
            to={`/daily/${article.id}`}
            className="group relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[28px] surface-red p-7 shadow-brand transition duration-base ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 lg:col-span-2 lg:row-span-2 lg:p-9"
        >
            <span aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[440px] w-[440px] rounded-full border border-ink-foreground/25" />
            <span aria-hidden className="pointer-events-none absolute -bottom-5 -right-5 h-[200px] w-[200px] animate-spin-24 rounded-full border border-ink-foreground/20">
                <span className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink-foreground" />
            </span>
            <div className="relative">
                <span className="on-red-chip inline-flex rounded-full px-3.5 py-1.5 text-xs font-extrabold">{reason}</span>
                <h3 className="mt-6 max-w-xl text-[clamp(1.75rem,3.2vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">{article.title}</h3>
                {lesson && src && (
                    <p className="mt-4 text-[15px] on-red-muted">
                        Tổng hợp từ {lesson.title} (<span className="font-mono">{formatTime(src.start)}</span>).
                    </p>
                )}
            </div>
            <div className="relative mt-10 flex flex-wrap items-center gap-4">
                <span className="on-red-btn inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold shadow-raised transition duration-base group-hover:gap-3">
                    Đọc ngay <ArrowRight size={16} />
                </span>
                <span className="on-red-muted text-sm">
                    {article.readingMinutes} phút · +{DAILY_ARTICLE_XP} XP
                </span>
            </div>
        </Link>
    )
}

/** Đã đọc cả 3 bài: màn "Hôm nay đủ rồi" kèm tóm tắt những gì đã học. */
function DoneCard({ articles }: { articles: DailyArticle[] }) {
    return (
        <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[28px] surface-red p-7 shadow-brand lg:col-span-2 lg:row-span-2 lg:p-9">
            <div>
                <span className="on-red-chip inline-flex rounded-full px-3.5 py-1.5 text-xs font-extrabold">Xong 3/3</span>
                <h3 className="mt-6 text-[clamp(1.75rem,3.2vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">Hôm nay đủ rồi. Hẹn bạn ngày mai.</h3>
                <p className="mt-4 text-[15px] on-red-muted">Hôm nay bạn đã học:</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
                    {articles.map((a) => (
                        <li key={a.id} className="flex items-start gap-2">
                            <Check size={16} className="mt-1 shrink-0" /> {a.title}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}

function SmallCard({ article, index, done }: { article: DailyArticle; index: number; done: boolean }) {
    return (
        <Link
            to={`/daily/${article.id}`}
            className={`group flex min-h-[140px] flex-col justify-between rounded-3xl border p-6 transition duration-base ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                done ? 'border-transparent bg-muted' : 'border-border bg-card shadow-card hover:-translate-y-1 hover:border-brand-200 hover:shadow-raised'
            }`}
        >
            <div>
                <p className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                    <span>
                        {String(index + 1).padStart(2, '0')} · {done ? 'Đã đọc' : 'Mở rộng'}
                    </span>
                    {done && <Check size={16} className="text-success" />}
                </p>
                <h3 className={`mt-3 text-xl font-extrabold leading-snug tracking-tight ${done ? 'text-muted-foreground' : 'text-foreground'}`}>{article.title}</h3>
            </div>
            <p className={`mt-5 text-sm ${done ? 'font-semibold text-success' : 'text-muted-foreground'}`}>
                {done ? `+${DAILY_ARTICLE_XP} XP đã nhận` : `${article.readingMinutes} phút · +${DAILY_ARTICLE_XP} XP`}
            </p>
        </Link>
    )
}

// ─── Tầng 3: Tiến độ của bạn ───────────────────────────────────────────────

function ProgressSection() {
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const dailyRaw = useOrbitStore((s) => s.daily)
    const daily = dailyFor(dailyRaw)

    const nodes = buildSkillTree(mastery).sort((a, b) => a.depth - b.depth)
    const first = nodes[0]
    const course = first ? getCourse(getLesson(first.lessonId)?.courseId ?? '') : undefined
    const current = nodes.find((n) => n.unlocked && n.mastery < UNLOCK_THRESHOLD)
    const locked = nodes.find((n) => !n.unlocked)
    const missionsDone = MISSIONS.filter((m) => m.progress(daily) >= m.target).length

    return (
        <section id="progress" aria-labelledby="progress-title" className="section-anchor">
            <SectionHeading id="progress-title" eyebrow="Tiến độ của bạn" title="Đi đều, hiểu chắc." />
            <div className="mt-7 grid gap-5 lg:grid-cols-[1.9fr_1fr]">
                <div className="rounded-[26px] border border-border bg-card p-6 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-foreground">Cây kỹ năng · {course?.title ?? 'Chưa có khóa học'}</h3>
                        <Link to="/journey" className="text-sm font-bold text-brand-ink underline underline-offset-4">
                            Mở cây kỹ năng
                        </Link>
                    </div>
                    <ol className="mt-6 flex items-center" aria-label="Các khái niệm trong cây kỹ năng">
                        {nodes.map((n, i) => {
                            const mastered = n.mastery >= UNLOCK_THRESHOLD
                            return (
                                <li key={n.concept.id} className="flex items-center" style={{ flex: i < nodes.length - 1 ? '1 1 0' : '0 0 auto' }}>
                                    <span
                                        title={`${n.concept.name}: ${Math.round(n.mastery * 100)}%`}
                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                            mastered
                                                ? 'bg-brand-600 text-ink-foreground'
                                                : n.unlocked
                                                  ? 'border-[3px] border-brand-600 bg-brand-soft font-mono text-brand-ink'
                                                  : 'border-2 border-dashed border-border text-muted-foreground'
                                        }`}
                                    >
                                        {mastered ? <Check size={18} /> : n.unlocked ? `${Math.round(n.mastery * 100)}` : ''}
                                        <span className="sr-only">{n.concept.name}</span>
                                    </span>
                                    {i < nodes.length - 1 && <span className={`mx-1 h-0.5 flex-1 rounded-full ${mastered ? 'bg-brand-600' : 'bg-border'}`} aria-hidden />}
                                </li>
                            )
                        })}
                    </ol>
                    <p className="mt-5 text-[15px] text-muted-foreground">
                        {current ? (
                            <>
                                <b className="text-brand-ink">
                                    {current.concept.name} · {Math.round(current.mastery * 100)}%.
                                </b>{' '}
                                {locked ? <>Đạt {Math.round(UNLOCK_THRESHOLD * 100)}% để mở “{locked.concept.name}”.</> : 'Làm thêm quiz để nắm vững khái niệm này.'}
                            </>
                        ) : nodes.length ? (
                            'Bạn đã nắm vững mọi khái niệm hiện có.'
                        ) : (
                            'Chưa có khái niệm nào.'
                        )}
                    </p>
                </div>

                <div className="rounded-[26px] border border-border bg-card p-6 shadow-card">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-foreground">Nhiệm vụ hôm nay</h3>
                        <span className="font-mono text-sm text-muted-foreground">
                            {missionsDone}/{MISSIONS.length}
                        </span>
                    </div>
                    <ul className="mt-4 flex flex-col gap-2.5">
                        {MISSIONS.map((m) => {
                            const done = m.progress(daily) >= m.target
                            return (
                                <li key={m.id} className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className={done ? 'text-muted-foreground line-through' : 'font-semibold text-foreground'}>{m.title}</span>
                                    <span className={`shrink-0 font-mono font-semibold ${done ? 'text-muted-foreground' : 'text-brand-ink'}`}>+{m.rewardXp}</span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </div>
        </section>
    )
}
