import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Gift, Zap } from 'lucide-react'
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

const OUTLINE_BTN = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-brand-600 bg-transparent px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-soft'
const SOLID_BTN = 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700'

/** Danh sách nhiệm vụ hằng ngày dùng ở trang Hành trình (đầy đủ) và thẻ Trang chủ (gọn). */
export function MissionList({ compact = false }: { compact?: boolean }) {
    const dailyRaw = useOrbitStore((s) => s.daily)
    // Đọc lại khi tiến độ bài/Daily đổi để đích "Làm ngay" luôn đúng
    useOrbitStore((s) => s.lessonProgress)
    useOrbitStore((s) => s.dailyRead)
    const daily = dailyFor(dailyRaw)
    const claim = useClaim()
    const refs = useRef<Record<string, HTMLButtonElement | null>>({})

    const nextPriorityId = MISSIONS.find((m) => {
        const value = Math.min(m.target, m.progress(daily))
        const claimed = daily.claimed.includes(m.id)
        return !claimed && value < m.target
    })?.id

    return (
        <ul className={`flex flex-col ${compact ? 'gap-3' : 'mt-4 gap-3'}`}>
            {MISSIONS.map((m) => {
                const value = Math.min(m.target, m.progress(daily))
                const done = value >= m.target
                const claimed = daily.claimed.includes(m.id)
                const isNextPriority = m.id === nextPriorityId
                const action = claimed ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-success">
                        <Check size={14} strokeWidth={2.5} /> {compact ? `+${m.rewardXp}` : `Đã nhận +${m.rewardXp} XP`}
                    </span>
                ) : done ? (
                    <button type="button" ref={(el) => void (refs.current[m.id] = el)} onClick={(e) => claim(m, e.currentTarget)} className={SOLID_BTN}>
                        <Zap size={14} className="fill-current" /> Nhận +{m.rewardXp}{compact ? '' : ' XP'}
                    </button>
                ) : isNextPriority ? (
                    <Link to={missionTarget(m.id)} className={SOLID_BTN}>
                        Làm ngay <ArrowRight size={14} />
                    </Link>
                ) : (
                    <Link to={missionTarget(m.id)} className={OUTLINE_BTN}>
                        Làm ngay <ArrowRight size={14} />
                    </Link>
                )

                if (compact) {
                    return (
                        <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className={claimed ? 'text-muted-foreground' : 'font-semibold text-foreground'}>
                                <Strike on={claimed}>{m.title}</Strike>
                            </span>
                            {action}
                        </li>
                    )
                }
                const cardCls = claimed
                    ? 'flex flex-wrap items-center gap-4 rounded-card border border-border/50 bg-muted/30 px-4 py-3.5 opacity-65 transition'
                    : isNextPriority
                      ? 'flex flex-wrap items-center gap-4 rounded-card border-2 border-brand-500/40 bg-card p-5 shadow-sm ring-1 ring-brand-500/20'
                      : 'flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-5 shadow-card'

                return (
                    <li key={m.id} className={cardCls}>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-base ${claimed ? 'bg-success/10 text-success' : isNextPriority || done ? 'bg-brand-600 text-ink-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}>
                            {claimed ? <Check size={20} /> : <Gift size={18} />}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className={`font-bold ${claimed ? 'text-muted-foreground' : 'text-foreground'}`}>
                                <Strike on={claimed}>{m.title}</Strike>
                            </p>
                            <p className="text-sm text-muted-foreground">{m.hint}</p>
                            {!claimed && (
                                <div className="mt-2 flex items-center gap-3">
                                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full origin-left rounded-full bg-brand-600 transition-transform duration-slow" style={{ transform: `scaleX(${value / m.target})` }} />
                                    </div>
                                    <span className="font-mono text-xs text-muted-foreground">{value}/{m.target}</span>
                                </div>
                            )}
                        </div>
                        {action}
                    </li>
                )
            })}
        </ul>
    )
}
