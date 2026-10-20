import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, Check, ChevronDown, Play, Sparkles } from 'lucide-react'
import { getConcept, getCourse, lessons } from '@/data'
import { DAILY_ARTICLE_XP } from '@/lib/gamification'
import { BUILDING_COURSE_IDS } from '@/lib/campus-courses'
import { STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'
import { DAILY_LIMIT, gapScore, todaysDaily } from '@/lib/next-step'
import { useScrollStage, useStageMode } from '@/hooks/useScrollStage'
import { useOrbitStore } from '@/store/useOrbitStore'
import { CampusStage } from '@/components/home/campus-stage'
import { SiteFooter } from '@/components/site-footer'

/**
 * Trang chủ kể chuyện theo cuộn, 4 chương: Hero → 01 Hôm nay → 02 Khóa học → 03 Studio, rồi footer.
 * Một Canvas 3D cố định phía sau dùng chung cho cả trang; nội dung ở cột trái (desktop). Mọi chương nền đỏ PTIT ở cả hai giao diện.
 * Màn hẹp hoặc giảm chuyển động: không chuyển cảnh, canvas cao 55vh phía trên và mỗi chương dùng một khung máy cố định.
 */
export function OrbitHomeView() {
    const { staticMode, reduce } = useStageMode()
    const barRef = useRef<HTMLDivElement>(null)
    const { stage, scrolled } = useScrollStage({ staticMode, barRef })
    const liftNames = useLiftedBuildings()

    return (
        <div className="relative w-full bg-stage text-ink-foreground">
            <CampusStage stage={stage} staticMode={staticMode} reduce={reduce} liftNames={liftNames} />
            <div aria-hidden className="stage-glow pointer-events-none fixed inset-0 z-[1]" />
            <div aria-hidden data-static={staticMode} className="stage-veil pointer-events-none fixed inset-0 z-[1]" />
            <div ref={barRef} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[60] h-[3px] w-full origin-left scale-x-0 bg-brand-600" />

            {/* Chương không nhận chuột (để kéo xoay mô hình ở phần trống); chỉ khối nội dung nhận */}
            <div className="pointer-events-none relative z-10">
                <Chapter id="top" index={0} staticMode={staticMode} wide>
                    <HeroChapter />
                </Chapter>
                <Chapter id="daily" index={1} staticMode={staticMode}>
                    <DailyChapter />
                </Chapter>
                <Chapter id="courses" index={2} staticMode={staticMode}>
                    <CoursesChapter />
                </Chapter>
                <Chapter id="studio" index={3} staticMode={staticMode}>
                    <StudioChapter />
                </Chapter>
            </div>

            {!staticMode && (
                <p aria-hidden className={`pointer-events-none fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 text-xs text-ink-foreground/70 transition-opacity duration-slow ${scrolled ? 'opacity-0' : 'opacity-100'}`}>
                    <ChevronDown size={16} className="motion-safe:animate-bounce" /> Cuộn để xem khuôn viên đổi theo từng chương
                </p>
            )}

            <div className="relative z-10">
                <SiteFooter />
            </div>
        </div>
    )
}

/** Tòa nhấc lên ở chương Khóa học: tòa có khóa đang học; chưa học khóa nào thì mọi tòa có khóa. */
function useLiftedBuildings() {
    const summaries = useCourseSummaries()
    return useMemo(() => {
        const withCourse = Object.entries(BUILDING_COURSE_IDS).filter(([, id]) => id && summaries.some((s) => s.course.id === id))
        const doing = withCourse.filter(([, id]) => summaries.find((s) => s.course.id === id)?.status === 'doing')
        return new Set((doing.length ? doing : withCourse).map(([name]) => name))
    }, [summaries])
}

// ─── Khung chương ──────────────────────────────────────────────────────────

/** Mỗi chương cao tối thiểu 100vh; cột chữ bên trái (desktop) hoặc nằm dưới canvas (màn hẹp). */
function Chapter({ id, index, staticMode, wide, children }: { id: string; index: number; staticMode: boolean; wide?: boolean; children: ReactNode }) {
    return (
        <section
            id={id}
            data-chapter={index}
            className={`section-anchor container-page flex min-h-[100svh] pb-16 ${staticMode ? 'scroll-mt-0 items-start' : 'items-center pt-24'}`}
            style={staticMode ? { paddingTop: 'calc(55svh + 1.5rem)' } : undefined}
        >
            <div className={`pointer-events-auto w-full ${wide ? 'max-w-[600px]' : 'max-w-[520px]'}`}>{children}</div>
        </section>
    )
}

/** Hiện dần khi vào khung nhìn (tắt khi prefers-reduced-motion nhờ CSS .reveal). */
function Reveal({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(false)
    useEffect(() => {
        const el = ref.current
        if (!el || typeof IntersectionObserver === 'undefined') return setShown(true)
        const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShown(true), io.disconnect()), { threshold: 0.25 })
        io.observe(el)
        return () => io.disconnect()
    }, [])
    return (
        <div ref={ref} className={`reveal ${shown ? 'in' : ''}`}>
            {children}
        </div>
    )
}

