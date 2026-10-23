import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, ChevronDown, Play, Sparkles } from 'lucide-react'
import { getCourse, lessons } from '@/data'
import { CourseArt } from '@/components/courses/course-cover'
import { BUILDING_COURSE_IDS } from '@/lib/campus-courses'
import { STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'
import { scrollToSection } from '@/lib/scroll'
import { trackPage } from '@/lib/page-metrics'
import { FLAGS, mountPerfHud } from '@/lib/perf'
import { overlay } from '@/lib/stage-signal'
import { dailyArticles } from '@/data'
import { A2_TIERS, FINALE_STEP_MS, type DailyLit } from '@/lib/daily-lit'
import { announceRewards, LIGHTS_XP, localDate } from '@/lib/gamification'
import { CHAPTERS, PIN_SWAP, useScrollStage, useStageMode } from '@/hooks/useScrollStage'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { TodayCount, TodayHeroCard, TodayMiniCards, TodayMissionLine } from '@/components/daily/today-board'
import { useOrbitStore } from '@/store/useOrbitStore'
import { CampusStage } from '@/components/home/campus-stage'
import { KioskScreen, type KioskBridge } from '@/components/home/kiosk-screen'
import { BenchRunner } from '@/components/home/bench-runner'
import { SiteFooter } from '@/components/site-footer'

/**
 * Trang chủ kể chuyện theo cuộn, 4 chương: Hero → 01 Hôm nay → 02 Khóa học → 03 Studio, rồi footer.
 * Một Canvas 3D cố định phía sau dùng chung cho cả trang; nội dung ở cột trái (desktop). Giao diện sáng = trời kem ấm ban ngày, tối = buổi tối đèn cửa sổ.
 * Hành trình: MỘT section cao có khung sticky, bốn panel chồng nhau; vị trí cuộn chỉ chọn chương, máy quay bay và chữ hiện theo thời gian (useScrollStage).
 * Màn hẹp: canvas 44svh phía trên. Giảm chuyển động: không ghim, mỗi chương một khung máy cố định.
 */
export function OrbitHomeView() {
    const { staticMode, reduce, journey } = useStageMode()
    const barRef = useRef<HTMLDivElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const [calm, setCalm] = useCalm()
    const calmRef = useRef(calm)
    calmRef.current = calm
    // Paged: trang chủ cao đúng 100svh, không cuộn tài liệu (Safari vẽ lại cả màn hình mỗi khi tài liệu cuộn đè lên stage fixed); footer là chương 4
    const paged = journey && !calm && !FLAGS.docScroll
    const { stage } = useScrollStage({ journey, paged, barRef, rootRef, calmRef })
    const { coursePct } = useBuildingCourses()
    const dailyLit = useDailyLit(stage, reduce)
    const screenRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const footerRef = useRef<HTMLDivElement>(null)
    const dockRef = useRef<HTMLDivElement>(null)
    const capRef = useRef<HTMLSpanElement>(null)
    const veilRef = useRef<HTMLDivElement>(null)
    const railRef = useRef<HTMLElement>(null)
    const kiosk = useMemo<KioskBridge>(() => ({ screen: screenRef, root: rootRef, stage: stageRef, footer: footerRef, dock: dockRef, cap: capRef, veil: veilRef, rail: railRef, calm: calmRef }), [])

    // Số đo layout (footer, hành trình, scrollHeight) đo một lần + khi resize; layout effect chạy trước effect của useScrollStage
    useLayoutEffect(() => trackPage(() => footerRef.current).stop, [])
    useEffect(() => mountPerfHud(), [])

    return (
        <div ref={rootRef} data-calm={calm} className="group/home relative w-full bg-stage text-foreground">
            <CampusStage stage={stage} staticMode={staticMode} reduce={reduce} flat={!journey} dailyLit={dailyLit} kiosk={kiosk} coursePct={coursePct} />
            {/* MỘT lớp màu nền (chỉ đổi opacity, xem stage-signal): nền tối nhẹ khi có chữ, che quanh điểm cắt cảnh, che khi nhảy chương */}
            <div ref={(el) => void (overlay.el = el)} data-overlay aria-hidden className="own-layer pointer-events-none fixed inset-0 z-[4] bg-stage opacity-0" />
            <div ref={veilRef} aria-hidden data-static={staticMode} className="stage-veil own-layer pointer-events-none fixed inset-0 z-[1]" />
            {!staticMode && !FLAGS.noKiosk && <KioskScreen screenRef={screenRef} />}
            <BenchRunner />
            <div ref={barRef} aria-hidden data-bar className="own-layer pointer-events-none fixed left-0 top-0 z-[60] h-[3px] w-full origin-left scale-x-0 bg-brand-600" />

            {/* Chương không nhận chuột (để kéo xoay mô hình ở phần trống); chỉ khối nội dung nhận */}
            {journey ? (
                <section id="journey" className="pointer-events-none relative z-10" style={{ height: paged ? '100svh' : `${(CHAPTERS + 1) * 100}svh` }}>
                    <div className={`container-page ${paged ? 'relative' : PIN_SWAP ? 'absolute inset-x-0 top-0' : 'sticky top-0'} flex h-[100svh] ${staticMode ? 'items-start pb-6' : 'items-center pb-16 pt-24'}`} style={staticMode ? { paddingTop: 'calc(44svh + 1rem)' } : undefined}>
                        <div className="grid w-full max-w-[600px] items-center">
                            <Panel id="top" index={0} wide>
                                <HeroChapter />
                            </Panel>
                            <Panel id="daily" index={1}>
                                <DailyChapter />
                            </Panel>
                            <Panel id="courses" index={2} hideOnDesktop={!calm && !staticMode}>
                                <CoursesChapter />
                            </Panel>
                            <Panel id="studio" index={3}>
                                <StudioChapter />
                            </Panel>
                        </div>
                    </div>
                </section>
            ) : (
                <div className="pointer-events-none relative z-10">
                    <Chapter id="top" index={0} staticMode={staticMode} wide>
                        <HeroChapter />
                    </Chapter>
                    <Chapter id="daily" index={1} staticMode={staticMode}>
                        <Reveal>
                            <DailyChapter />
                        </Reveal>
                    </Chapter>
                    <Chapter id="courses" index={2} staticMode={staticMode}>
                        <Reveal>
                            <CoursesChapter />
                        </Reveal>
                    </Chapter>
                    <Chapter id="studio" index={3} staticMode={staticMode}>
                        <Reveal>
                            <StudioChapter />
                        </Reveal>
                    </Chapter>
                </div>
            )}

            {journey && !staticMode && <ChapterRail navRef={railRef} />}

            {/* Dòng hướng dẫn cho người mới: hook ghi chữ và độ hiện; ẩn ở footer */}
            {journey && (
                <p data-guide aria-live="polite" style={{ opacity: 0 }} className="own-layer pointer-events-none fixed bottom-5 left-[max(1.5rem,4vw)] z-[6] flex max-w-[calc(100vw-3rem)] items-center gap-2 text-xs text-muted-foreground transition-opacity duration-slow">
                    <ChevronDown size={16} style={{ animationIterationCount: 3 }} className="shrink-0 text-brand-ink motion-safe:animate-bounce" aria-hidden />
                    <span data-guide-text>Cuộn để đi vào trường</span>
                </p>
            )}

            {!staticMode && (
                <div ref={dockRef} data-dock className="own-layer fixed bottom-5 right-[max(1.5rem,4vw)] z-[6] flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                    <span ref={capRef} aria-hidden />
                    <button
                        type="button"
                        aria-pressed={calm}
                        onClick={() => setCalm(!calm)}
                        className="rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    >
                        {calm ? 'Hiện cảnh 3D' : 'Làm mờ cảnh 3D'}
                    </button>
                </div>
            )}

            {/* Footer nằm trên mọi lớp 3D và màn kiosk; nền đặc, không có dải chuyển màu tràn lên cảnh */}
            {/* Paged: tấm phủ fixed sát đáy, trượt lên bằng transform (hook ghi), cao theo nội dung tối đa 100svh, dài hơn thì cuộn bên trong chính nó */}
            <div
                id="home-footer"
                ref={footerRef}
                className={paged ? 'own-layer fixed inset-x-0 bottom-0 z-[20] max-h-[100svh] flow-root overflow-y-auto overscroll-contain bg-card' : 'relative z-[20] flow-root bg-card'}
                style={paged ? { transform: 'translate3d(0,100%,0)' } : undefined}
            >
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
function ChapterRail({ navRef }: { navRef: RefObject<HTMLElement | null> }) {
    return (
        <nav ref={navRef} data-rail aria-label="Chương" className="own-layer fixed right-[max(1.25rem,2.4vw)] top-1/2 z-[6] hidden -translate-y-1/2 flex-col gap-3.5 min-[860px]:flex group-data-[kiosk=on]/home:pointer-events-none">
            {RAIL.map(([id, label], i) => (
                <button
                    key={id}
                    type="button"
                    data-rail-link
                    data-on={i === 0}
                    onClick={() => scrollToSection(id)}
                    className="group/r flex items-center justify-end gap-2.5 font-mono text-[11px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 data-[on=true]:text-foreground"
                >
                    <span className="translate-x-1.5 opacity-0 transition duration-base group-hover/r:translate-x-0 group-hover/r:opacity-100 group-data-[on=true]/r:translate-x-0 group-data-[on=true]/r:opacity-100">{label}</span>
                    <i className="h-0.5 w-6 rounded bg-foreground/25 transition-all duration-base group-data-[on=true]/r:w-10 group-data-[on=true]/r:bg-brand-600" />
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

/**
 * Trạng thái đèn tầng tòa A2 cho cảnh 3D: số bài Daily đã đọc hôm nay = số tầng sáng từ dưới lên. Ghi ref, không render lại cảnh.
 * Cũng lo nhiệm vụ ẩn: đọc hết mọi bài Daily trong ngày (lần đầu) thì khi chương Hôm nay hiện ra, các tầng còn lại sáng nối tiếp,
 * đồng hồ phát sáng, ~1s sau hiện màn thưởng +100 XP kèm huy hiệu. Không báo trước ở đâu.
 */
function useDailyLit(stage: RefObject<number>, reduce: boolean) {
    const read = useOrbitStore((s) => s.dailyRead)
    const lightsDay = useOrbitStore((s) => s.lightsDay)
    const ref = useRef<DailyLit>({ read: 0, finale: false, finaleAt: 0 })
    const playing = useRef(false)
    const today = localDate()
    const readToday = dailyArticles.filter((a) => read[a.id] === today).length
    const claimed = lightsDay === today
    const pending = !claimed && readToday > 0 && dailyArticles.every((a) => read[a.id])
    // Ghi trong render (đồng bộ) để cảnh vừa dựng đã có giá trị đúng; ref không gây render
    ref.current.read = readToday
    if (!playing.current) {
        ref.current.finale = claimed
        ref.current.finaleAt = 0
    }

    useEffect(() => {
        if (!pending) return
        const lit = ref.current
        let timer = 0
        const poll = window.setInterval(() => {
            // Chỉ phát khi chương Hôm nay đang nằm trong khung nhìn
            const s = stage.current ?? 0
            if (playing.current || s < 0.95 || s > 1.4) return
            window.clearInterval(poll)
            playing.current = true
            lit.finale = true
            lit.finaleAt = reduce ? 0 : performance.now()
            const rows = Math.max(0, A2_TIERS - readToday)
            const wait = (reduce ? 0 : rows * FINALE_STEP_MS + 700) + 1000
            timer = window.setTimeout(() => {
                const before = useOrbitStore.getState()
                if (before.claimLights() === 0) {
                    playing.current = false
                    return
                }
                const after = useOrbitStore.getState()
                announceRewards(
                    before,
                    after,
                    { context: 'NHIỆM VỤ ẨN', headline: 'Tòa A2 sáng đèn', rows: [{ label: 'Thắp sáng mọi tầng của tòa A2', xp: LIGHTS_XP }] },
                    { source: 'mission', next: { label: 'Tuyệt', to: '/' } },
                )
                playing.current = false
            }, wait)
        }, 250)
        return () => {
            window.clearInterval(poll)
            window.clearTimeout(timer)
            // Rời trang giữa chừng: lần sau vào lại sẽ phát lại từ đầu
            if (playing.current) {
                playing.current = false
                lit.finale = false
                lit.finaleAt = 0
            }
        }
    }, [pending, readToday, reduce, stage])
    return ref
}

// ─── Khung chương ──────────────────────────────────────────────────────────

/**
 * Panel của hành trình: các panel xếp chồng trong một ô lưới; useScrollStage đặt class on / past, CSS (index.css) lo phần hiện ẩn
 * và hiện từng phần tử [data-s] theo nhịp cố định. Panel không `on` thì visibility: hidden (không nhận chuột).
 * Màn hẹp: khung chỉ cao ~56svh nên phần tử [data-compact] (câu dẫn, nhiệm vụ, chú thích) được ẩn để panel vừa khung.
 */
function Panel({ id, index, wide, hideOnDesktop, children }: { id: string; index: number; wide?: boolean; hideOnDesktop?: boolean; children: ReactNode }) {
    return (
        <div id={id} data-panel={index} data-journey className={`col-start-1 row-start-1 w-full max-[859px]:[&_[data-compact]]:hidden ${wide ? 'max-w-[600px]' : 'max-w-[520px]'}`}>
            <div className={`pointer-events-auto ${hideOnDesktop ? 'invisible' : ''}`}>{children}</div>
        </div>
    )
}

/** Không có hành trình (giảm chuyển động): mỗi chương một section cao tối thiểu 100vh, cột chữ bên trái (desktop) hoặc nằm dưới canvas (màn hẹp). */
function Chapter({ id, index, staticMode, wide, children }: { id: string; index: number; staticMode: boolean; wide?: boolean; children: ReactNode }) {
    const width = wide ? 'max-w-[600px]' : 'max-w-[520px]'
    const hidden = index === 2 && !staticMode ? 'invisible' : ''
    return (
        <section
            id={id}
            data-chapter={index}
            className={`section-anchor container-page flex min-h-[100svh] pb-16 ${staticMode ? 'scroll-mt-0 items-start' : 'items-center pt-24'}`}
            style={staticMode ? { paddingTop: 'calc(44svh + 1rem)' } : undefined}
        >
            <div className={`pointer-events-auto w-full ${width} ${hidden}`}>{children}</div>
        </section>
    )
}

/** Hiện dần khi vào khung nhìn (tắt khi prefers-reduced-motion nhờ CSS .reveal). Chỉ dùng khi không có hành trình. */
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

const Eyebrow = ({ children }: { children: ReactNode }) => <p data-s className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">{children}</p>
const Title = ({ id, children }: { id?: string; children: string }) => (
    <h2 data-s id={id} className="mt-3 text-[clamp(1.9rem,3.4vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {children.split('\n').map((line, i) => (
            <span key={i} className="block">
                {line}
            </span>
        ))}
    </h2>
)
const Lead = ({ children }: { children: ReactNode }) => <p data-s data-compact className="mb-6 mt-4 text-[17px] leading-relaxed text-muted-foreground">{children}</p>
/** Thẻ sáng (nền card) theo giao diện, nổi lên trên cảnh 3D */
const lightCard = 'rounded-[20px] border border-border bg-card/95 shadow-raised'

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
            <h1 data-s className="text-[clamp(2.75rem,4.6vw,4.75rem)] font-black leading-[0.96] tracking-[-0.045em] [text-wrap:balance]">
                Chào {name}.
                <br />
                Hôm nay chỉ cần
                <br />
                <span className="text-brand-ink">25 phút.</span>
            </h1>
            <p data-s className="max-w-xl text-lg leading-relaxed text-muted-foreground">Học tiếp bài đang dở, rồi đọc 3 bài ngắn AI chọn riêng cho phần bạn còn hổng.</p>

            {resume ? (
                <Link
                    to={`/lesson/${resume.id}`}
                    data-s
                    data-vt={`lesson-${resume.id}`}
                    className="group relative mt-1 flex items-center gap-4 overflow-hidden rounded-[22px] bg-card p-3 pr-4 text-foreground shadow-raised transition duration-base ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
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
                <p data-s className="max-w-md rounded-card bg-muted p-4 text-sm text-muted-foreground">Chưa có bài nào được giảng viên xuất bản.</p>
            )}
            <span data-s data-compact className="hidden text-sm text-muted-foreground lg:block">Kéo vào khoảng trống bên phải để xoay mô hình, di vào một tòa nhà để làm nổi nó lên.</span>
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
    const today = useTodayDaily()

    return (
        <>
            <Eyebrow>01 · Hôm nay</Eyebrow>
            <Title id="daily-title">3 bài đọc ngắn cho hôm nay</Title>
            <Lead>Mỗi bài khoảng 1 phút. AI chọn theo chỗ bạn còn hổng.</Lead>
            <div data-s>
                <TodayCount today={today} />
            </div>
            <div data-s className="mt-4">
                <TodayHeroCard today={today} />
            </div>
            <div data-s className="mt-3">
                <TodayMiniCards today={today} />
            </div>
            <div data-s data-compact className="mt-4">
                <TodayMissionLine today={today} />
            </div>
        </>
    )
}

// ─── Chương 2: Khóa học ────────────────────────────────────────────────────

function CoursesChapter() {
    const summaries = useCourseSummaries()
    const list = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    // Desktop: nội dung này hiện trên màn kiosk 3D (KioskScreen); cột chữ chỉ hiện ở màn hẹp và chế độ làm mờ cảnh
    return (
        <>
            <Eyebrow>02 · Khóa học</Eyebrow>
            <Title id="courses-title">{'Khóa học của bạn'}</Title>
            <Lead>Học theo chặng, đích là test cuối chương.</Lead>
            <div data-s className="flex flex-col gap-3">
                {list.length === 0 && <p className={`${lightCard} p-5 text-muted-foreground`}>Chưa có khóa học nào được giảng viên xuất bản.</p>}
                {list.map((c) => (
                    <CourseRow key={c.course.id} summary={c} />
                ))}
                <Link to="/learning" className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-extrabold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    Xem tất cả khóa học <ArrowRight size={15} />
                </Link>
            </div>
        </>
    )
}

function CourseRow({ summary }: { summary: CourseSummary }) {
    const { course, lessons: ls, status, pct, curIndex } = summary
    const lesson = ls[curIndex] ?? ls[0]
    const sub = status === 'doing' ? `Chặng ${curIndex + 1}/${ls.length}` : status === 'done' ? 'Đã xong' : `${ls.length} bài`
    const action = status === 'done' ? 'Xem lại' : pct > 0 ? 'Học tiếp' : 'Bắt đầu'
    return (
        <div className={`${lightCard} group relative grid grid-cols-[84px_1fr] gap-3.5 p-3 transition duration-base ease-out focus-within:ring-2 focus-within:ring-ring/70 hover:-translate-y-0.5 hover:border-brand-300`}>
            <Link to={`/learning?course=${course.id}`} aria-label={`Xem khóa ${course.title}`} className="absolute inset-0 rounded-[20px] focus-visible:outline-none" />
            <div className={`pointer-events-none relative h-[84px] w-[84px] overflow-hidden rounded-2xl ${status === 'new' ? 'saturate-[.5]' : ''}`}>
                <CourseArt course={course} className="h-full w-full" />
            </div>
            <div className="pointer-events-none flex min-w-0 flex-col justify-between gap-1.5">
                <small className="truncate font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-ink">
                    {course.subject} · {sub}
                </small>
                <span className="flex items-baseline justify-between gap-3">
                    <b className="line-clamp-2 text-[15px] leading-snug">{course.title}</b>
                    <span className="font-mono text-lg font-bold">{pct}%</span>
                </span>
                <span className="flex items-center gap-3">
                    <span className="h-1 flex-1 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${course.title}`}>
                        <span className="block h-full rounded bg-brand-600" style={{ width: `${pct}%` }} />
                    </span>
                    {lesson && (
                        <Link to={`/lesson/${lesson.id}`} data-vt={`lesson-${lesson.id}`} className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                            <Play size={11} className="fill-current" /> {action}
                        </Link>
                    )}
                </span>
            </div>
        </div>
    )
}

// ─── Chương 3: Studio 3D ───────────────────────────────────────────────────

function StudioChapter() {
    return (
        <>
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
            <p data-s data-compact className="mt-5 flex items-center gap-2.5 rounded-[14px] border border-border bg-card/90 px-3 py-2.5 text-[13px]">
                <span aria-hidden className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-brand-600">
                    <Sparkles size={14} />
                </span>
                “Studio tối, đèn chính vàng ấm từ trái, viền sáng phía sau”
            </p>
            <Link to="/studio" data-s data-vt="studio-stage" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                Vào Studio <ArrowRight size={16} />
            </Link>
        </>
    )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[30px_1fr] gap-3 text-sm text-muted-foreground">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-muted text-brand-ink">{icon}</span>
            <span>
                <b className="text-foreground">{title}:</b> {children}
            </span>
        </div>
    )
}
