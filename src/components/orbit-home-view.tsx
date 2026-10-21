import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, Check, ChevronDown, Play, Sparkles } from 'lucide-react'
import { getConcept, getCourse, lessons } from '@/data'
import { dailyFor, DAILY_ARTICLE_XP, MISSIONS } from '@/lib/gamification'
import { CourseArt } from '@/components/courses/course-cover'
import { BUILDING_COURSE_IDS } from '@/lib/campus-courses'
import { STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'
import { scrollToSection } from '@/lib/scroll'
import { DAILY_LIMIT, gapScore, todaysDaily } from '@/lib/next-step'
import { stageHeightSvh, useScrollStage, useStageMode } from '@/hooks/useScrollStage'
import { useOrbitStore } from '@/store/useOrbitStore'
import { CampusStage } from '@/components/home/campus-stage'
import { KioskScreen, type KioskBridge } from '@/components/home/kiosk-screen'
import { SiteFooter } from '@/components/site-footer'

/**
 * Trang chủ kể chuyện theo cuộn, 4 chương: Hero → 01 Hôm nay → 02 Khóa học → 03 Studio, rồi footer.
 * Một Canvas 3D cố định phía sau dùng chung cho cả trang; nội dung ở cột trái (desktop). Mọi chương nền đỏ PTIT ở cả hai giao diện.
 * Mỗi chương 01–03 = chuyển cảnh (máy quay chạy, cột chữ ẩn) rồi dừng đọc (máy quay đứng yên, nội dung ghim giữa màn, hiện từng bước theo cuộn).
 * Màn hẹp: canvas 55svh phía trên. Giảm chuyển động: không bay, không ghim, mỗi chương một khung máy cố định.
 */
export function OrbitHomeView() {
    const { staticMode, reduce, journey } = useStageMode()
    const barRef = useRef<HTMLDivElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const [calm, setCalm] = useCalm()
    const calmRef = useRef(calm)
    calmRef.current = calm
    const { stage, scrolled } = useScrollStage({ journey, calm: calmRef, barRef, rootRef })
    const { coursePct } = useBuildingCourses()
    const dailyLit = useDailyLit()
    const screenRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const footerRef = useRef<HTMLDivElement>(null)
    const dockRef = useRef<HTMLDivElement>(null)
    const capRef = useRef<HTMLSpanElement>(null)
    const dipRef = useRef<HTMLDivElement>(null)
    const kiosk = useMemo<KioskBridge>(() => ({ screen: screenRef, root: rootRef, stage: stageRef, footer: footerRef, dock: dockRef, cap: capRef, dip: dipRef, calm: calmRef }), [])

    return (
        <div ref={rootRef} data-calm={calm} className="group/home relative w-full bg-stage text-ink-foreground">
            <CampusStage stage={stage} staticMode={staticMode} reduce={reduce} flat={!journey} dailyLit={dailyLit} kiosk={kiosk} coursePct={coursePct} />
            {/* Tối màn ngắn quanh điểm cắt cảnh (cảnh ghi độ mờ mỗi khung hình) */}
            <div ref={dipRef} aria-hidden className="pointer-events-none fixed inset-0 z-[1] bg-ink opacity-0" />
            <div aria-hidden className="stage-glow pointer-events-none fixed inset-0 z-[1]" />
            <div aria-hidden data-static={staticMode} className="stage-veil pointer-events-none fixed inset-0 z-[1]" style={{ opacity: 'calc(1 - var(--kiosk-focus, 0))' }} />
            {!staticMode && <KioskScreen screenRef={screenRef} />}
            <div ref={barRef} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[60] h-[3px] w-full origin-left scale-x-0 bg-brand-600" />

            {/* Chương không nhận chuột (để kéo xoay mô hình ở phần trống); chỉ khối nội dung nhận */}
            <div className="pointer-events-none relative z-10">
                <Chapter id="top" index={0} journey={journey} staticMode={staticMode} wide>
                    <HeroChapter />
                </Chapter>
                <Chapter id="daily" index={1} journey={journey} staticMode={staticMode}>
                    <DailyChapter journey={journey} />
                </Chapter>
                <Chapter id="courses" index={2} journey={journey} staticMode={staticMode} hideOnDesktop={!calm}>
                    <CoursesChapter journey={journey} />
                </Chapter>
                <Chapter id="studio" index={3} journey={journey} staticMode={staticMode}>
                    <StudioChapter journey={journey} />
                </Chapter>
            </div>

            {journey && !staticMode && <ChapterRail />}

            {!staticMode && (
                <p aria-hidden className={`pointer-events-none fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 text-xs text-ink-foreground/70 transition-opacity duration-slow ${scrolled ? 'opacity-0' : 'opacity-100'}`}>
                    <ChevronDown size={16} className="motion-safe:animate-bounce" /> Cuộn để xem khuôn viên đổi theo từng chương
                </p>
            )}

            {!staticMode && (
                <div ref={dockRef} className="fixed bottom-5 right-[max(1.5rem,4vw)] z-[6] flex items-center gap-3 font-mono text-[11px] text-ink-foreground/70">
                    <span ref={capRef} aria-hidden />
                    <button
                        type="button"
                        aria-pressed={calm}
                        onClick={() => setCalm(!calm)}
                        className="rounded-full border border-ink-foreground/20 bg-ink/80 px-3 py-1.5 text-xs font-bold text-ink-foreground transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70"
                    >
                        {calm ? 'Hiện cảnh 3D' : 'Làm mờ cảnh 3D'}
                    </button>
                </div>
            )}

            {/* Footer nằm trên mọi lớp 3D và màn kiosk; dải chuyển màu ở mép trên */}
            <div id="home-footer" ref={footerRef} className="relative z-[20] flow-root bg-card">
                <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-transparent to-card" />
                <SiteFooter />
            </div>
        </div>
    )
}

/** % tiến độ khóa của từng tòa (hiện trên nhãn). */
function useBuildingCourses() {
    const summaries = useCourseSummaries()
    return useMemo(() => {
        const withCourse = Object.entries(BUILDING_COURSE_IDS).flatMap(([name, id]) => {
            const sum = id ? summaries.find((x) => x.course.id === id) : undefined
            return sum ? [{ name, sum }] : []
        })
        return { coursePct: Object.fromEntries(withCourse.map((x) => [x.name, x.sum.pct])) as Readonly<Record<string, number>> }
    }, [summaries])
}

/** Mục chương ở mép phải: hiện chương hiện tại (hook đánh dấu data-on), bấm thì cuộn tới giữa phần dừng đọc. Ẩn khi đang zoom kiosk. */
const RAIL = [['top', 'Trang chủ'], ['daily', '01 Hôm nay'], ['courses', '02 Khóa học'], ['studio', '03 Studio 3D']] as const
function ChapterRail() {
    return (
        <nav aria-label="Chương" style={{ opacity: 'calc(1 - var(--kiosk-focus, 0))' }} className="fixed right-[max(1.25rem,2.4vw)] top-1/2 z-[6] hidden -translate-y-1/2 flex-col gap-3.5 min-[860px]:flex group-data-[kiosk=on]/home:pointer-events-none">
            {RAIL.map(([id, label], i) => (
                <button
                    key={id}
                    type="button"
                    data-rail-link
                    data-on={i === 0}
                    onClick={() => scrollToSection(id)}
                    className="group/r flex items-center justify-end gap-2.5 font-mono text-[11px] text-ink-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70 data-[on=true]:text-ink-foreground"
                >
                    <span className="translate-x-1.5 opacity-0 transition duration-base group-hover/r:translate-x-0 group-hover/r:opacity-100 group-data-[on=true]/r:translate-x-0 group-data-[on=true]/r:opacity-100">{label}</span>
                    <i className="h-0.5 w-6 rounded bg-ink-foreground/25 transition-all duration-base group-data-[on=true]/r:w-10 group-data-[on=true]/r:bg-brand-600" />
                </button>
            ))}
        </nav>
    )
}

const CALM_KEY = 'orbit-calm'
/** Chế độ làm mờ cảnh 3D, nhớ trong localStorage (bọc try/catch). */
function useCalm() {
    const [calm, set] = useState(() => {
        try {
            return localStorage.getItem(CALM_KEY) === '1'
        } catch {
            return false
        }
    })
    const setCalm = (v: boolean) => {
        set(v)
        try {
            localStorage.setItem(CALM_KEY, v ? '1' : '0')
        } catch {
            /* không lưu được thì thôi */
        }
    }
    return [calm, setCalm] as const
}

/** Bài Daily hôm nay (đúng thứ tự danh sách) đã đọc chưa → ref cho cảnh 3D, mỗi bài một tầng cửa sổ A2. Ghi ref, không render lại cảnh. */
function useDailyLit() {
    const read = useOrbitStore((s) => s.dailyRead)
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const ref = useRef<boolean[]>([])
    // Ghi trong render (đồng bộ) để cảnh vừa dựng đã có giá trị đúng; ref không gây render
    ref.current = todaysDaily(read, mastery).map((a) => Boolean(read[a.id]))
    return ref
}

// ─── Khung chương ──────────────────────────────────────────────────────────

/**
 * Chương 0 và chế độ giảm chuyển động: cao tối thiểu 100vh, cột chữ bên trái (desktop) hoặc nằm dưới canvas (màn hẹp).
 * Chương 01–03 trong hành trình: section cao (0,1 + TR + ST + 0,15) màn hình, nội dung ghim giữa màn (sticky);
 * hook useScrollStage điều khiển độ mờ của cột [data-col] và từng phần tử [data-s] theo cuộn.
 */
function Chapter({ id, index, journey, staticMode, wide, hideOnDesktop, children }: { id: string; index: number; journey: boolean; staticMode: boolean; wide?: boolean; hideOnDesktop?: boolean; children: ReactNode }) {
    const width = wide ? 'max-w-[600px]' : 'max-w-[520px]'
    const hidden = hideOnDesktop && !staticMode ? 'invisible' : ''
    if (journey && index > 0) {
        return (
            <section id={id} data-chapter={index} data-journey className="section-anchor" style={{ height: `${stageHeightSvh(index)}svh` }}>
                <div className={`container-page sticky top-0 flex h-[100svh] pb-16 ${staticMode ? 'items-start' : 'items-center pt-24'}`} style={staticMode ? { paddingTop: 'calc(55svh + 1.5rem)' } : undefined}>
                    <div data-col style={{ opacity: 0 }} className={`pointer-events-auto w-full ${width} ${hidden}`}>
                        {children}
                    </div>
                </div>
            </section>
        )
    }
    return (
        <section
            id={id}
            data-chapter={index}
            className={`section-anchor container-page flex min-h-[100svh] pb-16 ${staticMode ? 'scroll-mt-0 items-start' : 'items-center pt-24'}`}
            style={staticMode ? { paddingTop: 'calc(55svh + 1.5rem)' } : undefined}
        >
            <div className={`pointer-events-auto w-full ${width} ${hidden}`}>{children}</div>
        </section>
    )
}

/** Hiện dần khi vào khung nhìn (tắt khi prefers-reduced-motion nhờ CSS .reveal). Trong hành trình cuộn, từng phần tử [data-s] tự hiện theo cuộn nên hiện sẵn. */
function Reveal({ children, journey }: { children: ReactNode; journey?: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(false)
    useEffect(() => {
        const el = ref.current
        if (journey || !el || typeof IntersectionObserver === 'undefined') return setShown(true)
        const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShown(true), io.disconnect()), { threshold: 0.25 })
        io.observe(el)
        return () => io.disconnect()
    }, [journey])
    return (
        <div ref={ref} className={`reveal ${shown || journey ? 'in' : ''}`}>
            {children}
        </div>
    )
}

