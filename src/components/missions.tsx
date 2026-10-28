import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Clapperboard, ClipboardCheck, RotateCcw, type LucideIcon } from 'lucide-react'
import { celebrate } from '@/lib/feedback'
import { announceRewards, dailyFor, MISSIONS, type Mission } from '@/lib/gamification'
import { missionTarget, resumeLesson } from '@/lib/next-step'
import { useOrbitStore } from '@/store/useOrbitStore'

/** Gạch ngang chạy từ trái sang phải khi nhiệm vụ chuyển sang trạng thái xong (chỉ transform). */
function Strike({ on, children }: { on: boolean; children: ReactNode }) {
    return (
        <span className="relative inline-block max-w-full">
            {children}
            <span
                aria-hidden
                className="absolute inset-x-0 top-1/2 h-0.5 origin-left rounded-full bg-muted-foreground transition-transform duration-slow ease-out"
                style={{ transform: `scaleX(${on ? 1 : 0})` }}
            />
        </span>
    )
}

/** Nhận thưởng một nhiệm vụ: chip XP bay vào nav; nhận đủ cả bộ thì mở màn thưởng đỏ "Xong nhiệm vụ hôm nay". */
function useClaim() {
    const claimMission = useOrbitStore((s) => s.claimMission)
    return (m: Mission, anchor: HTMLElement) => {
        const before = useOrbitStore.getState()
        if (claimMission(m.id) === 0) return
        celebrate({ anchor, kind: 'correct', xp: m.rewardXp })
        const after = useOrbitStore.getState()
        const resume = resumeLesson()
        const next = { label: 'Học tiếp', to: resume ? `/lesson/${resume.id}` : '/learning' }
        const claimed = dailyFor(after.daily).claimed
        if (MISSIONS.every((x) => claimed.includes(x.id))) {
            // Màn thưởng tổng: XP của cả bộ nhiệm vụ hôm nay
            const total = MISSIONS.reduce((sum, x) => sum + x.rewardXp, 0)
            announceRewards(
                { ...before, xp: after.xp - total },
                after,
                {
                    context: 'Nhiệm vụ hôm nay',
                    headline: 'Xong nhiệm vụ hôm nay.',
                    rows: MISSIONS.map((x) => ({ label: x.title, xp: x.rewardXp })),
                    next,
                },
                { source: 'mission', afterAnswer: true, next },
            )
        } else {
            announceRewards(before, after, undefined, { source: 'mission', afterAnswer: true, next })
        }
    }
}

function useMissionState() {
    const dailyRaw = useOrbitStore((s) => s.daily)
    // Đọc lại khi tiến độ bài/Daily đổi để đích "Làm →" luôn đúng
    useOrbitStore((s) => s.lessonProgress)
    useOrbitStore((s) => s.dailyRead)
    const daily = dailyFor(dailyRaw)
    const state = (m: Mission) => {
        const value = Math.min(m.target, m.progress(daily))
        return { value, done: value >= m.target, claimed: daily.claimed.includes(m.id) }
    }
    return { state }
}

