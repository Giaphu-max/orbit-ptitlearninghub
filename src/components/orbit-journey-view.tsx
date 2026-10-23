import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Award, Check, ChevronRight, Flame, Lock, Snowflake, Zap } from 'lucide-react'
import { badges, courses, getLesson } from '@/data'
import {
    badgeProgress,
    bestTestRatio,
    buildSkillTree,
    freezeAvailable,
    levelProgress,
    levelTitle,
    UNLOCK_THRESHOLD,
    visibleStreak,
} from '@/lib/gamification'
import { MissionList } from '@/components/missions'
import { useOrbitStore } from '@/store/useOrbitStore'

/** /journey – cấp độ, chuỗi ngày học, nhiệm vụ hằng ngày, cây kỹ năng và huy hiệu. */
export function OrbitJourneyView() {
    return (
        <div className="w-full">
            <div className="mx-auto flex max-w-5xl flex-col gap-12 px-5 py-8 lg:px-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Hành trình của bạn</p>
                    <h1 className="mt-3 text-headline text-foreground">Điểm thưởng đến từ việc hiểu bài</h1>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                        XP chỉ tính khi bạn trả lời đúng, sửa được lỗi sai hoặc hoàn thành bài. Xem video lâu hay bấm nhiều không làm tăng điểm.
                    </p>
                </header>
                <StatusRow />
                <Missions />
                <FinalTests />
                <SkillTree />
                <Badges />
            </div>
        </div>
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

// ─── Cấp độ + chuỗi ngày ───────────────────────────────────────────────────

function StatusRow() {
    const xp = useOrbitStore((s) => s.xp)
    const streakState = useOrbitStore((s) => s.streak)
    const lp = levelProgress(xp)
    const streak = visibleStreak(streakState)
    const canFreeze = freezeAvailable(streakState)

    return (
        <section aria-label="Cấp độ và chuỗi ngày học" className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="rounded-panel surface-red-deep p-7 shadow-brand">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-eyebrow uppercase text-ink-foreground/80">Cấp độ</p>
                        <p className="mt-2 font-mono text-6xl font-bold leading-none">{lp.level}</p>
                        <p className="mt-2 text-lg font-bold">{levelTitle(lp.level)}</p>
                    </div>
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/15 px-4 py-2 font-mono text-sm font-bold">
                        <Zap size={15} className="fill-current" /> {xp.toLocaleString('vi-VN')} XP
                    </p>
                </div>
                <div className="mt-7">
                    <div
                        className="h-3 overflow-hidden rounded-full bg-ink/25"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={lp.span}
                        aria-valuenow={lp.into}
                        aria-label={`Tiến độ lên cấp ${lp.level + 1}`}
                    >
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(lp.ratio * 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full bg-ink-foreground" />
                    </div>
                    <p className="mt-2 flex justify-between font-mono text-xs text-ink-foreground/80">
                        <span>{xp.toLocaleString('vi-VN')} / {(xp + lp.toNext).toLocaleString('vi-VN')} XP</span>
                        <span>Còn {lp.toNext.toLocaleString('vi-VN')} XP lên Cấp {lp.level + 1} · {levelTitle(lp.level + 1)}</span>
                    </p>
                </div>
            </div>

            <div className="flex flex-col justify-between rounded-panel border border-border bg-card p-7 shadow-card">
                <div className="flex items-center gap-4">
                    <span className={`flex h-16 w-16 items-center justify-center rounded-full ${streak.count > 0 ? 'bg-brand-soft text-brand-ink' : 'bg-muted text-muted-foreground'}`}>
                        <Flame size={32} className={streak.count > 0 ? 'fill-current' : ''} />
                    </span>
                    <div>
                        <p className="font-mono text-4xl font-bold leading-none text-foreground">{streak.count}</p>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">ngày liên tiếp</p>
                    </div>
                </div>
                <p className="mt-5 text-sm text-muted-foreground">
                    {streak.studiedToday
                        ? 'Hôm nay bạn đã học, chuỗi được giữ.'
                        : streak.count > 0
                          ? 'Trả lời một câu quiz hôm nay để giữ chuỗi.'
                          : 'Trả lời một câu quiz để bắt đầu chuỗi mới.'}
                </p>
                <p className={`mt-3 inline-flex items-center gap-2 text-xs font-semibold ${canFreeze ? 'text-info' : 'text-muted-foreground'}`}>
                    <Snowflake size={14} />
                    {canFreeze ? 'Còn 1 lần đóng băng tuần này, tự dùng khi bạn lỡ một ngày' : 'Đã dùng lần đóng băng của tuần này'}
                </p>
            </div>
        </section>
    )
}

// ─── Nhiệm vụ hằng ngày ────────────────────────────────────────────────────

function Missions() {
    return (
        <section aria-labelledby="missions-title">
            <div className="flex items-end justify-between gap-3">
                <h2 id="missions-title" className="text-title text-foreground">Nhiệm vụ hôm nay</h2>
                <p className="text-sm text-muted-foreground">Làm mới mỗi ngày</p>
            </div>
            <MissionList />
        </section>
    )
}

// ─── Cây kỹ năng ───────────────────────────────────────────────────────────

function SkillTree() {
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const nodes = buildSkillTree(mastery)
    const lessonIds = [...new Set(nodes.map((n) => n.lessonId))]

    return (
        <section aria-labelledby="skills-title">
            <h2 id="skills-title" className="text-title text-foreground">Cây kỹ năng</h2>
            <p className="mt-2 text-sm text-muted-foreground">
                Khái niệm sáng dần theo mức nắm vững. Khái niệm nâng cao mở khi khái niệm nền đạt {Math.round(UNLOCK_THRESHOLD * 100)}%.
            </p>
            <div className="mt-5 flex flex-col gap-5">
                {lessonIds.map((lid) => {
                    const lessonNodes = nodes.filter((n) => n.lessonId === lid)
                    const maxDepth = Math.max(...lessonNodes.map((n) => n.depth))
                    return (
                        <div key={lid} className="overflow-x-auto rounded-panel border border-border bg-card p-6 shadow-card">
                            <p className="mb-5 text-sm font-bold text-muted-foreground">{getLesson(lid)?.title}</p>
                            <div className="flex items-stretch gap-2">
                                {Array.from({ length: maxDepth + 1 }, (_, d) => (
                                    <Fragment key={d}>
                                        {d > 0 && <ChevronRight className="mt-9 shrink-0 self-start text-muted-foreground" size={28} aria-hidden />}
                                        <div className="flex min-w-[200px] flex-1 flex-col gap-4">
                                            {lessonNodes.filter((n) => n.depth === d).map((n) => (
                                                <SkillNodeCard key={n.concept.id} node={n} />
                                            ))}
                                        </div>
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

function SkillNodeCard({ node }: { node: ReturnType<typeof buildSkillTree>[number] }) {
    const pct = Math.round(node.mastery * 100)
    const mastered = node.mastery >= UNLOCK_THRESHOLD
    return (
        <Link
            to={node.unlocked ? `/lesson/${node.lessonId}` : '#'}
            aria-disabled={!node.unlocked}
            onClick={(e) => !node.unlocked && e.preventDefault()}
            className={`flex items-center gap-4 rounded-card border p-4 transition duration-base ease-out ${
                node.unlocked ? 'border-border bg-card hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card' : 'cursor-not-allowed border-dashed border-border bg-muted/60'
            }`}
        >
            <span
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{ background: node.unlocked ? `conic-gradient(hsl(var(--brand)) ${pct * 3.6}deg, hsl(var(--muted)) 0)` : 'hsl(var(--muted))' }}
            >
                <span className={`flex h-[46px] w-[46px] items-center justify-center rounded-full font-mono text-sm font-bold ${mastered ? 'bg-brand-600 text-ink-foreground shadow-brand' : 'bg-card text-foreground'}`}>
                    {node.unlocked ? (mastered ? <Check size={20} /> : `${pct}%`) : <Lock size={16} className="text-muted-foreground" />}
                </span>
            </span>
            <span className="min-w-0">
                <span className={`block font-bold leading-snug ${node.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{node.concept.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                    {node.unlocked
                        ? mastered
                            ? 'Đã nắm vững'
                            : node.mastery > 0
                              ? 'Đang nắm'
                              : 'Chưa học'
                        : `Cần nắm ${node.missing.map((c) => c.name).join(', ')} trước`}
                </span>
            </span>
        </Link>
    )
}

// ─── Huy hiệu ──────────────────────────────────────────────────────────────

function Badges() {
    const earned = useOrbitStore((s) => s.earnedBadgeIds)
    const conceptMastery = useOrbitStore((s) => s.conceptMastery)
    const quizResults = useOrbitStore((s) => s.quizResults)
    const streak = useOrbitStore((s) => s.streak)
    const directorBest = useOrbitStore((s) => s.directorBest)
    const testRecords = useOrbitStore((s) => s.testRecords)

    // Huy hiệu ẩn chỉ xuất hiện sau khi đã nhận
    const shown = badges.filter((b) => !b.hidden || earned.includes(b.id))

    return (
        <section aria-labelledby="badges-title">
            <div className="flex items-end justify-between gap-3">
                <h2 id="badges-title" className="text-title text-foreground">Huy hiệu</h2>
                <p className="font-mono text-sm text-muted-foreground">{earned.filter((id) => shown.some((b) => b.id === id)).length}/{shown.length}</p>
            </div>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((b) => {
                    const has = earned.includes(b.id)
                    const { current, target } = badgeProgress(b, { conceptMastery, quizResults, streak, directorBest, testBest: bestTestRatio(testRecords) })
                    return (
                        <li key={b.id} className={`flex flex-col gap-4 rounded-card border p-5 ${has ? 'border-brand-200 bg-card shadow-card' : 'border-border bg-muted/50'}`}>
                            <span className={`flex h-14 w-14 items-center justify-center rounded-full ${has ? 'bg-brand-600 text-ink-foreground shadow-brand' : 'bg-card text-muted-foreground'}`}>
                                {has ? <Award size={28} /> : <Lock size={22} />}
                            </span>
                            <div>
                                <p className={`font-bold ${has ? 'text-foreground' : 'text-muted-foreground'}`}>{b.name}</p>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.description}</p>
                            </div>
                            <div className="mt-auto">
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div className={`h-full rounded-full ${has ? 'bg-brand-600' : 'bg-muted-foreground/50'}`} style={{ width: `${(has ? 1 : current / target) * 100}%` }} />
                                </div>
                                <p className="mt-1.5 font-mono text-xs text-muted-foreground">{has ? 'Đã đạt' : `${current}/${target}`}</p>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
