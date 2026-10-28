import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, Play, Sparkles } from 'lucide-react'
import { getCourse, lessons } from '@/data'
import { CourseArt } from '@/components/courses/course-cover'
import { courseKicker, primaryCourse, STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'
import { trackPage } from '@/lib/page-metrics'
import { trackBalance } from '@/lib/hero-balance'
import { BalanceGuides } from '@/components/home/balance-guides'
import { FLAGS, mountPerfHud } from '@/lib/perf'
import { overlay } from '@/lib/stage-signal'
import { dailyArticles } from '@/data'
import { A2_TIERS, FINALE_STEP_MS, type DailyLit } from '@/lib/daily-lit'
import { announceRewards, LIGHTS_XP, localDate } from '@/lib/gamification'
import { CHAPTERS, PIN_SWAP, useScrollStage, useStageMode } from '@/hooks/useScrollStage'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { TodayHeroCard, TodayMissionLine, TodayRows } from '@/components/daily/today-board'
import { useOrbitStore } from '@/store/useOrbitStore'
import { CampusStage } from '@/components/home/campus-stage'
import { KioskScreen, type KioskBridge } from '@/components/home/kiosk-screen'
import { setKioskCourse } from '@/lib/kiosk-course'
import { BenchRunner } from '@/components/home/bench-runner'
import { ResumeCard } from '@/components/home/resume-card'
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
    const paged = journey && !FLAGS.docScroll
    const { stage } = useScrollStage({ journey, paged, barRef, rootRef, calmRef })
    const dailyLit = useDailyLit(stage, reduce)
    const screenRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const footerRef = useRef<HTMLDivElement>(null)
    const dockRef = useRef<HTMLDivElement>(null)
    const veilRef = useRef<HTMLDivElement>(null)
    const kiosk = useMemo<KioskBridge>(() => ({ screen: screenRef, root: rootRef, stage: stageRef, footer: footerRef, dock: dockRef, veil: veilRef, calm: calmRef }), [])

    // Số đo layout (footer, hành trình, scrollHeight) đo một lần + khi resize; layout effect chạy trước effect của useScrollStage
    useLayoutEffect(() => trackPage(() => footerRef.current).stop, [])
    // Cân nhóm chữ ↔ vật thể chính của chương (đo một lần khi mount / resize / font tải xong)
    useEffect(() => (journey && !staticMode ? trackBalance() : undefined), [journey, staticMode])
    useEffect(() => mountPerfHud(), [])

    return (
        <div ref={rootRef} data-calm={calm} className="group/home relative w-full bg-stage text-foreground">
            <CampusStage stage={stage} staticMode={staticMode} reduce={reduce} flat={!journey} dailyLit={dailyLit} kiosk={kiosk} />
            {/* MỘT lớp màu nền (chỉ đổi opacity, xem stage-signal): nền tối nhẹ khi có chữ, che quanh điểm cắt cảnh, che khi nhảy chương */}
            <div ref={(el) => void (overlay.el = el)} data-overlay aria-hidden className="own-layer pointer-events-none fixed inset-0 z-[4] bg-stage opacity-0" />
            <div ref={veilRef} aria-hidden data-static={staticMode} className="stage-veil own-layer pointer-events-none fixed inset-0 z-[1]" />
            {!staticMode && !FLAGS.noKiosk && <KioskScreen screenRef={screenRef} />}
            <BenchRunner />
            {FLAGS.balance && journey && !staticMode && <BalanceGuides />}
            <div ref={barRef} aria-hidden data-bar className="own-layer pointer-events-none fixed left-0 top-0 z-[60] h-[3px] w-full origin-left scale-x-0 mm-ribbon-bg" />

            {/* Chương không nhận chuột (để kéo xoay mô hình ở phần trống); chỉ khối nội dung nhận */}
            {journey ? (
                <section id="journey" className="pointer-events-none relative z-10" style={{ height: paged ? '100svh' : `${(CHAPTERS + 1) * 100}svh` }}>
                    <div className={`container-wide ${paged ? 'relative' : PIN_SWAP ? 'absolute inset-x-0 top-0' : 'sticky top-0'} flex h-[100svh] ${staticMode ? 'items-start pb-6' : 'items-center py-[var(--nav-h)]'}`} style={staticMode ? { paddingTop: 'calc(44svh + 1rem)' } : undefined}>
                        <div className="grid w-full grid-cols-[minmax(0,1fr)] items-center">
                            <Panel id="top" index={0}>
                                <HeroChapter />
                            </Panel>
                            <Panel id="daily" index={1}>
                                <DailyChapter />
                            </Panel>
                            <Panel id="courses" index={2}>
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
                    <Chapter id="top" index={0} staticMode={staticMode}>
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

            {/* Dòng hướng dẫn cho người mới: hook ghi chữ và độ hiện; ẩn ở footer */}
            {journey && (
                <p data-guide aria-live="polite" style={{ opacity: 0 }} className="own-layer pointer-events-none fixed bottom-5 left-1/2 z-[6] flex max-w-[calc(100vw-3rem)] -translate-x-1/2 flex-col items-center gap-1.5 text-center text-xs text-muted-foreground transition-opacity duration-slow">
                    <span className="guide-mouse" aria-hidden />
                    <span data-guide-text className="ptit-pin ptit-pin-quiet rounded-full px-3 py-1.5">Cuộn để khám phá các chức năng</span>
                </p>
            )}

            {!staticMode && (
                <div ref={dockRef} data-dock className="own-layer fixed bottom-5 right-[var(--page-edge)] z-[6] flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                    <button
                        type="button"
                        aria-pressed={calm}
                        onClick={() => setCalm(!calm)}
                        className="ptit-pin ptit-pin-quiet rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    >
                        {calm ? 'Hiện mô hình 3D' : 'Ẩn mô hình 3D'}
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
    const pending = !claimed && readToday > 0 && dailyArticles.every((a) => read[a.id] === today)
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

/** Bề rộng cột chữ theo lưới 12 cột của .container-wide (gap 24): cả hero và 3 chương đều 5 cột (mép phải khối bấm thẳng hàng). */
const colWidth = 'max-w-[calc((100%-264px)*5/12+96px)]'
/** Riêng chương Học phần: tiêu đề + đoạn dẫn tràn ra 6 cột (= 6/5 bề rộng 5 cột + 4,8px) để giữ nguyên ngắt dòng; khối bấm vẫn 5 cột. */
const wide6 = 'w-[calc(6/5*100%+4.8px)]'

/**
 * Panel của hành trình: các panel xếp chồng trong một ô lưới; useScrollStage đặt class on / past, CSS (index.css) lo phần hiện ẩn
 * và hiện từng phần tử [data-s] theo nhịp cố định. Panel không `on` thì visibility: hidden (không nhận chuột).
 * Màn hẹp: khung chỉ cao ~56svh nên phần tử [data-compact] (câu dẫn, nhiệm vụ, chú thích) được ẩn để panel vừa khung.
 */
function Panel({ id, index, children }: { id: string; index: number; children: ReactNode }) {
    return (
        <div id={id} data-panel={index} data-journey className={`col-start-1 row-start-1 w-full max-[859px]:[&_[data-compact]]:hidden ${colWidth}`}>
            {/* data-text: nhóm chữ của chương, hero-balance đo và dời bằng transform; --g / --tt = hệ số thu khoảng cách / cỡ tiêu đề */}
            <div data-text className="pointer-events-auto">{children}</div>
        </div>
    )
}

/** Không có hành trình (giảm chuyển động): mỗi chương một section cao tối thiểu 100vh, cột chữ bên trái (desktop) hoặc nằm dưới canvas (màn hẹp). */
function Chapter({ id, index, staticMode, children }: { id: string; index: number; staticMode: boolean; children: ReactNode }) {
    const width = colWidth
    return (
        <section
            id={id}
            data-chapter={index}
            className={`section-anchor container-wide flex min-h-[100svh] pb-16 ${staticMode ? 'scroll-mt-0 items-start' : 'items-center pt-24'}`}
            style={staticMode ? { paddingTop: 'calc(44svh + 1rem)' } : undefined}
        >
            <div className={`pointer-events-auto w-full ${width}`}>{children}</div>
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
/** Nhịp khoảng cách chương (token --ch-gap-* ở index.css, nhân --g khi chương phải thu cho vừa khung): eyebrow → tiêu đề 16, tiêu đề → dẫn 20, dẫn → nội dung 28, giữa hàng 10, nội dung → link 20 */
const gap = (token: string) => `calc(var(--ch-gap-${token}) * var(--g, 1))`
const Title = ({ id, children }: { id?: string; children: string }) => (
    <h2 data-s id={id} style={{ marginTop: gap('title'), fontSize: 'clamp(36px, 2.8vw, 48px)' }} className="font-extrabold leading-[1.08] tracking-[-0.03em]">
        {children.split('\n').map((line, i) => (
            <span key={i} className="block">
                {line}
            </span>
        ))}
    </h2>
)
const Lead = ({ children }: { children: ReactNode }) => (
    <p data-s data-compact style={{ marginTop: gap('lead'), marginBottom: gap('body'), fontSize: '17px', lineHeight: '1.6' }} className="max-w-[46ch] text-muted-foreground">
        {children}
    </p>
)
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

    return (
        <div className="flex min-w-0 flex-col" style={{ gap: 'calc(24px * var(--g, 1))' }}>
            <h1 data-s style={{ fontSize: 'calc(clamp(58px, 4.9vw, 92px) * var(--tt, 1))' }} className="font-black leading-[0.96] tracking-[-0.045em] text-strong">
                <span className="block whitespace-nowrap">Chào {name}.</span>
                <span className="block whitespace-nowrap">Hôm nay chỉ cần</span>
                <span className="ptit-gradient-text block whitespace-nowrap">25 phút.</span>
            </h1>
            <p data-s style={{ fontSize: 'clamp(17px, 1.25vw, 21px)' }} className="max-w-[34ch] leading-relaxed text-muted-foreground">Lộ trình hôm nay AI xếp riêng cho bạn: xem tiếp bài giảng đang dở, rồi ôn nhanh những khái niệm còn hổng.</p>

            {resume ? (
                <div data-s data-vt={`lesson-${resume.id}`} className="max-w-[600px]">
                    <ResumeCard lesson={resume} courseTitle={getCourse(resume.courseId)?.title ?? 'Khóa học'} resumeSec={resumeAt} />
                </div>
            ) : (
                <p data-s className="max-w-md rounded-card bg-muted p-4 text-sm text-muted-foreground">Chưa có bài nào được giảng viên xuất bản.</p>
            )}
        </div>
    )
}

// ─── Chương 1: Hôm nay (Orbit Daily) ───────────────────────────────────────

function DailyChapter() {
    const today = useTodayDaily()

    return (
        <>
            <Eyebrow>01 · Ôn tập cá nhân hóa · {Math.min(today.readCount, today.limit)}/{today.limit} đã đọc</Eyebrow>
            <Title id="daily-title">Lấp lỗ hổng kiến thức chỉ với 3 phút mỗi ngày.</Title>
            <Lead>AI xem lại những câu bạn từng làm sai, rồi tóm thành 3 bài đọc ngắn từ chính bài giảng của thầy cô. Nắm lại bản chất mà không phải xem lại cả video dài.</Lead>
            <div data-s>
                <TodayHeroCard today={today} compact />
            </div>
            <div data-s style={{ marginTop: gap('card') }}>
                <TodayRows today={today} max={2} />
            </div>
            <div data-s data-compact style={{ marginTop: gap('link') }}>
                <TodayMissionLine today={today} />
            </div>
        </>
    )
}

// ─── Chương 2: Khóa học ────────────────────────────────────────────────────

function CoursesChapter() {
    const summaries = useCourseSummaries()
    const list = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    const main = primaryCourse(list)
    const rest = list.filter((c) => c !== main)
    return (
        <>
            <Eyebrow>02 · Học phần chuyên ngành</Eyebrow>
            <div className={`${wide6} max-w-none`}>
                <Title id="courses-title">Học chủ động cùng bài giảng tương tác và Trợ giảng AI.</Title>
                <Lead>Video tự dừng ở các mốc quan trọng để hỏi bạn. Chỗ nào chưa rõ, hỏi Trợ giảng AI ngay tại đó rồi bấm để tua tới đúng giây thầy cô giảng.</Lead>
            </div>
            {list.length === 0 && <p data-s className={`${lightCard} p-5 text-muted-foreground`}>Chưa có khóa học nào được giảng viên xuất bản.</p>}
            {main && (
                <div data-s>
                    <MainCourseCard summary={main} />
                </div>
            )}
            {rest.slice(0, 2).map((c) => (
                <div data-s key={c.course.id} style={{ marginTop: gap('card') }}>
                    <CourseRow summary={c} />
                </div>
            ))}
            <Link data-s to="/learning" style={{ marginTop: gap('link') }} className="inline-flex items-center gap-1 self-start border-t border-border pt-3 text-sm font-bold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                Xem tất cả học phần <ArrowRight size={14} />
            </Link>
        </>
    )
}

/** Rê chuột / focus một khóa ở cột chữ thì poster trên màn kiosk 3D đổi sang khóa đó; rời thì về khóa đang học. */
const kioskHover = (id: string) => ({
    onMouseEnter: () => setKioskCourse(id),
    onMouseLeave: () => setKioskCourse(null),
    onFocus: () => setKioskCourse(id),
    onBlur: () => setKioskCourse(null),
})

/** Khóa đang học: bìa vuông 96px bên trái; bên phải eyebrow, tên khóa, bài tiếp theo, rồi thanh % + nút trên một hàng. */
function MainCourseCard({ summary }: { summary: CourseSummary }) {
    const { course, lessons: ls, pct, curIndex, status } = summary
    const lesson = ls[curIndex] ?? ls[0]
    const action = status === 'done' ? 'Xem lại' : pct > 0 ? 'Học tiếp' : 'Bắt đầu'
    return (
        <div {...kioskHover(course.id)} className={`${lightCard} group relative flex gap-4 p-4 transition duration-base ease-out focus-within:ring-2 focus-within:ring-ring/70 hover:-translate-y-0.5 hover:border-brand-300`}>
            <Link to={`/learning?course=${course.id}`} aria-label={`Xem khóa ${course.title}`} className="absolute inset-0 z-0 rounded-[20px] focus-visible:outline-none" />
            <span className="pointer-events-none relative block h-24 w-24 shrink-0 overflow-hidden rounded-xl">
                <CourseArt course={course} className="h-full w-full" />
            </span>
            <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1.5">
                <small className="truncate font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-ink">{courseKicker(summary)}</small>
                <b className="text-xl font-extrabold leading-tight tracking-[-0.02em]">{course.title}</b>
                {lesson && (
                    <span className="truncate text-[13px] text-muted-foreground">
                        Tiếp theo: <b className="font-semibold text-foreground">{lesson.title}</b>
                    </span>
                )}
                <span className="mt-1 flex items-center gap-3">
                    <span className="h-[5px] flex-1 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${course.title}`}>
                        <span className="block h-full rounded bg-brand-600" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="font-mono text-lg font-bold text-brand-ink">{pct}%</span>
                    {lesson && (
                        <Link to={`/lesson/${lesson.id}`} data-vt={`lesson-${lesson.id}`} className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-4 py-[9px] text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                            <Play size={12} className="fill-current" /> {action}
                        </Link>
                    )}
                </span>
            </div>
        </div>
    )
}

/** Hàng một dòng cho các khóa còn lại: ô 48px, tên khóa, bên phải "Bắt đầu →" hoặc %. */
function CourseRow({ summary }: { summary: CourseSummary }) {
    const { course, status, pct } = summary
    return (
        <Link
            to={`/learning?course=${course.id}`}
            aria-label={`Xem khóa ${course.title}`}
            {...kioskHover(course.id)}
            className={`${lightCard} group grid grid-cols-[48px_1fr_auto] items-center gap-3.5 p-2 transition duration-base ease-out hover:-translate-y-0.5 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70`}
        >
            <span className={`block h-12 w-12 overflow-hidden rounded-lg ${status === 'new' ? 'saturate-[.5]' : ''}`}>
                <CourseArt course={course} className="h-full w-full" />
            </span>
            <b className="truncate text-[15px] leading-snug">{course.title}</b>
            <span className="pr-2 font-mono text-[13px] text-muted-foreground">{pct > 0 ? `${pct}%` : 'Bắt đầu →'}</span>
        </Link>
    )
}

// ─── Chương 3: Studio 3D ───────────────────────────────────────────────────

function StudioChapter() {
    return (
        <>
            <Eyebrow>03 · Studio 3D</Eyebrow>
            <Title id="studio-title">Từ lý thuyết trên giảng đường ra phim trường ảo 3D.</Title>
            <Lead>Phòng thực hành Nhiếp ảnh và Ánh sáng ngay trên trình duyệt. Tự đặt đèn 3 điểm, chỉnh góc máy rồi để AI chấm ảnh, trước khi vào phòng quay thật.</Lead>
            <div data-s className="flex flex-col" style={{ gap: gap('card') }}>
                <Feature icon={<Sparkles size={16} />} title="Thiết lập bối cảnh bằng AI">
                    Mô tả ý đồ ánh sáng bằng lời, AI tự động dựng đèn, màu nền, độ sương và giải thích theo đúng lý thuyết nhiếp ảnh.
                </Feature>
                <Feature icon={<Camera size={16} />} title="Đạo diễn hình ảnh AI">
                    Chụp thử trên mô hình 3D để AI chấm điểm bố cục, độ tương phản và khoanh vùng trực tiếp những chi tiết cần tinh chỉnh.
                </Feature>
            </div>
            <p data-s data-compact style={{ marginTop: gap('card') }} className="flex items-center gap-2.5 rounded-[14px] border border-border bg-card/90 p-3 text-[13px]">
                <span aria-hidden className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-brand-600">
                    <Sparkles size={14} />
                </span>
                “Studio tối, đèn chính vàng ấm từ trái, viền sáng phía sau”
            </p>
            <Link to="/studio" data-s data-vt="studio-stage" style={{ marginTop: gap('link') }} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                Vào Studio 3D <ArrowRight size={16} />
            </Link>
        </>
    )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[30px_1fr] gap-3 text-[15px] leading-relaxed text-muted-foreground">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-muted text-brand-ink">{icon}</span>
            <span>
                <b className="text-foreground">{title}:</b> {children}
            </span>
        </div>
    )
}