/** Một dòng nhiệm vụ gọn (tầng 2): vòng trạng thái | tên | "+XP" (đã nhận, gạch ngang) hoặc link chữ. Không có nút viền/nút đặc. */
function MissionRow({ m, muted = false }: { m: Mission; muted?: boolean }) {
    const { state } = useMissionState()
    const claim = useClaim()
    const { done, claimed } = state(m)
    return (
        <li className="flex items-center gap-3 border-t border-border px-6 py-3 first:border-t-0">
            <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 ${claimed ? 'border-success bg-success text-ink-foreground' : 'border-border'}`}>
                {claimed && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={`min-w-0 flex-1 text-[14.5px] ${claimed || muted ? 'font-medium text-muted-foreground' : 'font-semibold text-strong'}`}>
                <Strike on={claimed}>{m.title}</Strike>
            </span>
            {claimed ? (
                <span className="shrink-0 whitespace-nowrap font-mono text-[12.5px] font-bold text-muted-foreground">+{m.rewardXp}</span>
            ) : done ? (
                <button type="button" onClick={(e) => claim(m, e.currentTarget)} className="shrink-0 whitespace-nowrap text-[13.5px] font-extrabold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    Nhận +{m.rewardXp} →
                </button>
            ) : (
                <Link to={missionTarget(m.id)} className="shrink-0 whitespace-nowrap text-[13.5px] font-extrabold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    Làm →
                </Link>
            )}
        </li>
    )
}

/** /today (phần dưới thẻ "Hôm nay của bạn"): đủ mọi nhiệm vụ, chia hai nhóm "Nhiệm vụ ôn tập" (ids) và "Việc khác hôm nay", giãn đều theo chiều cao thẻ. */
export function TodayMissionsList({ reviewIds }: { reviewIds: string[] }) {
    const { state } = useMissionState()
    const main = MISSIONS.filter((m) => reviewIds.includes(m.id))
    const rest = MISSIONS.filter((m) => !reviewIds.includes(m.id))
    const group = (label: string, list: Mission[], muted: boolean) =>
        list.length > 0 && (
            <section aria-label={label}>
                <h3 className="flex items-baseline justify-between px-6 pb-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                    <span className="font-mono text-xs normal-case tracking-normal">{list.filter((m) => state(m).claimed).length}/{list.length}</span>
                </h3>
                <ul>
                    {list.map((m) => (
                        <MissionRow key={m.id} m={m} muted={muted} />
                    ))}
                </ul>
            </section>
        )
    return <div className="flex flex-1 flex-col justify-evenly gap-3 py-4">{group('Nhiệm vụ ôn tập', main, false)}{group('Việc khác hôm nay', rest, true)}</div>
}

const MISSION_ICON: Record<string, LucideIcon> = { daily: BookOpen, fix: RotateCcw, finish: Clapperboard, test: ClipboardCheck }

/** /journey bước 2: nhiệm vụ hôm nay dạng lưới 2×2 ô icon. Cả ô là link; ô đầu tiên chưa xong là "nên làm tiếp"; làm xong chưa nhận thì ô là nút nhận thưởng. */
export function MissionTiles() {
    const { state } = useMissionState()
    const claim = useClaim()
    const claimedN = MISSIONS.filter((m) => state(m).claimed).length
    const next = MISSIONS.find((m) => !state(m).claimed)
    return (
        <div className="flex flex-1 flex-col rounded-card border border-border bg-card px-[22px] py-5 shadow-card">
            <p className="flex items-baseline justify-between text-[13.5px] text-muted-foreground">
                <span>Làm mới lúc 00:00</span>
                <b className="font-mono text-[15px] font-extrabold text-strong">{claimedN}/{MISSIONS.length}</b>
            </p>
            <div className="mb-4 mt-2.5 h-1.5 overflow-hidden rounded-[3px] bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={MISSIONS.length} aria-valuenow={claimedN} aria-label="Nhiệm vụ hôm nay đã nhận">
                <div className="h-full rounded-[3px] bg-brand-600 transition-[width] duration-slow" style={{ width: `${(claimedN / MISSIONS.length) * 100}%` }} />
            </div>
            <ul className="grid flex-1 grid-cols-2 gap-2.5">
                {MISSIONS.map((m) => {
                    const { done, claimed } = state(m)
                    const isNext = m === next
                    const Icon = MISSION_ICON[m.id] ?? BookOpen
                    const tone = claimed ? 'bg-success/10 text-muted-foreground' : isNext ? 'bg-brand-50 text-strong ring-2 ring-brand-200' : 'bg-muted text-strong hover:bg-muted/70'
                    const iconTone = claimed ? 'bg-success text-success-foreground' : isNext ? 'bg-brand-600 text-ink-foreground' : 'bg-card text-strong'
                    const meta = claimed ? `+${m.rewardXp} · xong` : done ? `nhận +${m.rewardXp} →` : isNext ? `+${m.rewardXp} · làm ngay →` : `+${m.rewardXp}`
                    const cls = `flex h-full w-full flex-col gap-2 rounded-2xl p-3.5 text-left text-[13.5px] font-bold leading-[1.3] transition duration-base hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${tone}`
                    const inner = (
                        <>
                            <span className={`grid h-9 w-9 place-items-center rounded-[11px] ${iconTone}`}>{claimed ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}</span>
                            {m.title}
                            <em className={`mt-auto font-mono text-xs font-semibold not-italic ${claimed ? 'text-success' : isNext ? 'text-brand-ink' : 'text-muted-foreground'}`}>{meta}</em>
                        </>
                    )
                    return (
                        <li key={m.id}>
                            {done && !claimed ? (
                                <button type="button" onClick={(e) => claim(m, e.currentTarget)} className={cls}>{inner}</button>
                            ) : (
                                <Link to={missionTarget(m.id)} className={cls}>{inner}</Link>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