const Eyebrow = ({ children }: { children: ReactNode }) => <p data-s className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-brand-light">{children}</p>
/** Tiêu đề tách chữ: mỗi từ trồi lên lần lượt khi chương vào khung nhìn (CSS .split-w, kích hoạt bởi .reveal.in). Dòng mới = "\n". */
const Title = ({ id, children }: { id?: string; children: string }) => {
    let i = 0
    return (
        <h2 data-s id={id} aria-label={children.replace('\n', ' ')} className="mt-3 text-[clamp(1.9rem,3.4vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
            {children.split('\n').map((line, li) => (
                <span key={li} aria-hidden className="block">
                    {line.split(' ').map((w) => (
                        <span key={i}>
                            <span className="split-w">
                                <span style={{ ['--i' as string]: i++ }}>{w}</span>
                            </span>{' '}
                        </span>
                    ))}
                </span>
            ))}
        </h2>
    )
}
const Lead = ({ children }: { children: ReactNode }) => <p data-s className="mb-6 mt-4 text-[17px] leading-relaxed text-ink-foreground/80">{children}</p>
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

function DailyChapter({ journey }: { journey: boolean }) {
    const read = useOrbitStore((s) => s.dailyRead)
    const mastery = useOrbitStore((s) => s.conceptMastery)

    // 3 bài mỗi ngày (bài đã đọc từ ngày trước không quay lại)
    const articles = todaysDaily(read, mastery)
    const readCount = articles.filter((a) => read[a.id]).length
    const priority = [...articles.filter((a) => !read[a.id])].sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery))[0]
    const allDone = articles.length > 0 && !priority

    return (
        <Reveal journey={journey}>
            <Eyebrow>01 · Hôm nay</Eyebrow>
            <Title id="daily-title">{'Ba ô cửa sáng đèn.\nĐọc xong là nghỉ.'}</Title>
            <Lead>Mỗi bài Orbit Daily đọc xong thắp sáng một tầng cửa sổ tòa A2. AI chọn bài theo phần bạn còn hổng.</Lead>
            <ul data-s className={`${darkCard} flex flex-col gap-1 p-3`} aria-label={`Đã đọc ${readCount} trên ${DAILY_LIMIT} bài hôm nay`}>
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
            {allDone && <p data-s className="mt-3 text-sm font-semibold text-ink-foreground/80">Hôm nay đủ rồi. Hẹn bạn ngày mai.</p>}
            <div data-s>
                <MiniMissions />
            </div>
        </Reveal>
    )
}

