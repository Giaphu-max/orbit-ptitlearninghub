import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Award, Check, CheckCircle2, ChevronDown, Flame, Lock, Sparkles, Target, Video } from 'lucide-react'
import { badges } from '@/data'
import { CLASS_NAME, CLASSMATE_XP } from '@/data/leaderboard'
import { badgeProgress, bestTestRatio, buildSkillTree, levelProgress, levelTitle, UNLOCK_THRESHOLD, visibleStreak, type SkillNode } from '@/lib/gamification'
import { primaryCourse, STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'
import { CourseArt } from '@/components/courses/course-cover'
import { MissionTiles } from '@/components/missions'
import { MASTERY_PER_CORRECT, SkillMap } from '@/components/journey/skill-map'
import { useOrbitStore, xpBalance } from '@/store/useOrbitStore'

type Tab = 'map' | 'badges' | 'rank'

/**
 * /journey – 3 bước đánh số (mockup ptit-journey-v2): ① việc nên làm bây giờ (thẻ đỏ tầng 1, 8 cột) và ② nhiệm vụ hôm nay (4 cột) cùng một hàng,
 * ③ xem lại tiến độ (12 cột) với 3 tab: Bản đồ kỹ năng | Huy hiệu | Xếp hạng lớp. Trạng thái cấp và chuỗi ngày là hai viên nhỏ ở header.
 */
export function OrbitJourneyView() {
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const nodes = buildSkillTree(mastery)
    const focus = pickFocus(nodes)
    return (
        <div className="w-full">
            <div className="container-wide flex flex-col gap-7 py-8 lg:py-12">
                <Header />
                <div className="page-grid items-stretch gap-y-8">
                    <section aria-labelledby="step-1" className="col-span-8 flex flex-col [&>a]:flex-1">
                        <Step id="step-1" n={1} red hint="khái niệm sắp mở khóa bài mới">Việc nên làm bây giờ</Step>
                        {focus ? <FocusCard node={focus} nodes={nodes} /> : <p className="rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khái niệm nào.</p>}
                    </section>
                    <section aria-labelledby="step-2" className="col-span-4 flex flex-col">
                        <Step id="step-2" n={2}>Nhiệm vụ hôm nay</Step>
                        <MissionTiles />
                    </section>
                    <Review nodes={nodes} />
                </div>
            </div>
        </div>
    )
}

function Step({ id, n, red, hint, children }: { id: string; n: number; red?: boolean; hint?: string; children: ReactNode }) {
    return (
        <h2 id={id} className="mb-3 flex items-center gap-2.5 text-[15px] font-extrabold text-strong">
            <span className={`grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold text-ink-foreground ${red ? 'bg-brand-600' : 'bg-ink'}`}>{n}</span>
            {children}
            {hint && <small className="text-[13.5px] font-medium text-muted-foreground">· {hint}</small>}
        </h2>
    )
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header() {
    const xp = useOrbitStore((s) => s.xp)
    const balance = useOrbitStore((s) => xpBalance(s))
    const streak = visibleStreak(useOrbitStore((s) => s.streak))
    const lp = levelProgress(xp)
    const R = 14
    const C = 2 * Math.PI * R
    return (
        <header className="flex items-end justify-between gap-10">
            <div>
                <p className="text-eyebrow uppercase text-brand-ink">Tiến độ & Kỹ năng</p>
                <h1 className="mt-3 flex items-center gap-3 text-[40px] font-black leading-[1.1] tracking-[-0.03em] text-strong">
                    Điểm thưởng đến từ việc hiểu bài
                    <Tip
                        label="Cách tính XP"
                        text="XP chỉ tính khi bạn trả lời đúng, sửa được lỗi sai hoặc hoàn thành bài. Xem video lâu hay bấm nhiều không làm tăng điểm."
                        className="relative grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] border-border bg-card font-sans text-[13px] font-bold tracking-normal text-muted-foreground"
                        width="w-[300px]"
                        center
                    >
                        ?
                    </Tip>
                </h1>
            </div>
            <div className="flex shrink-0 gap-2.5">
                <Tip
                    label="Chi tiết XP"
                    text={`Tổng đã kiếm ${xp.toLocaleString('vi-VN')} XP · còn tiêu được ${balance.toLocaleString('vi-VN')} XP`}
                    className="relative flex items-center gap-2.5 rounded-full border border-border bg-card py-2 pl-2 pr-3.5 text-[13px] text-muted-foreground"
                    width="w-max"
                    right
                >
                    <span className="relative h-[34px] w-[34px]" role="img" aria-label={`Cấp ${lp.level}`}>
                        <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90" aria-hidden>
                            <circle cx="17" cy="17" r={R} fill="none" strokeWidth="4" className="stroke-muted" />
                            <circle cx="17" cy="17" r={R} fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - lp.ratio)} className="stroke-mm-blue" />
                        </svg>
                        <b className="absolute inset-0 grid place-items-center font-mono text-[13px] font-extrabold text-strong">{lp.level}</b>
                    </span>
                    <span className="text-left">
                        <b className="block font-sans text-[14.5px] font-extrabold leading-tight text-strong">{levelTitle(lp.level)}</b>
                        còn {lp.toNext.toLocaleString('vi-VN')} XP lên cấp {lp.level + 1}
                    </span>
                </Tip>
                <span className="flex items-center gap-2.5 rounded-full border border-border bg-card py-2 pl-2 pr-3.5 text-[13px] text-muted-foreground">
                    <span className={`grid h-[34px] w-[34px] place-items-center rounded-full ${streak.count > 0 ? 'bg-brand-50 text-brand-ink' : 'bg-muted text-muted-foreground'}`}>
                        <Flame size={17} className={streak.count > 0 ? 'fill-current' : ''} />
                    </span>
                    <span>
                        <b className="block text-[14.5px] font-extrabold leading-tight text-strong">{streak.count} ngày</b>chuỗi học
                    </span>
                </span>
            </div>
        </header>
    )
}

/** Phần tử có tooltip nền tối: hiện khi rê chuột hoặc focus (tabIndex 0). */
function Tip({ label, text, className, width, center, right, children }: { label: string; text: string; className: string; width: string; center?: boolean; right?: boolean; children: ReactNode }) {
    return (
        <span tabIndex={0} aria-label={label} className={`group/tip cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${className}`}>
            {children}
            <span role="tooltip" className={`pointer-events-none absolute top-[calc(100%+10px)] z-20 -translate-y-1 rounded-[10px] bg-ink px-3 py-2.5 text-left font-sans text-[13px] font-medium leading-[1.5] tracking-normal text-ink-foreground opacity-0 transition duration-base group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-visible/tip:translate-y-0 group-focus-visible/tip:opacity-100 ${width} ${center ? 'left-1/2 -translate-x-1/2' : right ? 'right-0' : 'left-0'}`}>
                {text}
            </span>
        </span>
    )
}

// ─── Bước 1: nên ôn tiếp ───────────────────────────────────────────────────

/** Khái niệm nên ôn: đã mở khóa, chưa đạt ngưỡng, mức cao nhất (ưu tiên cái chặn khái niệm sau); không có thì khái niệm yếu nhất. */
function pickFocus(nodes: SkillNode[]): SkillNode | undefined {
    const open = nodes.filter((n) => n.unlocked && n.mastery < UNLOCK_THRESHOLD)
    const blocking = open.filter((n) => nodes.some((o) => o.missing.some((m) => m.id === n.concept.id)))
    const best = (list: SkillNode[]) => [...list].sort((a, b) => b.mastery - a.mastery)[0]
    return best(blocking) ?? best(open) ?? [...nodes].sort((a, b) => a.mastery - b.mastery)[0]
}

function FocusCard({ node, nodes }: { node: SkillNode; nodes: SkillNode[] }) {
    const pct = Math.round(node.mastery * 100)
    const after = nodes.find((o) => o.missing.some((m) => m.id === node.concept.id))
    const left = Math.max(1, Math.ceil((UNLOCK_THRESHOLD - node.mastery) / MASTERY_PER_CORRECT))
    const reached = node.mastery >= UNLOCK_THRESHOLD
    const C = 295.3
    return (
        <Link
            to={`/lesson/${node.lessonId}?t=${Math.floor(node.concept.segment.start)}`}
            className="surface-red grid grid-cols-[auto_1fr] items-center gap-7 rounded-3xl px-[34px] py-[30px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
            <span className="relative h-28 w-28" role="img" aria-label={`Nắm vững ${pct}%`}>
                <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90" aria-hidden>
                    <circle cx="56" cy="56" r="47" fill="none" strokeWidth="10" style={{ stroke: 'hsl(var(--ink-foreground) / 0.25)' }} />
                    <circle cx="56" cy="56" r="47" fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - node.mastery)} style={{ stroke: 'hsl(var(--ink-foreground))' }} />
                </svg>
                <b className="absolute inset-0 grid place-items-center font-mono text-[26px] font-extrabold">{pct}%</b>
            </span>
            <span>
                <small className="text-xs font-bold uppercase tracking-[0.12em] text-ink-foreground/85">Nên ôn tiếp</small>
                <h3 className="mt-2 text-[34px] font-black leading-[1.12] tracking-[-0.025em]">{node.concept.name}</h3>
                {!reached && <p className="mt-2.5 text-[15.5px] leading-normal text-ink-foreground/90">Còn {left} câu đúng nữa là đạt {Math.round(UNLOCK_THRESHOLD * 100)}%.</p>}
                {after && (
                    <span className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-ink-foreground/30 bg-ink-foreground/15 px-3 py-1.5 text-[13.5px] font-semibold">
                        <Lock size={14} /> Mở khóa “{after.concept.name}”
                    </span>
                )}
                <br />
                <span className="tier-1-bob mt-[22px] inline-flex items-center gap-2 rounded-[14px] bg-ink-foreground px-[22px] py-3.5 text-base font-extrabold text-brand-ink">Ôn khái niệm này →</span>
            </span>
        </Link>
    )
}