const Eyebrow = ({ children }: { children: ReactNode }) => <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-brand-light">{children}</p>
const Title = ({ id, children }: { id?: string; children: ReactNode }) => (
    <h2 id={id} className="mt-3 text-[clamp(1.9rem,3.4vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {children}
    </h2>
)
const Lead = ({ children }: { children: ReactNode }) => <p className="mb-6 mt-4 text-[17px] leading-relaxed text-ink-foreground/80">{children}</p>
/** Thẻ tối nửa trong suốt, chữ sáng cố định ở cả hai giao diện */
const darkCard = 'rounded-[20px] border border-ink-foreground/10 bg-ink/85 backdrop-blur-md'

// ─── Chương 0: hero ────────────────────────────────────────────────────────

function HeroChapter() {
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
        <div className="flex min-w-0 flex-col gap-6">
            <h1 className="animate-rise-1 text-[clamp(2.75rem,4.6vw,4.75rem)] font-black leading-[0.96] tracking-[-0.045em] [text-wrap:balance]">
                Chào {name}.
                <br />
                Hôm nay chỉ cần
                <br />
                <span className="text-brand-light">25 phút.</span>
            </h1>
            <p className="max-w-xl animate-rise-2 text-lg leading-relaxed text-ink-foreground/80">Học tiếp bài đang dở, rồi đọc 3 bài ngắn AI chọn riêng cho phần bạn còn hổng.</p>

            {resume ? (
                <Link
                    to={`/lesson/${resume.id}`}
                    data-vt={`lesson-${resume.id}`}
                    className="group relative mt-1 flex animate-rise-3 items-center gap-4 overflow-hidden rounded-[22px] bg-card p-3 pr-4 text-foreground shadow-raised transition duration-base ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70"
                >
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[40%] animate-sheen bg-gradient-to-r from-transparent via-brand-500/20 to-transparent" />
                    <GridThumb />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-eyebrow uppercase text-brand-ink">
                            {resumeAt > 0 ? 'Học tiếp' : 'Bắt đầu'} · {getCourse(resume.courseId)?.title ?? 'Khóa học'}
                        </span>
                        <span className="mt-1.5 line-clamp-2 text-lg font-bold leading-snug">{resume.title}</span>
                        <span className="mt-3 flex items-center gap-3">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ bài đang học">
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
            <span className="hidden text-sm text-ink-foreground/70 lg:block">Kéo vào khoảng trống bên phải để xoay mô hình, di vào một tòa nhà để làm nổi nó lên.</span>
        </div>
    )
}

/** Ảnh thu nhỏ có lưới 1/3 (2 đường dọc, 2 đường ngang mờ) và chấm chủ thể ở một giao điểm, như mockup. */
function GridThumb() {
    return (
        <span className="relative block h-[92px] w-[92px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-300" aria-hidden>
            <span
                className="absolute inset-0 bg-[length:33.333%_33.333%] opacity-100"
                style={{
                    backgroundImage: 'linear-gradient(hsl(var(--ink-foreground) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--ink-foreground) / 0.3) 1px, transparent 1px)',
                }}
            />
            <span className="absolute left-[66.66%] top-[33.33%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-foreground shadow-card" />
        </span>
    )
}

// ─── Chương 1: Hôm nay (Orbit Daily) ───────────────────────────────────────

function DailyChapter() {
    const read = useOrbitStore((s) => s.dailyRead)
    const mastery = useOrbitStore((s) => s.conceptMastery)

    // 3 bài mỗi ngày (bài đã đọc từ ngày trước không quay lại)
    const articles = todaysDaily(read, mastery)
    const readCount = articles.filter((a) => read[a.id]).length
    const priority = [...articles.filter((a) => !read[a.id])].sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery))[0]
    const allDone = articles.length > 0 && !priority

    return (
        <Reveal>
            <Eyebrow>01 · Hôm nay</Eyebrow>
            <Title id="daily-title">{allDone ? 'Hôm nay đủ rồi. Hẹn bạn ngày mai.' : '3 bài đọc. Rồi nghỉ.'}</Title>
            <Lead>Mỗi ngày AI chọn tối đa {DAILY_LIMIT} bài đọc ngắn theo phần bạn còn hổng. Đọc xong là nghỉ, không có gì để cuộn tiếp.</Lead>
            <ul className={`${darkCard} flex flex-col gap-1 p-3`} aria-label={`Đã đọc ${readCount} trên ${DAILY_LIMIT} bài hôm nay`}>
                {articles.map((a, i) => {
                    const done = Boolean(read[a.id])
                    const weakest = [...a.conceptIds].sort((x, y) => (mastery[x] ?? 0.5) - (mastery[y] ?? 0.5))[0]
                    const concept = getConcept(weakest)
                    const m = mastery[weakest]
                    const note = done
                        ? `Đã đọc · +${DAILY_ARTICLE_XP} XP`
                        : a.id === priority?.id && concept
                          ? m === undefined
                              ? `Ưu tiên · bạn chưa làm quiz “${concept.name}”`
                              : `Ưu tiên · “${concept.name}” mới nắm ${Math.round(m * 100)}%`
                          : `${a.readingMinutes} phút · +${DAILY_ARTICLE_XP} XP`
                    return (
                        <li key={a.id}>
                            <Link
                                to={`/daily/${a.id}`}
                                data-vt={`daily-${a.id}`}
                                className={`group grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl p-2.5 transition duration-fast hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70 ${done ? 'opacity-70' : ''}`}
                            >
                                <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] font-mono text-xs ${done ? 'bg-brand-600 text-ink-foreground' : 'bg-ink-foreground/10'}`}>{done ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span>
                                <span className="min-w-0">
                                    <b className="block text-[15px] leading-snug">{a.title}</b>
                                    <small className="mt-0.5 block text-xs text-ink-foreground/70">{note}</small>
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-light">{done ? 'Đọc lại' : 'Đọc'} <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </Reveal>
    )
}

// ─── Chương 2: Khóa học ────────────────────────────────────────────────────

const MAX_COURSES = 3

function CoursesChapter() {
    const summaries = useCourseSummaries()
    const cards = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]).slice(0, MAX_COURSES)

    return (
        <Reveal>
            <Eyebrow>02 · Khóa học</Eyebrow>
            <Title id="courses-title">
                Mỗi tòa nhà
                <br />
                là một khóa học.
            </Title>
            <Lead>Tòa nào bạn đang học sẽ nhấc lên. Bấm vào tòa trên mô hình hoặc một khóa bên dưới để vào bản đồ chặng.</Lead>
            {cards.length === 0 ? (
                <p className={`${darkCard} p-5 text-ink-foreground/80`}>Chưa có khóa học nào được giảng viên xuất bản.</p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {cards.map((c) => (
                        <li key={c.course.id}>
                            <CourseRow summary={c} />
                        </li>
                    ))}
                </ul>
            )}
            {summaries.length > 0 && (
                <Link to="/learning" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-ink-foreground/20 px-4 py-2.5 text-sm font-extrabold transition hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
                    Xem tất cả khóa học <ArrowRight size={15} />
                </Link>
            )}
        </Reveal>
    )
}

function CourseRow({ summary }: { summary: CourseSummary }) {
    const { course, lessons: ls, status, pct, curIndex } = summary
    const sub = status === 'doing' ? `Chặng ${curIndex + 1}/${ls.length}` : status === 'done' ? 'Đã xong' : `${ls.length} bài`
    return (
        <Link
            to={`/learning?course=${course.id}`}
            className={`${darkCard} grid gap-2 p-4 transition duration-base ease-out hover:-translate-y-0.5 hover:border-ink-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70`}
        >
            <small className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-light">
                {course.subject} · {sub}
            </small>
            <span className="flex items-baseline justify-between gap-3">
                <b className="text-base leading-snug">{course.title}</b>
                <span className="font-mono text-xl font-bold">{pct}%</span>
            </span>
            <span className="h-1 overflow-hidden rounded bg-ink-foreground/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${course.title}`}>
                <span className="block h-full rounded bg-brand-600" style={{ width: `${pct}%` }} />
            </span>
        </Link>
    )
}

// ─── Chương 3: Studio 3D ───────────────────────────────────────────────────

function StudioChapter() {
    return (
        <Reveal>
            <Eyebrow>03 · Studio 3D</Eyebrow>
            <Title id="studio-title">Tả ánh sáng. Rồi chụp.</Title>
            <Lead>Đặt máy, chỉnh tiêu cự và ba đèn trong studio ảo. Bạn đặt máy, AI đặt đèn rồi chấm ảnh.</Lead>
            <div className="flex flex-col gap-4">
                <Feature icon={<Sparkles size={16} />} title="Prompt-to-Environment">
                    Mô tả ánh sáng bằng lời, AI dựng đèn, màu nền, sương và giải thích theo lý thuyết nhiếp ảnh.
                </Feature>
                <Feature icon={<Camera size={16} />} title="Virtual Director">
                    Chụp rồi để AI chấm bố cục, ánh sáng và khoanh đúng vùng cần chỉnh.
                </Feature>
            </div>
            <p className="mt-5 flex items-center gap-2.5 rounded-[14px] border border-ink-foreground/10 bg-ink/60 px-3 py-2.5 text-[13px]">
                <span aria-hidden className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-brand-600">
                    <Sparkles size={14} />
                </span>
                “Studio tối, đèn chính vàng ấm từ trái, viền sáng phía sau”
            </p>
            <Link to="/studio" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
                Vào Studio <ArrowRight size={16} />
            </Link>
        </Reveal>
    )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[30px_1fr] gap-3 text-sm text-ink-foreground/80">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-ink-foreground/10 text-brand-light">{icon}</span>
            <span>
                <b className="text-ink-foreground">{title}:</b> {children}
            </span>
        </div>
    )
}
