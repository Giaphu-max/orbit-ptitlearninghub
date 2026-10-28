import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Gift } from 'lucide-react'
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
function MissionRow({ m }: { m: Mission }) {
    const { state } = useMissionState()
    const claim = useClaim()
    const { done, claimed } = state(m)
    return (
        <li className="flex items-center gap-3 border-t border-border px-[22px] py-3 first:border-t-0">
            <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 ${claimed ? 'border-success bg-success text-ink-foreground' : 'border-border'}`}>
                {claimed && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={`flex-1 text-[14.5px] ${claimed ? 'font-medium text-muted-foreground' : 'font-semibold text-strong'}`}>
                <Strike on={claimed}>{m.title}</Strike>
            </span>
            {claimed ? (
                <span className="font-mono text-[12.5px] font-bold text-muted-foreground">+{m.rewardXp}</span>
            ) : done ? (
                <button type="button" onClick={(e) => claim(m, e.currentTarget)} className="text-[13.5px] font-extrabold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    Nhận +{m.rewardXp} →
                </button>
            ) : (
                <Link to={missionTarget(m.id)} className="text-[13.5px] font-extrabold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    Làm →
                </Link>
            )}
        </li>
    )
}

/** Phần "Xem N nhiệm vụ khác" thu trong <details> (tầng 3). */
function MoreMissions({ missions, label, flat }: { missions: Mission[]; label: string; flat?: boolean }) {
    if (missions.length === 0) return null
    return (
        <details className={`group ${flat ? 'overflow-hidden rounded-card border border-border bg-card' : ''}`}>
            <summary className={`flex cursor-pointer list-none items-center justify-between px-[22px] py-3 text-[13.5px] font-bold text-muted-foreground [&::-webkit-details-marker]:hidden ${flat ? '' : 'border-t border-border'}`}>
                {label}
                <ChevronDown size={14} className="transition-transform duration-base group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="border-t border-border">
                {missions.map((m) => (
                    <MissionRow key={m.id} m={m} />
                ))}
            </ul>
        </details>
    )
}

/** /today: nhiệm vụ liên quan bài đọc và sửa lỗi; các nhiệm vụ còn lại thu vào "Xem N nhiệm vụ khác". */
export function ReviewMissions({ ids }: { ids: string[] }) {
    const main = MISSIONS.filter((m) => ids.includes(m.id))
    const rest = MISSIONS.filter((m) => !ids.includes(m.id))
    return (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <ul className="py-1.5">
                {main.map((m) => (
                    <MissionRow key={m.id} m={m} />
                ))}
            </ul>
            <MoreMissions missions={rest} label={`Xem ${rest.length} nhiệm vụ khác`} />
        </div>
    )
}

/** /journey: MỘT nhiệm vụ ưu tiên nhất (chưa nhận) + các nhiệm vụ khác trong <details>. */
export function NextMission() {
    const { state } = useMissionState()
    const claim = useClaim()
    const next = MISSIONS.find((m) => !state(m).claimed)
    const others = MISSIONS.filter((m) => m !== next)
    const doneCount = MISSIONS.filter((m) => state(m).claimed).length
    return (
        <div>
            <div className="rounded-card border border-border bg-card p-5 shadow-card">
                {next ? (
                    <>
                        <div className="flex items-start gap-3.5">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-ink">
                                <Gift size={18} />
                            </span>
                            <span>
                                <b className="block text-base font-extrabold text-strong">{next.title}</b>
                                <p className="mt-1 text-[13.5px] text-muted-foreground">
                                    {next.hint} · +{next.rewardXp} XP
                                </p>
                            </span>
                        </div>
                        <div className="mt-3 h-[5px] rounded-sm bg-muted">
                            <div className="h-full rounded-sm bg-brand-600" style={{ width: `${(state(next).value / next.target) * 100}%` }} />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <span className="font-mono text-[13.5px] text-muted-foreground">
                                {state(next).value}/{next.target}
                            </span>
                            {state(next).done ? (
                                <button type="button" onClick={(e) => claim(next, e.currentTarget)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-ink-foreground transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                                    Nhận +{next.rewardXp} XP →
                                </button>
                            ) : (
                                <Link to={missionTarget(next.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-ink-foreground transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                                    Làm ngay →
                                </Link>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="flex items-center gap-2 text-[15px] font-bold text-success">
                        <Check size={16} strokeWidth={3} /> Xong mọi nhiệm vụ hôm nay.
                    </p>
                )}
            </div>
            <div className="mt-2.5">
                <MoreMissions missions={others} label={`${others.length} nhiệm vụ khác hôm nay · ${doneCount}/${MISSIONS.length} xong`} flat />
            </div>
        </div>
    )
}