/** Nhiệm vụ hôm nay, bản gọn cho nền tối (chỉ đọc; nhận thưởng ở trang Hành trình). */
function MiniMissions() {
    const dailyRaw = useOrbitStore((s) => s.daily)
    useOrbitStore((s) => s.lessonProgress)
    useOrbitStore((s) => s.dailyRead)
    const daily = dailyFor(dailyRaw)
    const doneCount = MISSIONS.filter((m) => m.progress(daily) >= m.target).length
    return (
        <div className="mt-4 rounded-[20px] border border-ink-foreground/10 bg-ink/60 px-4 py-3">
            <p className="flex items-center justify-between text-xs font-extrabold uppercase tracking-[0.12em] text-ink-foreground/70">
                Nhiệm vụ hôm nay
                <span className="font-mono">{doneCount}/{MISSIONS.length}</span>
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
                {MISSIONS.map((m) => {
                    const done = m.progress(daily) >= m.target
                    return (
                        <li key={m.id} className={`flex items-center gap-2 text-sm ${done ? 'text-ink-foreground/70' : 'text-ink-foreground'}`}>
                            <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${done ? 'bg-brand-600' : 'border border-ink-foreground/40'}`}>{done && <Check size={11} />}</span>
                            <span className={done ? 'line-through decoration-ink-foreground/40' : ''}>{m.title}</span>
                        </li>
                    )
                })}
            </ul>
            <Link to="/journey" className="mt-2.5 inline-flex items-center gap-1 text-xs font-extrabold text-brand-light hover:underline">Xem hành trình <ArrowRight size={12} /></Link>
        </div>
    )
}

// ─── Chương 2: Khóa học ────────────────────────────────────────────────────

function CoursesChapter({ journey }: { journey: boolean }) {
    const summaries = useCourseSummaries()
    const list = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    // Desktop: nội dung này hiện trên màn kiosk 3D (KioskScreen); cột chữ chỉ hiện ở màn hẹp và chế độ làm mờ cảnh
    return (
        <Reveal journey={journey}>
            <Eyebrow>02 · Khóa học</Eyebrow>
            <Title id="courses-title">{'Khóa học của bạn'}</Title>
            <Lead>Học theo chặng, đích là test cuối chương.</Lead>
            <div data-s className="flex flex-col gap-3">
                {list.length === 0 && <p className={`${darkCard} p-5 text-ink-foreground/80`}>Chưa có khóa học nào được giảng viên xuất bản.</p>}
                {list.map((c) => (
                    <CourseRow key={c.course.id} summary={c} />
                ))}
                <Link to="/learning" className="inline-flex items-center gap-2 self-start rounded-xl border border-ink-foreground/20 px-4 py-2.5 text-sm font-extrabold transition hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
                    Xem tất cả khóa học <ArrowRight size={15} />
                </Link>
            </div>
        </Reveal>
    )
}

function CourseRow({ summary }: { summary: CourseSummary }) {
    const { course, lessons: ls, status, pct, curIndex } = summary
    const lesson = ls[curIndex] ?? ls[0]
    const sub = status === 'doing' ? `Chặng ${curIndex + 1}/${ls.length}` : status === 'done' ? 'Đã xong' : `${ls.length} bài`
    const action = status === 'done' ? 'Xem lại' : pct > 0 ? 'Học tiếp' : 'Bắt đầu'
    return (
        <div className={`${darkCard} group relative grid grid-cols-[84px_1fr] gap-3.5 p-3 transition duration-base ease-out focus-within:ring-2 focus-within:ring-ink-foreground/70 hover:-translate-y-0.5 hover:border-ink-foreground/30`}>
            <Link to={`/learning?course=${course.id}`} aria-label={`Xem khóa ${course.title}`} className="absolute inset-0 rounded-[20px] focus-visible:outline-none" />
            <div className={`pointer-events-none relative h-[84px] w-[84px] overflow-hidden rounded-2xl ${status === 'new' ? 'saturate-[.5]' : ''}`}>
                <CourseArt course={course} className="h-full w-full" />
            </div>
            <div className="pointer-events-none flex min-w-0 flex-col justify-between gap-1.5">
                <small className="truncate font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-light">
                    {course.subject} · {sub}
                </small>
                <span className="flex items-baseline justify-between gap-3">
                    <b className="line-clamp-2 text-[15px] leading-snug">{course.title}</b>
                    <span className="font-mono text-lg font-bold">{pct}%</span>
                </span>
                <span className="flex items-center gap-3">
                    <span className="h-1 flex-1 overflow-hidden rounded bg-ink-foreground/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${course.title}`}>
                        <span className="block h-full rounded bg-brand-600" style={{ width: `${pct}%` }} />
                    </span>
                    {lesson && (
                        <Link to={`/lesson/${lesson.id}`} data-vt={`lesson-${lesson.id}`} className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
                            <Play size={11} className="fill-current" /> {action}
                        </Link>
                    )}
                </span>
            </div>
        </div>
    )
}

// ─── Chương 3: Studio 3D ───────────────────────────────────────────────────

function StudioChapter({ journey }: { journey: boolean }) {
    return (
        <Reveal journey={journey}>
            <Eyebrow>03 · Studio 3D</Eyebrow>
            <Title id="studio-title">{'Rồi cả khuôn viên\nthành phòng chụp.'}</Title>
            <Lead>Khối vàng của A3 thành chủ thể, dải kính xanh thành đạo cụ. Bạn đặt máy, AI đặt đèn rồi chấm ảnh.</Lead>
            <div data-s className="flex flex-col gap-4">
                <Feature icon={<Sparkles size={16} />} title="Prompt-to-Environment">
                    Mô tả ánh sáng bằng lời, AI dựng đèn, màu nền, sương và giải thích theo lý thuyết nhiếp ảnh.
                </Feature>
                <Feature icon={<Camera size={16} />} title="Virtual Director">
                    Chụp rồi để AI chấm bố cục, ánh sáng và khoanh đúng vùng cần chỉnh.
                </Feature>
            </div>
            <p data-s className="mt-5 flex items-center gap-2.5 rounded-[14px] border border-ink-foreground/10 bg-ink/60 px-3 py-2.5 text-[13px]">
                <span aria-hidden className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-brand-600">
                    <Sparkles size={14} />
                </span>
                “Studio tối, đèn chính vàng ấm từ trái, viền sáng phía sau”
            </p>
            <Link to="/studio" data-s data-vt="studio-stage" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
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