// ─── Bước 3: xem lại tiến độ ───────────────────────────────────────────────

function Review({ nodes }: { nodes: SkillNode[] }) {
    const [params, setParams] = useSearchParams()
    const earned = useOrbitStore((s) => s.earnedBadgeIds)
    const xp = useOrbitStore((s) => s.xp)
    const tab: Tab = params.get('tab') === 'badges' ? 'badges' : params.get('tab') === 'rank' ? 'rank' : 'map'
    const strong = nodes.filter((n) => n.mastery >= UNLOCK_THRESHOLD).length
    const shown = badges.filter((b) => !b.hidden || earned.includes(b.id))
    const got = shown.filter((b) => earned.includes(b.id)).length
    const rank = CLASSMATE_XP.filter((v) => v > xp).length + 1
    const tabs: { id: Tab; label: string; count: string }[] = [
        { id: 'map', label: 'Bản đồ kỹ năng', count: `${strong}/${nodes.length}` },
        { id: 'badges', label: 'Huy hiệu', count: `${got}/${shown.length}` },
        { id: 'rank', label: 'Xếp hạng lớp', count: `#${rank}` },
    ]
    const pick = (t: Tab) => setParams(t === 'map' ? {} : { tab: t }, { replace: true, preventScrollReset: true })
    return (
        <section aria-labelledby="step-3" className="col-span-12">
            <Step id="step-3" n={3}>Xem lại tiến độ</Step>
            <div role="tablist" aria-label="Xem lại tiến độ" className="mb-3.5 flex w-max gap-1 rounded-[14px] bg-muted p-1">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        id={`tab-${t.id}`}
                        aria-selected={tab === t.id}
                        aria-controls={`panel-${t.id}`}
                        onClick={() => pick(t.id)}
                        className={`flex items-center gap-2 rounded-[10px] px-4 py-[9px] text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${tab === t.id ? 'bg-card text-strong shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {t.label}
                        <em className="font-mono text-xs font-semibold not-italic opacity-75">{t.count}</em>
                    </button>
                ))}
            </div>
            <div className="rounded-card border border-border bg-card shadow-card">
                <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="sk-tab">
                    {tab === 'map' && <MapPanel nodes={nodes} />}
                    {tab === 'badges' && <BadgesPanel />}
                    {tab === 'rank' && <RankPanel />}
                </div>
            </div>
        </section>
    )
}

// ─── Panel: Bản đồ kỹ năng ─────────────────────────────────────────────────

const shortName = (t: string) => (t.length > 26 ? `${t.slice(0, 25).trimEnd()}…` : t)

function MapPanel({ nodes }: { nodes: SkillNode[] }) {
    const summaries = useCourseSummaries()
    const list = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    const [courseId, setCourseId] = useState<string | undefined>()
    const [pickIdx, setPickIdx] = useState<{ course: string; idx: number } | null>(null)
    const course: CourseSummary | undefined = list.find((c) => c.course.id === courseId) ?? primaryCourse(list)
    if (!course) return <p className="p-6 text-sm text-muted-foreground">Chưa có học phần nào.</p>
    const lessons = course.lessons
    const idx = pickIdx && pickIdx.course === course.course.id ? pickIdx.idx : Math.max(0, course.curIndex)
    const lesson = lessons[idx]
    const lessonNodes = lesson ? nodes.filter((n) => n.lessonId === lesson.id).sort((a, b) => a.depth - b.depth) : []
    const courseNodes = nodes.filter((n) => lessons.some((l) => l.id === n.lessonId))
    const doneAll = (lid: string) => {
        const ns = nodes.filter((n) => n.lessonId === lid)
        return ns.length > 0 && ns.every((n) => n.mastery >= UNLOCK_THRESHOLD)
    }
    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-6 border-b border-border px-[26px] py-5">
                <div className="flex items-center gap-4">
                    <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-[14px]">
                        <CourseArt course={course.course} className="h-full w-full" />
                    </span>
                    <div>
                        <small className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-ink">Bản đồ kỹ năng của học phần</small>
                        <CourseMenu list={list} current={course} onPick={(id) => { setCourseId(id); setPickIdx(null) }} />
                        <p className="text-[13px] text-muted-foreground">{course.course.subject} · {lessons.length} bài giảng · {courseNodes.length} khái niệm</p>
                    </div>
                </div>
                <ol className="flex items-center gap-2 text-[12.5px] font-semibold leading-tight text-muted-foreground" aria-label="Cách bản đồ hoạt động">
                    <HowStep icon={<Video size={17} />}>Bài giảng của thầy cô</HowStep>
                    <Arrow />
                    <HowStep icon={<Sparkles size={17} />} grad>AI tách thành các khái niệm</HowStep>
                    <Arrow />
                    <HowStep icon={<CheckCircle2 size={17} />}>Quiz đúng thì khái niệm sáng lên</HowStep>
                    <Arrow />
                    <HowStep icon={<Target size={17} />} red>Biết mình hiểu tới đâu, không chỉ xem bao lâu</HowStep>
                </ol>
            </div>
            <div className="px-[26px] pb-6 pt-5">
                <div className="mb-1.5 flex items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        {lessons.map((l, i) => (
                            <button
                                key={l.id}
                                type="button"
                                aria-pressed={i === idx}
                                onClick={() => setPickIdx({ course: course.course.id, idx: i })}
                                className={`flex items-center gap-2 rounded-full border bg-card py-[7px] pl-2 pr-3.5 text-[13.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${i === idx ? 'border-strong text-strong ring-[3px] ring-ink/5' : 'border-border text-muted-foreground hover:border-brand-300'}`}
                            >
                                <i className={`grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[10px] font-bold not-italic ${doneAll(l.id) ? 'bg-brand-600 text-ink-foreground' : i === idx ? 'bg-ink text-ink-foreground' : 'bg-muted text-muted-foreground'}`}>{doneAll(l.id) ? <Check size={12} strokeWidth={3} /> : i + 1}</i>
                                Chặng {String(i + 1).padStart(2, '0')} · {shortName(l.title)}
                            </button>
                        ))}
                    </div>
                    <p className="flex shrink-0 items-center gap-2 text-[12.5px] font-semibold text-muted-foreground" aria-hidden>
                        <i className="h-3 w-3 rounded-full bg-brand-600" /> Vững
                        <i className="ml-2 h-3.5 w-3.5 rounded-full border-[3px] border-brand-600" /> Đang học
                        <i className="ml-2 h-3 w-3 rounded-full bg-muted-foreground/30" /> Chưa mở
                    </p>
                </div>
                {lesson && <SkillMap key={`${lesson.id}`} nodes={lessonNodes} lessonId={lesson.id} />}
                <p className="mt-1 text-center text-[13px] text-muted-foreground">
                    Trả lời đúng quiz → khái niệm sáng dần · đủ <b className="text-strong">{Math.round(UNLOCK_THRESHOLD * 100)}%</b> → mở trạm kế tiếp
                </p>
            </div>
        </div>
    )
}

function HowStep({ icon, grad, red, children }: { icon: ReactNode; grad?: boolean; red?: boolean; children: ReactNode }) {
    return (
        <li className="flex max-w-[150px] items-center gap-2">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] ${grad ? 'text-ink-foreground' : red ? 'bg-brand-50 text-brand-ink' : 'bg-muted text-strong'}`} style={grad ? { background: 'linear-gradient(135deg, var(--mm-blue), var(--mm-teal))' } : undefined}>
                {icon}
            </span>
            <span className={red ? 'font-extrabold text-strong' : ''}>{children}</span>
        </li>
    )
}
const Arrow = () => <span aria-hidden className="text-muted-foreground/60">→</span>

/** Tên học phần là nút chọn (dropdown) – đổi học phần thì bản đồ đổi. */
function CourseMenu({ list, current, onPick }: { list: CourseSummary[]; current: CourseSummary; onPick: (id: string) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!open) return
        const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('mousedown', away)
        document.addEventListener('keydown', esc)
        return () => {
            document.removeEventListener('mousedown', away)
            document.removeEventListener('keydown', esc)
        }
    }, [open])
    return (
        <div ref={ref} className="relative">
            <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-0.5 flex items-center gap-1.5 rounded-lg text-left text-xl font-black tracking-tight text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                {current.course.title}
                <ChevronDown size={18} className={`transition-transform duration-base ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul role="listbox" aria-label="Chọn học phần" className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[280px] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-raised">
                    {list.map((c) => (
                        <li key={c.course.id} role="option" aria-selected={c.course.id === current.course.id}>
                            <button type="button" onClick={() => { onPick(c.course.id); setOpen(false) }} className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm font-bold hover:bg-muted ${c.course.id === current.course.id ? 'text-brand-ink' : 'text-strong'}`}>
                                {c.course.title}
                                <span className="font-mono text-xs text-muted-foreground">{c.pct}%</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

// ─── Panel: Huy hiệu ───────────────────────────────────────────────────────

const BADGE_TONE = ['bg-brand-600', 'bg-mm-blue', 'bg-mm-teal']

function BadgesPanel() {
    const earned = useOrbitStore((s) => s.earnedBadgeIds)
    const conceptMastery = useOrbitStore((s) => s.conceptMastery)
    const quizResults = useOrbitStore((s) => s.quizResults)
    const streak = useOrbitStore((s) => s.streak)
    const directorBest = useOrbitStore((s) => s.directorBest)
    const testRecords = useOrbitStore((s) => s.testRecords)
    const ctx = { conceptMastery, quizResults, streak, directorBest, testBest: bestTestRatio(testRecords) }
    // Huy hiệu ẩn chưa nhận: hiện ô mờ "Huy hiệu ẩn"
    const info = badges.map((b) => ({ b, has: earned.includes(b.id), ...badgeProgress(b, ctx) }))
    return (
        <ul className="grid grid-cols-5 gap-3 p-[26px]">
            {info.map(({ b, has, current, target }, i) => {
                const hidden = b.hidden && !has
                return (
                    <li key={b.id} className={`rounded-2xl bg-muted px-2.5 py-[18px] text-center ${hidden ? 'opacity-50' : ''}`}>
                        <span className={`mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-[13px] text-ink-foreground ${hidden ? 'bg-muted-foreground/60' : BADGE_TONE[i % BADGE_TONE.length]}`}>{hidden ? <Lock size={20} /> : <Award size={22} />}</span>
                        <b className="block text-[13px] leading-tight text-strong">{hidden ? 'Huy hiệu ẩn' : b.name}</b>
                        <small className="mt-1 block font-mono text-[11.5px] text-muted-foreground">{has ? 'đã nhận' : hidden ? 'chưa mở' : `${current}/${target}`}</small>
                    </li>
                )
            })}
        </ul>
    )
}

// ─── Panel: Xếp hạng lớp (dữ liệu mẫu, ẩn danh) ─────────────────────────────

function RankPanel() {
    const xp = useOrbitStore((s) => s.xp)
    const [all, setAll] = useState(false)
    const rows = [...CLASSMATE_XP.map((v) => ({ me: false, xp: v })), { me: true, xp }].sort((a, b) => b.xp - a.xp || Number(b.me) - Number(a.me)).map((r, i) => ({ ...r, rank: i + 1 }))
    const mine = rows.findIndex((r) => r.me)
    const visible = all ? rows : rows.slice(Math.max(0, mine - 1), mine + 2)
    return (
        <div className="max-w-[640px] p-[26px]">
            <p className="mb-2 flex items-baseline justify-between text-[13.5px] text-muted-foreground">
                Lớp {CLASS_NAME}
                <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="font-bold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    {all ? 'Thu gọn' : 'Xem cả lớp →'}
                </button>
            </p>
            <ul className={all ? 'max-h-[360px] overflow-y-auto' : ''}>
                {visible.map((r) => (
                    <li key={r.rank} className={`grid grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-xl px-4 py-3 text-[14.5px] ${r.me ? 'bg-brand-50' : ''}`}>
                        <span className={`font-mono text-[13px] font-bold ${r.me ? 'text-brand-ink' : 'text-muted-foreground'}`}>#{r.rank}</span>
                        {r.me ? <b className="text-brand-ink">Bạn</b> : <span className="text-foreground">Sinh viên ẩn danh</span>}
                        <span className={`font-mono text-[13px] font-bold ${r.me ? 'text-brand-ink' : 'text-strong'}`}>{r.xp.toLocaleString('vi-VN')}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
