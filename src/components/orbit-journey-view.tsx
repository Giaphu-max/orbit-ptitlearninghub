import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Award, Check, ChevronDown, ChevronRight, Flame, Lock } from 'lucide-react'
import { badges, courses, getLesson } from '@/data'
import { CLASS_NAME, CLASSMATE_XP } from '@/data/leaderboard'
import {
    badgeProgress,
    bestTestRatio,
    buildSkillTree,
    freezeAvailable,
    levelProgress,
    levelTitle,
    UNLOCK_THRESHOLD,
    visibleStreak,
    type SkillNode,
} from '@/lib/gamification'
import { primaryCourse, STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'
import { NextMission } from '@/components/missions'
import { useOrbitStore, xpBalance } from '@/store/useOrbitStore'

/** Mỗi câu đúng nâng mức nắm vững khoảng chừng này (ước lượng cho dòng "Còn N câu đúng nữa"). */
const MASTERY_PER_CORRECT = 0.15

/** /journey – dải trạng thái (tầng 2), khái niệm nên ôn tiếp (tầng 1), cây kỹ năng, và cột phải: việc nên làm, huy hiệu, bảng xếp hạng lớp. */
export function OrbitJourneyView() {
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const nodes = buildSkillTree(mastery)
    const focus = pickFocus(nodes)
    return (
        <div className="w-full">
            <div className="container-wide flex flex-col gap-7 py-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Tiến độ & Kỹ năng</p>
                    <h1 className="mt-3 text-headline text-foreground">Điểm thưởng đến từ việc hiểu bài</h1>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                        XP chỉ tính khi bạn trả lời đúng, sửa được lỗi sai hoặc hoàn thành bài. Xem video lâu hay bấm nhiều không làm tăng điểm.
                    </p>
                </header>
                <StatusBand nodes={nodes} />
                <div className="page-grid items-start gap-y-8">
                    <div className="col-span-7 flex flex-col gap-[18px]">
                        {focus && <FocusCard node={focus} nodes={nodes} />}
                        <SkillTree nodes={nodes} focusId={focus?.concept.id} />
                    </div>
                    <aside className="col-span-5 flex flex-col gap-[22px] lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
                        <section aria-labelledby="next-title">
                            <Label id="next-title">Việc nên làm tiếp</Label>
                            <NextMission />
                        </section>
                        <BadgesCard />
                        <Leaderboard />
                    </aside>
                </div>
                <FinalTests />
            </div>
        </div>
    )
}

/** Nhãn khối: tiêu đề 15px/800 navy, số mono muted, link đỏ bên phải. */
function Label({ id, count, action, children }: { id?: string; count?: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="mb-3 flex items-baseline justify-between">
            <h2 id={id} className="text-[15px] font-extrabold tracking-tight text-strong">
                {children}
                {count && <em className="ml-1.5 font-mono text-[13px] font-bold not-italic text-muted-foreground">{count}</em>}
            </h2>
            {action}
        </div>
    )
}

const linkBtn = 'text-[13.5px] font-bold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'

// ─── Dải trạng thái (tầng 2): cấp độ | chuỗi ngày | khái niệm vững + huy hiệu ─────────

function StatusBand({ nodes }: { nodes: SkillNode[] }) {
    const xp = useOrbitStore((s) => s.xp)
    const balance = useOrbitStore((s) => xpBalance(s))
    const streakState = useOrbitStore((s) => s.streak)
    const earned = useOrbitStore((s) => s.earnedBadgeIds)
    const lp = levelProgress(xp)
    const streak = visibleStreak(streakState)
    const canFreeze = freezeAvailable(streakState)
    const strong = nodes.filter((n) => n.mastery >= UNLOCK_THRESHOLD).length
    const shown = badges.filter((b) => !b.hidden || earned.includes(b.id))
    const gotBadges = shown.filter((b) => earned.includes(b.id)).length
    const RING = 169.6

    return (
        <section aria-label="Trạng thái" className="grid grid-cols-[1.4fr_auto_1fr_auto_0.9fr] items-center gap-7 rounded-card border border-border bg-card px-7 py-[22px] shadow-card">
            <div className="flex items-center gap-[18px]">
                <span className="relative h-16 w-16 shrink-0" role="img" aria-label={`Cấp ${lp.level}`}>
                    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90" aria-hidden>
                        <defs>
                            <linearGradient id="lv-grad" x1="0" x2="1" y1="0" y2="1">
                                <stop offset="0" style={{ stopColor: 'var(--mm-blue)' }} />
                                <stop offset="1" style={{ stopColor: 'var(--mm-teal)' }} />
                            </linearGradient>
                        </defs>
                        <circle cx="32" cy="32" r="27" fill="none" strokeWidth="6" className="stroke-muted" />
                        <motion.circle
                            cx="32"
                            cy="32"
                            r="27"
                            fill="none"
                            stroke="url(#lv-grad)"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={RING}
                            initial={{ strokeDashoffset: RING }}
                            animate={{ strokeDashoffset: RING * (1 - lp.ratio) }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                    </svg>
                    <b className="absolute inset-0 grid place-items-center font-mono text-[22px] font-extrabold text-strong">{lp.level}</b>
                </span>
                <span className="min-w-0 flex-1">
                    <b className="block text-[17px] font-extrabold text-strong">
                        Cấp {lp.level} · {levelTitle(lp.level)}
                    </b>
                    <span
                        className="relative my-2.5 block h-[7px] overflow-hidden rounded bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={lp.span}
                        aria-valuenow={lp.into}
                        aria-label={`Tiến độ lên cấp ${lp.level + 1}`}
                    >
                        <motion.i
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round(lp.ratio * 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="absolute inset-y-0 left-0 rounded"
                            style={{ background: 'linear-gradient(90deg, var(--mm-blue), var(--mm-teal))' }}
                        />
                    </span>
                    <small className="font-mono text-[12.5px] text-muted-foreground">
                        <span tabIndex={0} className="group/tip relative cursor-help border-b border-dashed border-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                            {xp.toLocaleString('vi-VN')} / {(xp + lp.toNext).toLocaleString('vi-VN')} XP
                            <span role="tooltip" className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-[7px] font-sans text-xs font-semibold text-ink-foreground opacity-0 transition duration-base group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100">
                                Tổng đã kiếm {xp.toLocaleString('vi-VN')} XP · còn tiêu được {balance.toLocaleString('vi-VN')} XP
                            </span>
                        </span>{' '}
                        · còn {lp.toNext.toLocaleString('vi-VN')} XP lên Cấp {lp.level + 1} “{levelTitle(lp.level + 1)}”
                    </small>
                </span>
            </div>
            <span aria-hidden className="h-14 w-px bg-border" />
            <div className="flex items-center gap-3.5">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[14px] ${streak.count > 0 ? 'bg-brand-50 text-brand-ink' : 'bg-muted text-muted-foreground'}`}>
                    <Flame size={24} className={streak.count > 0 ? 'fill-current' : ''} />
                </span>
                <span>
                    <b className="block font-mono text-[22px] font-extrabold text-strong">{streak.count} ngày</b>
                    <small className="text-[13px] text-muted-foreground">chuỗi học · {canFreeze ? 'còn 1 lần đóng băng tuần này' : 'đã dùng lần đóng băng tuần này'}</small>
                </span>
            </div>
            <span aria-hidden className="h-14 w-px bg-border" />
            <div className="flex items-center gap-[18px]">
                <span>
                    <small className="block text-[13px] text-muted-foreground">Khái niệm vững</small>
                    <b className="font-mono text-lg font-extrabold text-strong">
                        {strong}/{nodes.length}
                    </b>
                </span>
                <span>
                    <small className="block text-[13px] text-muted-foreground">Huy hiệu</small>
                    <b className="font-mono text-lg font-extrabold text-strong">
                        {gotBadges}/{shown.length}
                    </b>
                </span>
            </div>
        </section>
    )
}

// ─── Nên ôn tiếp (tầng 1) ──────────────────────────────────────────────────

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
    const C = 219.9
    return (
        <Link
            to={`/lesson/${node.lessonId}?t=${Math.floor(node.concept.segment.start)}`}
            className="tier-1-bob surface-red grid grid-cols-[auto_1fr_auto] items-center gap-[22px] rounded-[22px] px-[26px] py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
            <span className="relative h-[84px] w-[84px]" role="img" aria-label={`Nắm vững ${pct}%`}>
                <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90" aria-hidden>
                    <circle cx="42" cy="42" r="35" fill="none" strokeWidth="8" style={{ stroke: 'hsl(var(--ink-foreground) / 0.25)' }} />
                    <circle cx="42" cy="42" r="35" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - node.mastery)} style={{ stroke: 'hsl(var(--ink-foreground))' }} />
                </svg>
                <b className="absolute inset-0 grid place-items-center font-mono text-xl font-extrabold">{pct}%</b>
            </span>
            <span>
                <small className="text-xs font-bold uppercase tracking-[0.12em] text-ink-foreground/85">Nên ôn tiếp</small>
                <h3 className="mt-1.5 text-2xl font-black leading-tight tracking-[-0.02em]">{node.concept.name}</h3>
                {!reached && (
                    <p className="mt-2 text-[14.5px] leading-normal text-ink-foreground/90">
                        {after ? <>Đạt {Math.round(UNLOCK_THRESHOLD * 100)}% để mở “{after.concept.name}”. </> : <>Đạt {Math.round(UNLOCK_THRESHOLD * 100)}% để nắm vững. </>}Còn {left} câu đúng nữa.
                    </p>
                )}
            </span>
            <span className="inline-flex items-center gap-2 rounded-[14px] bg-ink-foreground px-[22px] py-3.5 text-base font-extrabold text-brand-ink">Ôn khái niệm này →</span>
        </Link>
    )
}

// ─── Cây kỹ năng ───────────────────────────────────────────────────────────

function SkillTree({ nodes, focusId }: { nodes: SkillNode[]; focusId?: string }) {
    const summaries = useCourseSummaries()
    const list = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    const main = primaryCourse(list)
    const strong = nodes.filter((n) => n.mastery >= UNLOCK_THRESHOLD).length

    // Chặng (bài) của khóa đang học: 2 chặng đầu hiện sẵn, còn lại thu vào <details>
    const mainLessons = main?.lessons ?? []
    const shownLessons = mainLessons.slice(0, 2)
    const hiddenGroups: { course: CourseSummary['course']; lessonIds: string[]; chang: number[] }[] = []
    if (main && mainLessons.length > 2) hiddenGroups.push({ course: main.course, lessonIds: mainLessons.slice(2).map((l) => l.id), chang: mainLessons.slice(2).map((_, i) => i + 3) })
    for (const c of list) if (c !== main) hiddenGroups.push({ course: c.course, lessonIds: c.lessons.map((l) => l.id), chang: [] })
    const hiddenCount = hiddenGroups.reduce((n, g) => n + nodes.filter((x) => g.lessonIds.includes(x.lessonId)).length, 0)
    const hiddenLabel = hiddenGroups.map((g) => (g.chang.length ? `chặng ${g.chang.map((n) => String(n).padStart(2, '0')).join(', ')}` : `học phần ${g.course.subject}`)).join(' và ')

    return (
        <section aria-labelledby="skills-title">
            <Label id="skills-title" count={`${strong}/${nodes.length} vững`}>
                Cây kỹ năng
            </Label>
            <div className="rounded-card border border-border bg-card shadow-card">
                <div className="px-6 py-[22px]">
                    {shownLessons.map((l, i) => (
                        <LessonChain key={l.id} lessonId={l.id} index={i} nodes={nodes} focusId={focusId} />
                    ))}
                    {shownLessons.length === 0 && <p className="text-sm text-muted-foreground">Chưa có khái niệm nào.</p>}
                </div>
                {hiddenGroups.length > 0 && (
                    <details className="group border-t border-border">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-3.5 text-[13.5px] font-bold text-muted-foreground [&::-webkit-details-marker]:hidden">
                            Xem {hiddenLabel} ({hiddenCount} khái niệm)
                            <ChevronDown size={14} className="transition-transform duration-base group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="border-t border-border px-6 py-[22px]">
                            {hiddenGroups.map((g) => (
                                <div key={g.course.id} className="[&+&]:mt-5">
                                    {g.lessonIds.map((lid, i) => (
                                        <LessonChain key={lid} lessonId={lid} index={g.chang.length ? g.chang[i] - 1 : i} course={g.chang.length ? undefined : g.course.subject} nodes={nodes} focusId={focusId} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
        </section>
    )
}

/** Một chặng: tiêu đề nhỏ muted + chuỗi viên ngang nối bằng mũi tên. */
function LessonChain({ lessonId, index, course, nodes, focusId }: { lessonId: string; index: number; course?: string; nodes: SkillNode[]; focusId?: string }) {
    const chain = nodes.filter((n) => n.lessonId === lessonId).sort((a, b) => a.depth - b.depth)
    if (chain.length === 0) return null
    return (
        <div className="[&+&]:mt-5 [&+&]:border-t [&+&]:border-border [&+&]:pt-5">
            <h4 className="mb-3 text-[13.5px] font-bold text-muted-foreground">
                {course ? `${course} · ` : ''}Chặng {String(index + 1).padStart(2, '0')} · {getLesson(lessonId)?.title}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
                {chain.map((n, i) => (
                    <Fragment key={n.concept.id}>
                        {i > 0 && <ChevronRight size={14} className="text-muted-foreground/60" aria-hidden />}
                        <SkillPill node={n} current={n.concept.id === focusId} />
                    </Fragment>
                ))}
            </div>
        </div>
    )
}

/** Viên ngang: vòng % nhỏ 26px + tên một dòng. Vững: nền đỏ-50, vòng đặc có tích. Đang ôn tiếp: viền đỏ 2px + quầng. Chưa mở: nền muted, khóa. */
function SkillPill({ node, current }: { node: SkillNode; current: boolean }) {
    const pct = Math.round(node.mastery * 100)
    const mastered = node.mastery >= UNLOCK_THRESHOLD
    const locked = !node.unlocked
    const tone = locked
        ? 'border-transparent bg-muted text-muted-foreground/70'
        : mastered
          ? 'border-brand-200 bg-brand-50 text-strong'
          : current
            ? 'border-2 border-brand-600 bg-card text-strong shadow-[0_0_0_4px_hsl(var(--brand)/0.12)]'
            : 'border-border bg-card text-strong'
    const ring = (
        <span
            className={`relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${mastered ? 'bg-brand-600 text-ink-foreground' : ''}`}
            style={!mastered && !locked ? { background: `conic-gradient(hsl(var(--brand)) ${pct * 3.6}deg, hsl(var(--muted)) 0)` } : undefined}
        >
            {!mastered && !locked && <span aria-hidden className="absolute inset-1 rounded-full bg-card" />}
            <span className="relative z-[1]">{locked ? <Lock size={12} /> : mastered ? <Check size={13} strokeWidth={3} /> : pct}</span>
        </span>
    )
    const cls = `inline-flex items-center gap-[9px] whitespace-nowrap rounded-full border py-2 pl-2 pr-3.5 text-sm font-semibold ${tone}`
    return locked ? (
        <span className={cls} title={`Cần mở ${node.missing.map((c) => c.name).join(', ')} (≥${Math.round(UNLOCK_THRESHOLD * 100)}%)`}>
            {ring}
            {node.concept.name}
        </span>
    ) : (
        <Link to={`/lesson/${node.lessonId}?t=${Math.floor(node.concept.segment.start)}`} className={`${cls} transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70`}>
            {ring}
            {node.concept.name}
        </Link>
    )
}

// ─── Huy hiệu ──────────────────────────────────────────────────────────────

function BadgesCard() {
    const earned = useOrbitStore((s) => s.earnedBadgeIds)
    const conceptMastery = useOrbitStore((s) => s.conceptMastery)
    const quizResults = useOrbitStore((s) => s.quizResults)
    const streak = useOrbitStore((s) => s.streak)
    const directorBest = useOrbitStore((s) => s.directorBest)
    const testRecords = useOrbitStore((s) => s.testRecords)
    const [all, setAll] = useState(false)

    // Huy hiệu ẩn chỉ xuất hiện sau khi đã nhận
    const shown = badges.filter((b) => !b.hidden || earned.includes(b.id))
    const ctx = { conceptMastery, quizResults, streak, directorBest, testBest: bestTestRatio(testRecords) }
    const info = shown.map((b) => ({ b, has: earned.includes(b.id), ...badgeProgress(b, ctx) }))
    // 3 huy hiệu: mới nhận gần nhất, rồi các huy hiệu gần đạt nhất
    const latest = [...info].filter((i) => i.has).sort((a, b) => earned.indexOf(b.b.id) - earned.indexOf(a.b.id))[0]
    const near = info.filter((i) => !i.has).sort((a, b) => b.current / b.target - a.current / a.target)
    const top = [...(latest ? [latest] : []), ...near, ...info.filter((i) => i.has && i !== latest)].slice(0, 3)

    return (
        <section aria-labelledby="badges-title">
            <Label
                id="badges-title"
                action={
                    <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className={linkBtn}>
                        {all ? 'Thu gọn' : `Xem tất cả ${shown.length} →`}
                    </button>
                }
            >
                Huy hiệu
            </Label>
            <div className="rounded-card border border-border bg-card p-4 shadow-card">
                <ul className="grid grid-cols-3 gap-2.5">
                    {top.map(({ b, has, current, target }) => (
                        <li key={b.id} className="rounded-[14px] bg-muted px-2 py-3.5 text-center">
                            <span className={`mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl text-ink-foreground ${has ? 'bg-brand-600' : 'bg-mm-blue'}`}>
                                <Award size={20} />
                            </span>
                            <b className="block text-[12.5px] leading-tight text-strong">{b.name}</b>
                            <small className="mt-1 block font-mono text-[11px] text-muted-foreground">{has ? (b === latest?.b ? 'mới nhận' : 'đã đạt') : `${current}/${target}`}</small>
                        </li>
                    ))}
                </ul>
                {all && (
                    <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                        {info.map(({ b, has, current, target }) => (
                            <li key={b.id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${has ? 'bg-brand-50' : ''}`}>
                                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${has ? 'bg-brand-600 text-ink-foreground' : 'bg-muted text-muted-foreground'}`}>{has ? <Award size={16} /> : <Lock size={14} />}</span>
                                <span className="min-w-0 flex-1">
                                    <b className="block text-sm text-strong">{b.name}</b>
                                    <span className="block text-[13px] leading-snug text-muted-foreground">{b.description}</span>
                                </span>
                                <span className="shrink-0 font-mono text-xs text-muted-foreground">{has ? 'Đã đạt' : `${current}/${target}`}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}

// ─── Bảng xếp hạng lớp (dữ liệu mẫu, ẩn danh) ──────────────────────────────

function Leaderboard() {
    const xp = useOrbitStore((s) => s.xp)
    const [all, setAll] = useState(false)
    const rows = [...CLASSMATE_XP.map((v) => ({ me: false, xp: v })), { me: true, xp }].sort((a, b) => b.xp - a.xp || Number(b.me) - Number(a.me))
    const mine = rows.findIndex((r) => r.me)
    const visible = all ? rows.map((r, i) => ({ ...r, rank: i + 1 })) : rows.map((r, i) => ({ ...r, rank: i + 1 })).slice(Math.max(0, mine - 1), mine + 2)
    return (
        <section aria-labelledby="lb-title">
            <Label
                id="lb-title"
                action={
                    <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className={linkBtn}>
                        {all ? 'Thu gọn' : 'Xem cả lớp →'}
                    </button>
                }
            >
                Bảng xếp hạng lớp {CLASS_NAME}
            </Label>
            <ul className={`overflow-y-auto rounded-card border border-border bg-card py-1.5 shadow-card ${all ? 'max-h-[360px]' : ''}`}>
                {visible.map((r) => (
                    <li key={r.rank} className={`grid grid-cols-[34px_1fr_auto] items-center gap-2.5 px-[22px] py-2.5 text-sm ${r.me ? 'bg-brand-50' : ''}`}>
                        <span className={`font-mono text-[13px] font-bold ${r.me ? 'text-brand-ink' : 'text-muted-foreground'}`}>#{r.rank}</span>
                        {r.me ? <b className="text-brand-ink">Bạn</b> : <span className="text-foreground">Sinh viên ẩn danh</span>}
                        <span className={`font-mono text-[13px] font-bold ${r.me ? 'text-brand-ink' : 'text-strong'}`}>{r.xp.toLocaleString('vi-VN')}</span>
                    </li>
                ))}
            </ul>
        </section>
    )
}

// ─── Test cuối chương ──────────────────────────────────────────────────────

function FinalTests() {
    const records = useOrbitStore((s) => s.testRecords)
    return (
        <section aria-labelledby="tests-title">
            <h2 id="tests-title" className="text-title text-foreground">Test cuối chương</h2>
            <p className="mt-2 text-sm text-muted-foreground">Kiểm tra cả khóa, biết khái niệm nào còn hổng và nhận lộ trình ôn tập.</p>
            <ul className="mt-5 flex flex-col gap-3">
                {courses.map((c) => {
                    const r = records[c.id]
                    return (
                        <li key={c.id}>
                            <Link to={`/test/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-5 shadow-card transition hover:border-brand-300">
                                <span>
                                    <span className="block font-bold text-foreground">{c.title}</span>
                                    <span className="mt-1 block text-sm text-muted-foreground">
                                        {r ? `Tốt nhất ${r.bestCorrect}/${r.bestTotal} · ${r.attempts} lượt làm` : 'Chưa làm lần nào'}
                                    </span>
                                </span>
                                <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-ink">
                                    {r ? 'Làm lại hoặc xem kết quả' : 'Làm test'} <ChevronRight size={16} />
                                </span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

